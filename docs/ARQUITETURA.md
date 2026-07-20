# Arquitetura — Sacramento RPG

Este documento é o "porquê" por trás do `README.md`. Detalhe técnico, matriz de
permissões e o log de decisões em aberto ficam aqui para não inflar o README.

## 1. Stack e por quê

| Peça | Escolha | Alternativas consideradas |
|---|---|---|
| Frontend | React + Vite | Vue (também funcionaria bem); HTML puro (ficaria pesado dado o tanto de estado — sessão logada, papel do usuário, N personagens — que o app precisa gerenciar) |
| Estado de servidor | Supabase JS client direto (sem Redux/Zustand por enquanto) | Se a UI crescer muito, dá pra introduzir depois sem reescrever o schema |
| Banco | Supabase (Postgres gerenciado) | Pedido explícito seu |
| Autorização | RLS (Row Level Security) do Postgres | Alternativa seria checar permissão só no frontend — mas aí qualquer chamada direta à API do Supabase (fora do site) furaria a regra. RLS garante a regra *no banco* |
| Hospedagem | Netlify | Pedido explícito seu |

## 2. Modelo de dados (v2 — 13/07)

```
profiles (usuário + papel: admin | usuario)
  ├─< personagens (N por usuário — dono fixo; existe independente de campanha)
  │     ├─< items
  │     ├─< weapons
  │     └─1 mounts (0 ou 1 por personagem)
  ├─< campanhas (N criadas — dono = criado_por, qualquer papel pode criar)
  └─< convites (N recebidos: campanha + status pendente/aceito/recusado)

campanhas
  └─< campanha_personagens (N:N — liga personagens à campanha; um
        personagem pode estar em várias campanhas ao mesmo tempo — decidido em 13/07)
```

- `profiles` estende `auth.users` do Supabase Auth (criado automaticamente
  via trigger `handle_new_user`, sempre com papel `usuario` — não existe
  mais escolha de papel no cadastro).
- `personagens` substitui a antiga `character_sheets`: pertence só ao
  usuário, não a uma sessão/campanha. É possível ter um personagem
  "solto", sem nenhuma campanha vinculada.
- `campanhas` substitui a antiga `sessions`: qualquer usuário pode criar
  (não existe mais um papel "mestre" que é o único que cria).
- `campanha_personagens` é a tabela de junção N:N entre `campanhas` e
  `personagens` — substitui o antigo `session_players` (que ligava
  campanha↔usuário direto; agora liga campanha↔personagem, permitindo
  um personagem em várias campanhas).
- `convites` é nova: registra quem foi convidado pra qual campanha e o
  status da resposta. É a "comunicação interna" pedida — sem disparo de
  e-mail real por enquanto.
- Os campos numéricos do personagem (atributos, antecedentes, círculos)
  continuam colunas soltas, não um JSON — assim cada campo pode ser
  atualizado individualmente.

## 3. Quem pode fazer o quê (RLS)

| Ação | Admin | Dono da campanha | Dono do personagem | Outro usuário |
|---|---|---|---|---|
| Ver campanha | ✅ | ✅ (a própria) | ✅ (se participa ou tem convite) | ❌ |
| Criar campanha | ✅ | ✅ (qualquer usuário) | — | — |
| Convidar pra campanha | ✅ | ✅ (a própria) | ❌ | ❌ |
| Aceitar/recusar convite | ✅ | — | ✅ (o próprio convite) | ❌ |
| Ver personagem | ✅ | ✅ (se vinculado à sua campanha) | ✅ (o próprio) | ❌ |
| Criar personagem | ✅ | — | ✅ (só pra si mesmo) | — |
| Editar personagem | ✅ | ✅ (13/07: se vinculado à sua campanha) | ✅ (o próprio) | ❌ |
| Vincular personagem à campanha | ✅ | ✅ (personagem próprio, na própria campanha) | ✅ (se dono da campanha ou convite aceito) | ❌ |
| Remover vínculo | ✅ | ✅ (qualquer um, na própria campanha) | ✅ (o próprio vínculo) | ❌ |
| Ver/editar Rastreador de Combate | ✅ | ✅ (a própria campanha) | ❌ | ❌ |

Toda essa tabela vira código em `supabase/migrations/0002_rls_policies.sql`,
usando as funções auxiliares `is_admin`, `e_dono_da_campanha`,
`e_dono_do_personagem`, `participo_da_campanha`, `tenho_convite_aceito` e
`pode_ver_personagem`, pra evitar repetir a mesma subquery em toda policy.

**Nota de privacidade** (mesma decisão de antes, só carregada pro modelo
novo): um jogador comum que abre a página de uma campanha só vê, na lista
de "personagens nesta campanha", os **próprios** vínculos — não a lista
completa de quem mais está jogando. Isso é porque a policy
`campanha_personagens_select` só libera ver linhas onde você é o dono da
campanha OU o dono daquele personagem específico. Quem criou a campanha
(ou o Admin) vê todo mundo. Se quiser mudar isso (todo participante vê o
elenco completo), é 1 policy pra ajustar.

## 4. Mapeamento ficha (PDF) → banco

> ✅ **Implementado na Fase 5, atualizado em 13/07** (`src/routes/Personagem.jsx` +
> `src/components/personagem/`). Os campos que NÃO estão na ficha
> impressa original (`dinheiro`, `xp_total`, `weapons.tipo_dano`)
> continuam existindo no banco (já vêm da Fase 1) mas ficam de fora da
> UI — dependem das perguntas em aberto da seção 6. `weapons.municao_atual/max`
> ERA dessa lista, mas entrou em uso em 13/07 (ver subseção "Regras
> adicionais" abaixo). `items.na_montaria` (Fase 5) foi REMOVIDO em
> 13/07 — virou a relação de verdade `items.mount_id`.

| Campo na ficha impressa | Coluna / tabela | Observação |
|---|---|---|
| NOME | `nome` | |
| Físico / Velocidade / Intelecto / Coragem | `atributo_*` | 4 pontos p/ distribuir; somam em Vida/Movimentos/Antecedentes/Ações de Combate (13/07) |
| Atenção / Roubo / Medicina / Suor / Montaria / Tradição / Negócios / Violência | `ant_*` | rank 0–5, rola 1d6 + rank |
| Movimentos / Ações de Combate | derivados (não editáveis) | base 1 + Velocidade / base 1 + Coragem |
| Iniciativa / Defesa | `iniciativa`, `defesa` | seguem manuais |
| Círculos de Vida / Dor | `circulos_vida_*`, `circulos_dor_*`, `efeito_dor_atual` | mecânica na seção 5; efeito marcado na mão (popup) |
| Habilidades | tabelas `habilidades_catalogo` + `personagem_habilidades` | 13/07: deixou de ser texto livre, ver subseção "Regras adicionais" |
| Itens (nome, peso, quantidade) | tabela `items` (`personagem_id` OU `mount_id`) | + `local_montaria` (cavalo/bolsa/carro/carroça, só quando é da montaria); coluna ainda se chama `espaco` no banco, tela mostra "Peso" |
| Armas (nome, peso, dano) | tabela `weapons` (`personagem_id`) | + `meio_transporte` (coldre/bandoleira/bainha, 13/07), `tipo_dano` (Dor/Vida) e `municao_atual/max`, todos em uso |
| Dinheiro / Valor de recompensa | `dinheiro`, `valor_recompensa` | dinheiro existe desde a Fase 1; recompensa é novo (13/07); nenhum dos dois tem regra |
| Foto do personagem / História | `foto_url`, `descricao_historia` | novos (13/07); foto fica no bucket `fotos` do Storage, só a URL fica no banco |
| Montaria (potência, resistência, vida, dor, fidelidade) | tabela `mounts` (`personagem_id`) | 1 por personagem; + `tem_bolsa`/`tipo_carga`/`presente` (carga própria, 13/07) |


## 5. Mecânica de Vida/Dor encontrada no seu projeto antigo

Reconstruindo a partir de `statusPersonagem.js` / `statusMontaria.js` /
`gerenciamento.js` do repositório `garodtt/rpg`:

- Dor começa cheia (igual ao máximo) e **desce** a cada dano.
- Quando Dor chega a 0 (ou menos): Dor volta ao máximo E Vida desce 1
  ("quebra de resistência"). Isso é o que os 6 círculos numerados de
  1 (Atordoamento) a 6 (Desorientação) na ficha representam: cada
  círculo preenchido = 1 ponto de Dor gasto, e o efeito daquele número
  está ativo enquanto ele for o "mais preenchido".
- Quando Vida chega a 0, o personagem é marcado como "caído".
- A mesma regra vale para a Montaria (vida/dor próprias).

Isso está descrito em prosa aqui, e a implementação (o botão "Sofrer
dano" que aplica a regra, `src/lib/regras.js`) foi feita na Fase 6.

## 6. Decisões e perguntas em aberto

### Refatoração de 13/07 — modelo de Campanhas/Personagens (v2)

Substituiu o modelo original de Mestre/Sessão/Jogador. Resumo das
decisões tomadas nessa conversa:

- **Papéis**: só `usuario` e `admin`. O papel `mestre` acabou — qualquer
  usuário cria campanha e tem personagens. Admin gerencia tudo, mas
  também usa o site normalmente (não é mais uma experiência à parte).
- **Personagem pertence ao usuário**, não a uma campanha — existe
  independente, e é vinculado depois. Um personagem pode estar em
  **várias campanhas ao mesmo tempo** (decidido em 13/07 — a alternativa
  seria 1 campanha por vez).
- **Entrar numa campanha é convite, não adição direta**: quem criou
  busca por e-mail exato e convida; o convidado aceita/recusa no próprio
  painel. Sem disparo de e-mail real por enquanto — é só um registro
  interno (tabela `convites`).
- **Admin mantém tela própria de visão geral** (`/admin`, decidido em
  13/07), além de usar a mesma experiência de qualquer usuário em
  `/painel`.
- **Schema recriado do zero**: como só existia dado de teste, as
  migrations antigas (`0001`–`0003`) foram substituídas por um schema
  novo (`0001`–`0002`) em vez de `ALTER` incremental. `profiles.email`
  (que antes era a migração `0003` separada) já nasce na `0001` agora.
- **Referência de inspiração**: modelo de "agentes/personagens +
  campanhas" parecido com o C.R.I.S. (ferramenta de fã pra Ordem
  Paranormal) — criar campanha rápido, adicionar personagens pra
  acessar fichas dentro dela.

### Já decidido (decisões originais, ainda válidas)

- **Projeto Supabase**: novo, do zero — não reaproveita o projeto do
  `garodtt/rpg`.
- **Fonte "faroeste"** dos títulos da ficha original: sem o arquivo — vou
  escolher uma fonte gratuita de estilo velho-oeste/stencil na Fase 7
  (visual).
- **Regra de vida/dor confirmada (13/07)**: é exatamente a da seção 5 —
  Dor desce a cada dano; ao chegar a 0, reseta ao máximo e Vida desce 1
  ("quebra de resistência"). Implementado na Fase 6 (botão "Sofrer dano",
  ver seção correspondente abaixo).
- **Capacidade de inventário confirmada (13/07)**: `espaco_max` continua
  como número fixo, editável manualmente pelo jogador, sem fórmula ligada
  a atributo. Já é assim na Fase 5 (`CampoEditavel` em
  `src/routes/Personagem.jsx`) — nada muda na Fase 6 por causa disso.
- **Círculos da Montaria confirmados**: 6, igual à ficha nova (não os 10
  do projeto antigo) — já é assim desde a Fase 1/5, schema e tela não
  mudam.

### Ainda em aberto — não bloqueiam nada agora

A Fase 6 já foi implementada (seção abaixo) sem precisar de nenhuma
destas três — são recursos à parte, não regras de vida/dor/espaço.
Seguem em aberto só pra quando fizer sentido decidir:

1. **Sistema de XP por conquistas** (lista de ações com XP fixo) existia no
   app antigo mas não está na ficha impressa. Traz pro novo site ou fica de
   fora por agora?
2. **Munição de arma** (atual/máx + recarregar) do projeto antigo — mantemos
   como campo opcional por arma?
3. **Histórico de alterações** (log tipo "Vida 6 → 5, XP 10 → 25") existia no
   projeto antigo. Vale como fase futura (Fase 9)?

### Fase 5 — decisões de implementação (13/07)

- **Escopo seguiu literalmente "todos os campos da ficha original"**: os
  extras do projeto antigo que não aparecem na ficha impressa (dinheiro,
  xp_total, munição/tipo de dano de arma) ficaram de fora da tela — as
  colunas já existem (Fase 1), então é rápido adicionar o campo depois
  que as perguntas 2–4 acima forem respondidas.
- **Dicas de orçamento de pontos são só informativas**: "Pontos usados:
  X/Y" aparece pros Atributos, Antecedentes e Montaria
  (Potência+Resistência), mas nada impede salvar um valor fora do
  esperado — travar de verdade (se for o caso) continua em aberto; não
  fazia parte da regra de vida/dor confirmada em 13/07, então a Fase 6
  não mexeu nisso.
- **Tabela de efeitos da Dor** (Atordoamento...Desorientação) aparece
  como referência na tela, destacando a linha correspondente aos
  círculos já marcados — mas o gatilho automático da "quebra de
  resistência" (Dor zera → Vida −1) não foi implementado; isso é Fase 6
  (✅ implementado — ver seção abaixo).
- **Trilhas de círculo clicáveis**: Vida, Dor (personagem e montaria) e
  Antecedentes usam o mesmo componente (`TrilhaCirculos`) — clicar no
  círculo N define o valor como N; clicar de novo no último círculo já
  preenchido reduz 1.
- **Campos salvam sozinhos ao perder o foco** (`onBlur`), sem botão de
  "Salvar" — dada a quantidade de campos numéricos na ficha, um botão por
  campo (ou um só botão gigante no fim) seria mais atrito do que ajuda.
- **Nota sobre a pergunta do Admin no handoff anterior** (se o Admin
  também deveria "criar/rodar sessões"): a refatoração de 13/07 já
  resolveu isso por outro caminho — não existe mais um botão especial de
  "criar sessão" restrito a um papel; qualquer usuário (Admin incluso)
  cria campanha pelo `/painel`, então a pergunta não se aplica mais ao
  modelo novo.

### Fase 6 — decisões de implementação (13/07)

- **Regra implementada exatamente como a seção 5 descreve**: dano é
  aplicado contra a Dor; quando ela chegaria a 0 ou menos, reseta ao
  máximo e a Vida desce 1 ("quebra de resistência"). A conta é uma
  função pura em `src/lib/regras.js` (`aplicarDano`), sem estado — quem
  chama decide o que persistir. Reaproveitada tal e qual para a Montaria
  (mesma regra, seção 5 do ARQUITETURA.md).
- **Dano grande o bastante pra quebrar mais de uma vez**: a função repete
  o cálculo (reduz Dor, reseta, desce Vida) até o dano acabar ou a Vida
  chegar a 0 — não estava especificado no texto original, mas é a leitura
  mais direta da regra "desce a cada dano" aplicada a um número qualquer
  de pontos de uma vez. Se isso não bater com o que acontece na mesa,
  é só avisar que ajusto.
- **"Caído"**: não virou coluna nova no banco — é derivado
  (`circulos_vida_atual <= 0`) e mostrado como um badge vermelho ao lado
  do título da seção (personagem) ou logo abaixo dos círculos (montaria).
  Evita uma migration só pra um estado que já dá pra calcular.
- **UI**: um componente novo e reutilizável, `SofrerDano.jsx` — campo
  numérico + botão "Aplicar", usado tanto no personagem quanto dentro de
  `Montaria.jsx`. Ele só calcula e mostra o resultado (inclusive quantas
  vezes quebrou); quem persiste no Supabase é sempre o componente pai
  (`Personagem.jsx` ou `Montaria.jsx`), do mesmo jeito que os outros
  campos da ficha. **Substituído em 13/07** por `LinhaCirculosAjustavel.jsx`
  — ver "Vida/Dor atual — correção" mais abaixo.
- **As trilhas de círculo continuam editáveis manualmente** (Fase 5,
  inalterado) — úteis pra corrigir um valor sem passar pela regra de
  dano, ex.: o Mestre ajustando a ficha fora de combate.
- **Inventário/espaço não mudou nada**: a decisão de 13/07 foi manter
  `espaco_max` como campo fixo editável manualmente, sem fórmula — que já
  era exatamente como a Fase 5 implementou. Nenhum código novo foi
  necessário por causa dessa resposta.
- **Sem migration nova** — as colunas usadas (`circulos_vida_atual/max`,
  `circulos_dor_atual/max`, nos dois lados, personagem e montaria) já
  existem desde a Fase 1.

### Regras adicionais (13/07) — decisões de implementação

Pedido grande, várias frentes de uma vez. Primeira migration incremental
de verdade (`0003`) desde a recriação de schema — rode ela no SQL
Editor do Supabase antes de testar.

**Atributos somando de verdade**
- Físico → Máximo de Vida (base 6 + Físico). Velocidade → Movimentos
  (base 1 + Velocidade, só leitura agora). Coragem → Ações de Combate
  (base 1 + Coragem, só leitura). Intelecto → orçamento de Antecedentes
  (já era calculado, sem mudança).
- Vida atual acompanha a DIFERENÇA quando o máximo muda (subiu 1 no
  máximo, sobe 1 no atual) — pra não ficar "faltando" vida à toa quando
  o jogador sobe um atributo.
- Máximo de Vida (e Máximo de Dor, por simetria) ganharam um stepper
  +/- por cima do valor calculado, pra ajuste manual (efeito temporário,
  item mágico etc.). **Assumido, não confirmado**: editar o atributo de
  novo RECALCULA e substitui esse ajuste manual — não existe uma coluna
  separada de "bônus temporário" ainda. Se isso for um problema na
  prática, dá pra separar depois.

**Efeito de Dor — popup manual**
- Virou popup (`EfeitoDorPopup.jsx`), marcado na mão — o jogador rola
  1d6 na mesa e marca qual efeito valeu (`personagens.efeito_dor_atual`,
  coluna nova). Antes (Fase 5) a linha "ativa" era calculada sozinha a
  partir de quantos círculos de Dor estavam marcados; isso foi removido.
- Clicar no efeito já marcado desmarca. Não zera sozinho quando a Dor
  reseta (quebra de resistência) — fica marcado até o jogador trocar.

**Itens — peso × quantidade, trava de carga, coldre/bandoleira**
- Peso total da linha = peso unitário × quantidade (coluna nova). A
  trava agora é de VERDADE: passar do limite de carga (`espaco_max`,
  tela mostra "Peso máximo") bloqueia salvar — isso substitui a decisão
  da Fase 5 ("só aviso, não trava"). Só vale pra Itens; os avisos de
  Atributos/Antecedentes/Montaria continuam só informativos (não foi
  pedido mudar esses).
- Coluna do banco continua `espaco` (não renomeei pra `peso` — economia
  de risco numa migration que já mexe em muita coisa; a tela já mostra
  "Peso" no rótulo).
- `tipo_carregador` (coldre = +36 balas leves / bandoleira = +24
  pesadas) é só mais um campo do item — ele conta peso normal também.
  Múltiplos coldres/bandoleiras somam capacidade (2 coldres = 72).

**Munição — pools por categoria**
- Armas têm `categoria` (leve/pesada) — decide de qual pool recarregam.
  Reserva (`municao_leve_atual`/`municao_pesada_atual`, em
  `personagens`) é o que o jogador está carregando fora da arma;
  capacidade de cada pool é derivada dos itens (coldre/bandoleira), não
  guardada — sempre `soma dos itens certos × 36 ou × 24`.
  `municao_atual`/`max` de cada arma (Fase 1, sem uso até agora) é o que
  está carregado NA arma — separado da reserva, exatamente como
  descrito ("uma arma carregada tem o limite dela além do coldre/bandoleira").
- Recarregar pega o que faltar pra encher (`municao_max − municao_atual`),
  limitado ao que o pool tiver — se faltar bala pra encher, carrega
  parcial e o pool zera.
- **Não implementado, por não ter sido pedido**: um botão "atirar" que
  desconta 1 bala sozinho. `municao_atual` da arma é um campo comum,
  editável na mão — o jogador desconta conforme narra os tiros.

**Montaria — vida/dor igual ao jogador, carga e inventário próprios**
- Resistência → Máximo de Vida da montaria, mesma fórmula e mesmo
  stepper do personagem ("igual ao jogador", item 7). Potência não tem
  fórmula (segue igual). O popup de Efeito de Dor **não** foi replicado
  pra montaria — o texto dos 6 efeitos fala de Ações de Combate/ataques,
  não faz sentido narrativo pra um cavalo; a mecânica de dano
  (Sofrer Dano) continua igual pros dois.
- Carga: 10 padrão + bolsa de montaria (+15, checkbox) + carro (+20) OU
  carroça (+30) — os dois últimos são radio (mutuamente exclusivos),
  bolsa é independente e pode vir com qualquer um dos dois. Cálculo em
  `calcularEspacoMontaria` (`src/lib/regras.js`).
- Marcar um item como "vai pra montaria" agora manda ele pra um
  inventário DE VERDADE separado (`items.mount_id`, em vez de
  `personagem_id`) — troca a Fase 5 (`na_montaria`, que era só um
  checkbox informativo dentro do inventário do personagem). Mesma
  trava de peso, contra a carga da montaria em vez da do personagem.
  Coldre/bandoleira não aparece nesse inventário (não fazia sentido
  pro cavalo carregar isso pra fins de munição do personagem).
- `presente` (checkbox "está com o personagem agora"): só um aviso na
  tela quando desmarcado ("itens dela não estão disponíveis") — **não
  bloqueia nada de verdade** (não trava edição, não esconde o
  inventário). Simplificação deliberada; dava pra reforçar mais se
  fizer diferença na mesa.

**Habilidades — catálogo + criação própria**
- Deixou de ser texto livre (Fase 5). Agora são duas tabelas:
  `habilidades_catalogo` (lista compartilhada, só admin escreve) e
  `personagem_habilidades` (o que cada personagem tem — referencia o
  catálogo OU tem `nome_customizado`, que é o mesmo que "criada pelo
  jogador": não tem coluna separada pra isso, é só `catalogo_id` ser
  nulo).
- **Catálogo preenchido (13/07)**: as 30 habilidades do livro (`habilidades.pdf` —
  15 de Combate + 15 de Profissão) foram inseridas via migration `0004`,
  que também acrescentou `habilidades_catalogo.categoria` (`combate` |
  `profissao`) pra agrupar o dropdown em `Habilidades.jsx` (`<optgroup>`
  por categoria, ordenado por `categoria, nome`). O texto de cada
  habilidade foi transcrito trocando os ícones do livro por extenso —
  **punho = Dor, caveira = Vida** (confirmado com você) — inclusive um
  caso que mistura os dois (Quebra-ossos: cada nível dá um pouco de
  Vida + um pouco de Dor no mesmo golpe). Rasterizei as páginas do PDF
  pra conferir cada ícone visualmente em vez de confiar só no texto
  extraído (que não preserva imagem inline).
- A coluna antiga `personagens.habilidades` (texto livre) não foi
  apagada — só parou de ser usada na tela. Se algum personagem de teste
  tinha algo escrito lá, o texto continua no banco, só não aparece mais.

### Vida/Dor atual — correção (13/07)

O painel "Sofrer Dano" (Fase 6) misturava as duas coisas: um campo
numérico + botão que só mexia na Dor (cascata pra Vida). Mas existem
ferimentos que vão direto na Vida, sem passar pela Dor — o painel não
dava conta disso, e além do mais não era um jeito rápido de usar no
celular (abre teclado numérico pra cada toque).

- **`SofrerDano.jsx` removido**, substituído por `LinhaCirculosAjustavel.jsx`
  — um `−`/`+` de cada lado da trilha de círculos, 1 ponto por toque.
  Usado 4 vezes (Vida e Dor, personagem e montaria).
- **Vida tem seu próprio +/-** (`ajustarVidaAtual` em `Personagem.jsx`/
  `Montaria.jsx`, usa `regras.ajustarValorSimples`): ferimento direto,
  não passa pela Dor, não acessa a regra de quebra. Só sobe/desce entre
  0 e o Máximo — **nunca mexe no Máximo em si** (isso é o `CampoStepper`,
  que continua separado, do lado de cima).
  Isso valia a pena, aliás, deixar claro: o pedido tinha "um botão de +/-
  que não interefirce na vida max" — é exatamente essa separação.
- **Dor também tem seu próprio +/-**, mas descer continua acionando
  `aplicarDano` (a mesma regra da Fase 6, só que sempre com 1 ponto por
  toque em vez de um número digitado) — reseta e desce 1 de Vida quando
  zera, do jeito de sempre. Subir (curar Dor) é simples, sem regra
  nenhuma (não existe "quebra reversa").
- Uma mensagem pequena aparece embaixo da trilha de Dor só quando uma
  quebra acontece (ex.: "Quebra de resistência! Vida −1") — fica até a
  próxima vez que mexer na Dor, sem popup/painel separado.
- As trilhas de círculo continuam clicáveis direto (clique = define o
  valor daquele círculo) — isso não mudou, é o ajuste manual/correção de
  sempre, independente do +/- novo.

### Fase 7 — decisões de implementação (13/07, visual)

Referência: rasterizei as 2 páginas do `Ficha_Editável_-_Sacramento_RPG.pdf`
e usei como fonte visual direta, em vez de inventar um estilo "faroeste"
genérico — a ideia era recriar ESSA ficha, não fazer uma nova.

**Paleta** (`src/styles/global.css`, `:root`):

| Token | Hex | Uso |
|---|---|---|
| `--cor-fundo` | `#ecdfc1` | fundo da página (papel) |
| `--cor-papel` | `#f8f1dc` | cards, inputs, texto sobre caixa preta |
| `--cor-tinta` | `#221a10` | texto, bordas, caixas pretas, botões |
| `--cor-tinta-suave` | `#5a4a35` | texto secundário (substituiu os cinzas antigos) |
| `--cor-sangue` | `#9c2b1a` | **só** valores numéricos editáveis — igual a ficha original |
| `--cor-couro` | `#7c5330` | bordas secundárias, links, badge "criada pelo jogador" |
| `--cor-poeira` | `#b98a3d` | hover/foco, com moderação |

**Fontes** (Google Fonts, link no `index.html`, não em cada componente):
- **Rye** — título/display, em todo `h1`-`h4` do app inteiro (login,
  painel, ficha). É a mesma família usada nos posters "procurado" do
  velho oeste — mais fiel ao PDF do que inventar uma fonte stencil
  genérica. Só tem peso 400 (não força bold nela).
- **Vollkorn** — corpo, usada dentro da ficha (parágrafos, tabela de
  efeitos de Dor, lista de habilidades) — mesma sensação de "documento
  antigo" do PDF.
- Sans do sistema (`-apple-system`/`Segoe UI`/Roboto) — só pra texto
  DIGITADO em inputs e pra UI fora da ficha (nada de Rye em campo de
  texto, ilegível em tamanho pequeno).

**Onde o visual foi aplicado**: o token system inteiro mora em
`global.css`, então cascateia pro app inteiro (Login, Painel,
CampanhaDetalhe, AdminDashboard) sem precisar tocar nesses arquivos —
só ganham a paleta/fontes novas automaticamente. A ficha em si
(`Personagem.jsx` e os componentes de `components/personagem/`) ganhou
atenção extra, com só 2 arquivos JSX tocados (ver abaixo).

**Elemento de assinatura — caixas pretas sólidas**: no PDF, só 3 blocos
usam fundo preto sólido (não é todo cabeçalho): a caixa dos 4 Atributos,
a linha de cabeçalho das tabelas de Itens/Armas, e o bloco de Nível de
Fidelidade. Reproduzi só esses 3 — de propósito, não em cada `<h2>`,
pra não virar decoração repetida sem sentido (a maioria dos títulos de
seção é só texto Rye simples, igual o PDF faz pra "Círculos de Dor",
"Habilidades" etc.). A caixa de Atributos precisou de uma classe nova
(`bloco-atributos-preto`) no `<div className="grid-campos">` de
`Personagem.jsx` — os outros dois (`tabela-ficha thead th` e
`.nivel-fidelidade`) foram só CSS, sem tocar em JSX.

**Textura de papel**: sem imagem/asset externo — um SVG de ruído
(`feTurbulence`) como data-URI no `background-image` do `body`, mais um
`radial-gradient` escurecendo as bordas (vinheta). Leve o bastante pra
não pesar no celular.

**Números sempre em vermelho**: `.campo-editavel input` (o valor
digitável) é `--cor-sangue` e bold por padrão — reproduz o detalhe mais
consistente do PDF (todo número da ficha é vermelho). Texto normal
(nome, habilidades) não usa essa regra — só o `<input type="number">`
dos valores.

**Celular** (pedido explícito — "a ideia é usarem isso no celular"):
- `TabelaItens.jsx` e `TabelaArmas.jsx` ganharam um wrapper
  `<div className="tabela-scroll">` em volta da `<table>` — em vez de
  espremer 5-6 colunas até ficar ilegível, a tabela vira scroll
  horizontal dentro do card.
- `@media (max-width: 640px)` reduz o tamanho dos títulos Rye (ficam
  muito largos em telas pequenas), empilha `.grid-circulos` numa coluna
  só, e aperta o `minmax` do `.grid-campos`.
- Botões de `+/-` (`.botao-ajuste`, Vida/Dor atual) ficaram em 2.75rem
  (44px) — tamanho de toque confortável. Os círculos da trilha
  (`.pip`) subiram um pouco (1.6rem → 1.85rem) mas não foram pra 44px —
  com até 8 antecedentes × 5 círculos na tela, um alvo de toque grande
  assim quebraria o layout; ficou um meio-termo.

**O que não foi replicado do PDF, deliberadamente**:
- Os ícones de caveira dentro dos círculos de Vida/Dor, e as
  silhuetas de pistoleiro ao lado de cada Antecedente — são ilustrações
  específicas, exigiriam desenhar/licenciar arte nova; ficou fora do
  escopo de "fontes, cores, textura de papel".
- As bordas com cantos arredondados irregulares tipo "papel rasgado" do
  PDF — ficaram como retângulos com `border-radius` comum. Dava pra
  imitar com `border-radius` assimétrico, mas arriscava ficar
  inconsistente entre navegadores sem ganho visual grande.
- Não critiquei o resultado com uma captura de tela — não tenho como
  rodar o Vite + abrir um navegador de verdade neste ambiente pra
  conferir visualmente. Se algo não bater com o que você imaginava
  (peso de cor, tamanho de fonte, o que for), me avisa que ajusto.

### Rastreador de Combate — decisões de implementação (13/07)

Você mandou o código do gerenciador antigo (HTML/JS solto, sem
Supabase) como referência de comportamento. Portei a lógica, não o
código — reaproveitando `src/lib/regras.js` em vez de duplicar a regra
de quebra de resistência numa segunda implementação.

- **Tabela nova** (`combate_entradas`, migration `0005`): cada linha é
  um "bloco de stats" solto — nome, tipo (`npc`/`jogador`, só uma
  etiqueta visual), iniciativa, vida/dor (max+atual) e balas
  (max+atual). **Não referencia `personagens.id`** — o Mestre digita os
  números na hora, igual o gerenciador antigo fazia, em vez de puxar (e
  ter que sincronizar) a ficha de verdade de um jogador. Se isso fizer
  falta na prática (puxar os stats reais de um personagem automático),
  dá pra adicionar depois.
- **Vida** usa `ajustarValorSimples` (mesma função do "ferimento direto
  na Vida" da ficha) — botão −1 isolado, sem passar pela Dor.
- **Dor** usa `aplicarDano` (mesma função da ficha) — descer aciona a
  quebra de resistência (reseta e desce 1 de Vida) automaticamente,
  idêntico ao personagem/montaria.
- **Balas**: propositalmente mais simples que o sistema de
  coldre/bandoleira do personagem — só max/atual por combatente, sem
  pool de reserva. "Recarregar" reseta pro máximo direto (igual o
  código de referência). Achei que replicar o sistema completo de
  munição por categoria aqui seria over-engineering pra NPC — normalmente
  o Mestre só quer saber "quantos tiros esse capanga tem antes de
  recarregar", não gerenciar o inventário dele.
- **RLS mais restritiva que o resto do app**: só o dono da campanha (ou
  Admin) vê e mexe — nem o participante comum enxerga linha nenhuma
  (diferente de `items`/`weapons`/`mounts`, onde o dono do personagem
  também tem acesso). Faz sentido: é ferramenta do Mestre, incluindo
  stats de NPC que o jogador não deveria ver de antemão.
- **Ordenação**: maior Iniciativa primeiro (igual o código de
  referência), com `created_at` como desempate estável — o antigo não
  tinha desempate explícito.
- **"Encerrar combate"**: apaga todas as entradas da campanha de uma
  vez (não existia no código de referência, mas sem isso a lista só
  cresce entre combates — achei que fazia falta).
- Rota `/campanha/:id/combate`, link só aparece pra quem gerencia a
  campanha (`CampanhaDetalhe.jsx`).
- **Correção (13/07)**: Vida e Dor só tinham botão de −1 (copiado literal
  do código de referência, que era só sobre dano). Como dá pra
  recuperar os dois na mesa (poção, cura de habilidade, etc.),
  acrescentei o +1 pros dois — usando o mesmo `ajustarVida`/`ajustarDor`
  que já existiam (a função já aceitava delta positivo, só faltava o
  botão). "Caído" é derivado (`vida_atual <= 0`), então nada mais
  precisou mudar: subir a Vida de novo já tira do estado sozinho.
- **Tabelas de referência (13/07)**: "Iniciativa {n}" e "Dor" (em cada
  combatente) viraram botões que abrem um popup — `PopupReferencia.jsx`
  (`components/combate/`), um shell genérico reaproveitado pelos dois.
  O de Iniciativa mostra 3 tabelas do livro (bônus por carta A/K/Q/J,
  acerto crítico 1d6, falha crítica 1d6); o de Dor reaproveita
  `EFEITOS_DOR` (exportado de `EfeitoDorPopup.jsx`, sem duplicar dado).
  São só consulta — não marcam nada no combatente (diferente do popup
  de Dor da ficha do personagem, que marca `efeito_dor_atual`); se
  fizer falta guardar "esse NPC está Atordoado agora", dá pra
  acrescentar depois.
  **Assumido, sinalizando por segurança**: nas duas imagens que você
  mandou, o ícone da carta J e o ícone da linha "Mortal" (acerto
  crítico) parecem visualmente iguais — o estilo caveira (Vida). Pra
  carta J isso bate com o padrão da tabela (+1 num atributo/recurso por
  carta), então usei "+1 de Vida" direto. Já pra "Mortal", presumi que
  o ícone real ali é o de punho (Dor) e não caveira — "acerto crítico"
  só faz sentido como dano a mais no inimigo, não vida a mais pra quem
  ataca, então escrevi "+2 de Dor no ataque" em vez de seguir a leitura
  visual literal. Se eu li errado (em qualquer uma das duas linhas), é
  só apontar e eu corrijo.

### Correção de performance do RLS (13/07)

Sintoma relatado: tudo ficou muito lento (+/- de Vida/Dor, recarregar,
até só abrir o Rastreador de Combate). Causa confirmada, não só
suspeita — contei as ocorrências nas migrations antes de mexer:

```
grep -c "auth.uid()" supabase/migrations/*.sql   # 21 ocorrências
grep -c "is_admin()" supabase/migrations/*.sql   # 43 ocorrências
```

Nenhuma delas empacotada em `(select ...)`. É uma armadilha bem
documentada do Postgres/Supabase: sem o `select`, o `auth.uid()`
(e qualquer função que dependa dele, como `is_admin()`) é reavaliado a
cada linha que a policy examina, em vez de rodar 1 vez só por consulta
(virar um "initPlan"). Ficha oficial:
https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv

- **`0006_rls_performance_fix.sql`** reescreve as ~10 funções auxiliares
  (`is_admin`, `e_dono_da_campanha`, `e_dono_do_personagem` etc. —
  mesmo nome/assinatura, só o `auth.uid()` interno virou
  `(select auth.uid())`) e recria toda policy que chamava `auth.uid()`
  ou `is_admin()` direto — a lógica de quem pode fazer o quê é
  **idêntica** à original, só a forma de chamar essas duas funções
  mudou. Índices já estavam certos desde a Fase 1 (conferi antes de
  desconfiar disso).
- Funções com parâmetro que muda por linha (`e_dono_da_campanha(id)`,
  `pode_ver_personagem(id)` etc.) não dá pra "cachear" no ponto de
  chamada do mesmo jeito — o ganho ali é só corrigir o `auth.uid()` que
  mora DENTRO delas. Só `is_admin()` (sem parâmetro nenhum) também
  ganha empacotar a chamada inteira, porque o resultado dela não muda
  linha a linha.
- **Sem garantia de que resolve 100%**: isso é uma causa real e
  confirmada, mas não tenho como medir o tempo de resposta do seu
  projeto Supabase a partir daqui (sandbox sem acesso à internet
  externa). Se continuar lento depois de rodar a `0006`, os próximos
  suspeitos são fora do meu alcance de código: região do projeto
  Supabase (Settings → General — quanto mais longe de você, mais
  latência) e se o projeto é do plano gratuito (pausa sozinho depois
  de inatividade e "acorda" devagar na primeira requisição). O Supabase
  também tem um linter automático pra exatamente esse problema —
  dashboard → Advisors → Performance → `auth_rls_initplan` — vale
  rodar depois da migration pra confirmar que não sobrou nada.

### Revisão de armas, montaria e campos novos (13/07)

**Armas — mudou de conceito**: coldre/bandoleira deixou de ser um item
avulso (Fase 6) e virou `weapons.meio_transporte` — cada arma de fogo
já "traz" o coldre ou a bandoleira junto (1 arma no coldre = +36 de
capacidade leve; 1 na bandoleira = +24 pesada). `bainha` é a terceira
opção, pra arma branca (faca), sem munição. Limites validados no app
(`src/lib/regras.js`, `validarMeioTransporte`): bandoleira ≤ 2,
coldre + bandoleira ≤ 4, bainha ≤ 1 — bate com os exemplos que você
deu (2+2, 4+0, 3+1, sempre somando 4). `categoria` (leve/pesada) saiu,
`meio_transporte` já cobre a mesma função. `tipo_dano` (Dor/Vida) é só
referência — não aciona nada sozinho na tela, é o jogador que decide
onde aplicar (ficha ou Rastreador de Combate) na hora de narrar.

**Peso da arma nunca contou** — nem antes nem agora `weapons.espaco`
entra em conta nenhuma de carga; o campo existe só por fidelidade à
ficha impressa (que tem uma coluna "Espaço" pras armas). Só a munição
**excedente** conta peso agora.

**Munição — capacidade vs. excedente**: até a capacidade do coldre/
bandoleira (36/24 por arma), a munição não pesa nada — já "vem" com a
arma. Passar disso, o excedente pesa (0,08 leve / 0,25 pesada) e entra
na mesma trava de carga dos Itens. Isso significa que o limite de Itens
e o de Munição são **interdependentes**: `Personagem.jsx` calcula os
dois lados (peso já usado por Itens, excedente já usado por Munição) e
passa pra cada tela só o que sobra pro outro lado — editar um dos dois
pode fazer o outro ter menos espaço disponível na hora.

**Montaria — inventário por sub-local**: antes (Fase 6) era um pool só
(10 + bolsa + carro/carroça somados). Agora cada sub-local (Cavalo,
Bolsa, Carro, Carroça) tem seu próprio limite e sua própria lista de
itens (`items.local_montaria`) — só aparecem os sub-locais que a
montaria realmente tem equipado. "Excluir todos" agora pode ser feito
por sub-local (largar só a bolsa, sem mexer no resto).

**Nível de Fidelidade**: o número dentro do círculo estava sem
`display:flex`/`padding:0` — herdava o padding do botão genérico
(0.5rem 1rem), que descentraliza texto num círculo de tamanho fixo.
Corrigido.

**Dinheiro e Valor de recompensa**: `dinheiro` já existia desde a Fase
1 (fora da tela até agora); `valor_recompensa` é campo novo. Os dois
são só números soltos, sem regra — nova seção "Dinheiro" na ficha,
sem cálculo nenhum ligado a eles ainda.

### Ajustes de UX — armas e peso (13/07, segunda rodada)

- **Peso soma em vez de diminuir o máximo**: `TabelaItens.jsx` ganhou
  `pesoAdicional` (peso de outra fonte, ex.: munição excedente) — soma
  no "usado" pra exibição, em vez do máximo encolher (`0/9.92` virou
  confuso; agora é `0.08/10`, o máximo mostrado é sempre o de verdade).
- **Bug de verdade encontrado e corrigido**: quando uma mudança era
  rejeitada pela trava de peso, o `<input>` ficava mostrando o valor
  digitado mesmo sem ter salvado — parecia que só um aviso apareceu, mas
  na real tinha barrado. Eram inputs não-controlados (`defaultValue`);
  agora um contador de tentativas rejeitadas força o campo a "voltar"
  pro valor de verdade via `key` (remonta o input). Mesma lógica raiz
  afetava o `<select>` de `meio_transporte` das armas — esse foi trocado
  pra controlado (`value`) de vez, que é mais direto pra um select (não
  tem "meio de digitação" pra preservar como um número tem).
- **Munição virou dois campos**: "Mun. máx." (editável direto) e "Mun.
  atual" (só mostra o número, com botão `−1`; ao chegar a 0, vira
  "Recarregar") — igual o Rastreador de Combate já fazia, só que lá
  também usa a mesma munição simples (sem pool). Recarregar continua
  chamando `onRecarregar` (`Personagem.jsx`), que já descontava do pool
  certo (leve/pesada conforme coldre/bandoleira) desde a primeira
  versão — só a UI em cima mudou.
- Mensagens de limite (bandoleira/coldre/bainha cheios) agora dizem
  "cheio" de forma direta, em vez de só explicar o número.

### Munição — +1 parcial e layout estável (13/07, terceira rodada)

- **`aplicarRecarga` ganhou `quantidade`** (default `Infinity` = encher
  até o máximo, igual antes): passar `1` faz um "+1" parcial — pega uma
  bala do pool certo (leve/pesada) e põe na arma, sem precisar encher
  tudo. Mesma função pros dois botões, só muda o parâmetro.
- **`−1`, `+1` e "Recarregar" ficam sempre visíveis juntos** (só
  desabilitam quando não fazem sentido: arma cheia, ou pool vazio) — 
  antes o layout trocava entre "só −1" (arma com munição) e "só
  Recarregar" (arma vazia), e essa troca de conjunto de botões
  desalinhava a linha (mudava de tamanho) quando clicava. Agora é
  sempre o mesmo conjunto, então não pula mais.
- **`−1` consome (não devolve ao pool)** — é a bala que já estava na
  arma sendo usada. `+1` e "Recarregar" são os únicos que tiram do
  pool — e por isso, se o pool tiver mais balas do que a capacidade do
  coldre/bandoleira (excedente pesando no inventário), recarregar
  reduz esse excedente automaticamente, já que é o mesmo número.

### Bug de reatividade no pool de munição (13/07, quarta rodada)

`MunicaoPool.jsx` usava `defaultValue` nos dois campos (leve/pesada) —
essa prop só é lida na primeira montagem do componente; mudanças
posteriores vindas de FORA daquele input (recarregar uma arma, `+1`)
não atualizavam o campo na tela, só depois de recarregar a página
inteira (que remonta tudo do zero, lendo o valor certo do banco).

Corrigido com o mesmo padrão que `CampoEditavel.jsx` já usava: um
buffer local (`useState`) + `useEffect` que sincroniza o buffer sempre
que o valor vindo de fora mudar. Também aproveitei pra mostrar a
mensagem de erro da trava de peso (antes a função devolvia a mensagem,
mas nada na tela exibia) e garantir que o campo volta pro valor de
verdade quando uma tentativa é rejeitada — mesma lógica dos outros
campos travados na ficha.

Conferi o resto do projeto (`grep` por `defaultValue`): os outros usos
(itens, nome/peso/dano de arma, munição máxima) só são alterados pelo
próprio campo, nunca por uma ação de fora — não tinham essa
precondição, então não precisavam do mesmo conserto.

### Navegação em HUD — Painel e ficha em abas (13/07)

Pedido: com a maioria jogando pelo celular, ter tudo espalhado numa
página só rolando ficou ruim. Reestruturei em dois níveis.

**Painel virou 3 telas + menu lateral.** Antes (`Painel.jsx`) era uma
página só com: convites, personagens + formulário de criar, campanhas
criadas + formulário de criar, campanhas que participa — tudo sempre
visível. Agora:
- `PainelShell.jsx` (`components/layout/`) é a casca comum das 3 telas —
  cabeçalho com hamburguer (☰) + menu lateral (`MenuLateral.jsx`) com 4
  itens (Seus Personagens, Criar Personagem, Minhas Campanhas, Criar
  Campanha) + os dois popups de criação (antes eram formulários sempre
  abertos na página; agora só aparecem quando você toca no item do
  menu). Depois de criar, navega pra ficha/campanha nova — igual antes.
- `Painel.jsx` (rota `/painel`) virou só uma tela de boas-vindas — a
  navegação de verdade é toda pelo menu.
- `PainelPersonagens.jsx` (`/painel/personagens`) e
  `PainelCampanhas.jsx` (`/painel/campanhas`) são as duas telas de
  lista. **Convites pendentes foram pra dentro de "Minhas Campanhas"**
  — não foram citados no pedido como item de menu próprio, e são sobre
  campanha, então botei junto de "que você participa/criou".
- `MenuLateral.jsx` é genérico de propósito: cada item usa `to` (link
  de verdade, `<Link>`) OU `onClick` (ação local), nunca os dois — o
  mesmo componente é reaproveitado dentro da ficha (abas), só trocando
  o que os itens fazem.

**Ficha virou 4 abas**, trocadas pelo mesmo `MenuLateral` (aqui com
`onClick` pra cada item, não `to` — não navega, só troca
`abaAtiva` local, mesma URL):
- **Nome/Atributos/Antecedentes/Habilidades/Dinheiro** — pedido
  literal.
- **Combate e Armas** — pedido dizia só "combate/armas", mas incluí
  **Círculos de Vida e Dor** aqui também (não foi citado explicitamente
  em nenhum grupo) — é tudo sobre "levar dano" e não tinha outro lugar
  óbvio pra ir.
- **Inventário** — Itens do personagem + Inventário da Montaria juntos
  (pedido: "inventário/inventário montaria"). Isso exigiu separar
  `Montaria.jsx` em duas partes: ganhou uma prop `secao` ('stats' |
  'inventario') que decide qual metade do JSX renderizar. Como as duas
  abas nunca ficam montadas ao mesmo tempo (só uma aba renderiza por
  vez), a instância de `Montaria` é desmontada/remontada a cada troca
  de aba — busca os itens de novo toda vez. Um pouco de refetch a mais,
  mas mantém tudo simples e sempre atualizado; pro tamanho de dado
  aqui, não é um problema de verdade.
- **Montaria** — só os stats dela (nome, presente, potência/
  resistência, vida/dor própria, fidelidade, config de carga).

Cada `<section>` das 4 abas é só renderizada condicionalmente
(`{abaAtiva === 'x' && (...)}`) dentro do MESMO `Personagem.jsx` — não
duplica handlers nem estado, só o JSX final é que aparece um bloco de
cada vez.

### Tabelas responsivas e botões de popup (13/07, quinta rodada)

Duas queixas de celular, resolvidas juntas:

- **Botões empilhados nos popups de criar** (`PainelShell.jsx`): o botão
  de enviar (dentro do `<form>`) e o "Cancelar" (fora dele) tinham
  larguras diferentes, sem alinhamento — ficava com cara de acidente,
  não de decisão. Separei os dois do form (o botão de enviar usa o
  atributo HTML `form="id-do-form"` pra continuar funcionando de fora)
  e agrupei num `.popup-acoes` com `flex: 1` nos dois — mesma largura,
  lado a lado, "Cancelar" com estilo secundário (contorno, sem
  preencher).
- **Tabelas "arrastando pro lado"**: a solução de Fase 7
  (`.tabela-scroll`, rolagem horizontal) resolvia o problema técnico
  mas continuava ruim de usar — ler uma linha inteira exigia arrastar.
  Troquei pela técnica clássica de "tabela responsiva": em telas até
  640px, cada `<tr>` vira um cartão empilhado, e cada `<td>` mostra o
  nome da coluna como rótulo ao lado do valor (via `content:
  attr(data-label)` no `::before` — exige um atributo `data-label="..."`
  em cada célula, adicionado nas 4 tabelas afetadas: `TabelaItens.jsx`,
  `TabelaArmas.jsx`, `EfeitoDorPopup.jsx`, e as 3 tabelas de referência
  do Rastreador de Combate). Colunas de identificador (`#`, `Carta`)
  ganharam uma classe `celula-numero` pra aparecer como destaque em vez
  de "rótulo: valor" repetitivo; a coluna de "Remover" (sem cabeçalho)
  usa `data-label=""` pra não mostrar rótulo nenhum, só o botão
  centralizado.
- Continua sendo CSS puro — sem JS novo, sem biblioteca de tabela.

### Emojis, texto e "tela presa" ao voltar (13/07, sexta rodada)

- **Emojis removidos** dos 3 itens do menu lateral (`PainelShell.jsx`) —
  ficou só texto.
- **"Minhas campanhas" → "Suas campanhas"**: pra bater com "Seus
  Personagens" (2ª pessoa nos dois, em vez de misturar 1ª/2ª pessoa
  entre as duas telas).
- **"Tela presa" ao voltar de uma ficha (só corrige na segunda
  tentativa)**: revisei `ProtectedRoute.jsx`, o link de Voltar da ficha
  e as rotas em `App.jsx` — estruturalmente todos corretos, nenhum
  aponta pro lugar errado nem guarda estado à toa. O sintoma descrito
  (conteúdo antigo na volta, resolve sozinho na segunda navegação) bate
  exatamente com um comportamento conhecido de navegador mobile: o
  **bfcache** (back/forward cache) do Safari/Chrome no celular às vezes
  restaura uma "foto" congelada da página anterior em vez de deixar o
  React rodar de novo. Corrigido em `App.jsx` com um listener de
  `pageshow` que força um reload de verdade quando detecta isso
  (`event.persisted`).
  **Sinalizando por transparência**: não consegui reproduzir a
  navegação ao vivo daqui (sandbox sem navegador de verdade) — é o
  diagnóstico mais provável dado o sintoma e a correção padrão pra esse
  caso específico, mas não é 100% garantido até você confirmar que
  resolveu. Se continuar acontecendo, me diga se: (a) troca de aba
  dentro da ficha também trava, ou só voltar de rota; (b) acontece só no
  celular ou no computador também — isso ajuda a descartar hipóteses.

### Mestre pode editar a ficha do jogador (13/07)

Antes, o dono de uma campanha vinculada só enxergava o personagem
(`pode_ver_personagem` já incluía isso desde a Fase 1) — editar era só
dono do personagem ou Admin. Migration `0008` estende as políticas de
**escrita** (insert/update/delete) da mesma forma que a leitura já
funcionava: dono do personagem, Admin, OU dono de **qualquer** campanha
onde esse personagem esteja vinculado.

- Vale pra ficha inteira, não só a tabela `personagens`: `items`,
  `weapons`, `mounts` e `personagem_habilidades` também ganharam o
  Mestre como editor — "editar a ficha" inclui itens, armas, montaria e
  habilidades, não só os campos soltos (atributos, vida/dor etc.).
- **Criar/excluir o personagem em si continua só dono/Admin** — isso não
  mudou de propósito. O Mestre edita o que já existe (inclusive
  adicionando/removendo itens, armas etc. dentro dele), mas não cria
  nem apaga o personagem inteiro.
- Duas funções novas (`e_mestre_de_campanha_do_personagem`,
  `e_mestre_de_campanha_da_montaria`) isolam a mesma lógica que já
  existia dentro de `pode_ver_personagem`/`pode_ver_montaria` — evita
  duplicar a subquery em cada política.
- No app, `Personagem.jsx` busca agora (`listarCampanhasDoPersonagem`)
  quais campanhas esse personagem está vinculado, com quem criou cada
  uma — `canEdit` passa a valer também se o usuário atual criou
  qualquer uma delas. Um aviso novo (`.aviso-mestre`, cor de destaque
  diferente do aviso de somente-leitura) aparece quando quem está
  editando é o Mestre, não o dono — pra deixar claro que não é a
  própria ficha, evitando edição em cima de personagem errado.

### Fotos, história, ordem de habilidades e perfil (13/07)

Quatro pedidos juntos, todos exigindo peças novas de infraestrutura
(Storage do Supabase nunca tinha sido usado no projeto até agora).

**Ordem de habilidades**: `personagem_habilidades` ganhou coluna
`ordem` (migration `0009`). Optei por botões de mover pra cima/baixo
(`▲`/`▼` por linha, `Habilidades.jsx`) em vez de arrastar — mais
confiável no celular, que é o foco desde a reestruturação de
navegação. `trocarOrdemHabilidades` (`dados.js`) troca a `ordem` de duas
linhas vizinhas numa tacada só.

**Storage — como ficou organizado**: um bucket só, `fotos`, público
pra leitura (URLs funcionam sem token — são fotos de personagem/item,
não é dado sensível) mas com escrita travada por RLS em
`storage.objects`, usando a pasta como critério:
```
fotos/personagem/{personagem_id}/retrato.*    -> foto do personagem
fotos/personagem/{personagem_id}/item-{id}.*  -> foto de um item dele
fotos/perfil/{user_id}/foto.*                  -> foto de perfil
```
Uma função nova, `pode_editar_personagem`, consolida num lugar só a
mesma checagem que já existia espalhada (dono, Admin, ou Mestre de
campanha vinculada — migration `0008`) — só pra Storage não duplicar a
subquery; as políticas de `items`/`weapons`/`mounts`/`personagens`
continuam como estavam, não precisaram mudar.

**Recorte assumido — foto só em item do personagem, não da montaria**:
`TabelaItens.jsx` ganhou uma prop opcional `personagemId` — só quando
ela vem preenchida (chamada feita a partir da lista de Itens do
personagem, em `Personagem.jsx`) é que a coluna de Foto aparece. As 4
chamadas feitas de dentro de `Montaria.jsx` (cavalo/bolsa/carro/
carroça) não passam essa prop, então não têm foto. Motivo: a RLS de
Storage só sabe validar dono por personagem (`pode_editar_personagem`),
não por montaria — daria pra estender, mas não parecia valer a
complexidade extra pra foto de item de cavalo. Se fizer falta, dá pra
adicionar depois (`e_mestre_de_campanha_da_montaria`, que já existe
desde a migration `0008`, cobre esse caso).

**Componente único de upload**: `UploadFoto.jsx` (`components/`, fora
de `personagem/` porque também é usado no Perfil) — recebe um
`caminho` (sem extensão, adicionada a partir do arquivo escolhido),
faz upload com `upsert: true` (sobrescreve a foto anterior no mesmo
caminho em vez de acumular lixo no bucket), e devolve a URL pública com
`?t={timestamp}` no final só pra evitar que o navegador mostre a foto
antiga em cache depois de trocar. Reaproveitado em 3 lugares: retrato do
personagem, foto de item, foto de perfil — 3 tamanhos via prop
`variante` (retrato/quadrada/pequena).

**Descrição/História**: campo novo (`personagens.descricao_historia`),
textarea simples via `CampoEditavel` (que ganhou uma prop `placeholder`
nova, não existia antes). Sem regra nenhuma, é só texto livre.

**Editar Perfil**: tela nova (`/perfil`, `EditarPerfil.jsx`) — nome de
exibição e foto. A RLS (`profiles_update_own_or_admin`) já permitia o
usuário editar a própria linha desde a Fase 1; só faltava a tela.
`AuthContext.jsx` ganhou `refreshProfile()` (novo) — depois de salvar
nome/foto, recarrega o profile no contexto pra "Bem-vindo, X" e o resto
do app já refletirem sem precisar de F5.

### Foto quebrando o layout (13/07, correção)

A prévia usava `<img>` — se o CSS de tamanho falhar por qualquer motivo
(um `<img>` sempre tem um jeito de "vazar" pro tamanho natural se algo
não travar direito), a imagem aparece no tamanho original e quebra a
tela toda, como aconteceu. Duas correções, uma em cada ponta:

- **Exibição**: a prévia virou uma `<div>` com `background-image` +
  `background-size: cover` em vez de `<img>`. Uma div só tem o tamanho
  que o CSS mandar (`width`/`height` da variante — retrato/quadrada/
  pequena) — não tem "tamanho natural" pra vazar pra ele. Isso já
  corrige a exibição de fotos que **já foram enviadas** antes dessa
  correção, sem precisar reenviar nada.
- **Upload**: `UploadFoto.jsx` agora redimensiona a imagem num
  `<canvas>` antes de enviar (trava o maior lado em 400px, mantendo
  proporção, e comprime pra JPEG) — pras próximas fotos não ocuparem
  espaço à toa no Storage nem demorarem pra subir.

### Bug de RLS (reordenar habilidades) e recorte de foto (13/07)

**Bug real, não só falta de sincronismo**: reordenar habilidades dava
"Cannot coerce the result to a single JSON object". Causa:
`personagem_habilidades` tinha políticas de select/insert/delete desde
que foi criada (migration `0003`), mas **nunca** ganhou uma de update —
não tinha feito falta até a função de reordenar (migration `0009`)
existir. Sem política de update, o Postgres bloqueia silenciosamente
(0 linhas afetadas por RLS) em vez de dar um erro de permissão
explícito — e `.select().single()` logo depois, ao receber 0 linhas,
gera esse erro do PostgREST. Corrigido em `0010` com a mesma regra das
outras políticas da tabela (dono, Admin, ou Mestre de campanha
vinculada).

**Foto — revisão de interação**: antes tinha um texto "Escolher foto"/
"Trocar foto" sempre visível do lado do quadro. Agora:
- O quadro/foto em si é um `<button>` clicável — sem texto ocupando
  espaço, sobrou espaço pra aumentar o quadro pequeno (usado na tabela
  de Itens): 2.6rem → 3.4rem.
- Clicar abre um menu pequeno (`popup-caixa--menu`): "Ver em tamanho
  grande" (só se já tiver foto), "Adicionar/Trocar foto", "Remover
  foto" (só se já tiver foto). "Ver em tamanho grande" abre um lightbox
  simples (`<img>` centralizada sobre um fundo escuro). "Remover" só
  limpa o campo no banco (`foto_url = null`) — não apaga o arquivo do
  Storage, o custo de deixar órfão é baixo e evita complicar com mais
  uma política de delete condicional.
- **Recorte estilo Instagram** (`RecortarFoto.jsx`, novo): ao escolher
  um arquivo, abre um quadro fixo (260px) com a foto por trás —
  arrasta pra posicionar, range de zoom (1x-3x) pra aproximar. O
  arraste é travado (`clamp`) pra nunca deixar espaço vazio aparecer
  dentro do quadro (mesma lógica do Instagram: não dá pra "soltar" a
  foto pra fora da área visível). Confirmar desenha só a região visível
  num `<canvas>` de saída (400px) e gera o JPEG que sobe pro Storage —
  o redimensionamento automático sem controle do usuário (que existia
  antes) saiu, porque agora o próprio recorte já define o
  enquadramento final.

### Assistências e Mortes (13/07)

Dois campos numéricos simples (`assistencias`, `mortes`) na seção
Combate, junto de Iniciativa/Defesa — sem regra nenhuma, só contadores
que o jogador anota manualmente.

### Reforço visual e emojis (13/07)

Pedido: pegada mais "velho oeste", elementos baseados no próprio
Sacramento, sem emoji. Auditei o projeto inteiro com um script (não só
"olhando") pra achar todo emoji de verdade, distinguindo de setas de
navegação (`←`) que uso de propósito e não contam.

- **Removidos**: ícones tipo "caderninho de app" que tinham entrado em
  itens de menu antes (livro, aperto de mão, engrenagem — já tinham
  saído numa correção anterior) — confirmado que não sobrou nenhum.
- **Mantidos, por pedido explícito**: `✕` (fechar o menu lateral) e
  `⚔` (Rastreador de Combate, no título e no link da campanha) — são
  ícones monocromáticos simples, não emoji colorido de app, e o pedido
  foi manter esses dois especificamente.
- **Botões ganharam tratamento de "carimbo"**: maiúsculas + letter-
  spacing + peso 600 (antes eram só texto normal) — mais perto de um
  cartaz/documento oficial do que um botão de app comum.
- **Divisor entre seções da ficha** ganhou um pequeno losango
  centralizado na linha tracejada (`.ficha section::before`) — detalhe
  discreto, não é emoji nem imagem, só CSS.
- **Selo de estrela** (`EstrelaXerife.jsx`) — SVG desenhado (não
  emoji), ao lado de "Sacramento RPG" no cabeçalho do Painel.
- **Marca "Sacramento"** no rodapé (Painel e ficha) — mesmo tratamento
  do rodapé de cada página do livro impresso: nome do sistema em
  versalete, bem espaçado, discreto (baixa opacidade). `.marca-
  sacramento` no CSS.

### Painel virou dashboard, e-mail com cópia (13/07)

Duas peças que faltavam, vistas na mesma imagem: a tela inicial estava
quase vazia (só "Bem-vindo, X"), e Editar Perfil não tinha e-mail.

- **`Painel.jsx`**: agora busca (igual `PainelPersonagens`/
  `PainelCampanhas` já faziam) personagens, campanhas criadas, campanhas
  que participa e convites pendentes, e mostra: retrato + nome (com
  link pra Editar Perfil — não duplica a edição aqui, só um resumo),
  alerta destacado se tiver convite pendente, 3 cartões de contagem
  (Personagens / Campanhas criadas / Participa), e a lista de campanhas
  direto na tela — sem precisar entrar em "Suas Campanhas" só pra ver
  os nomes.
- **`EditarPerfil.jsx`** ganhou o campo de e-mail — só leitura (o
  e-mail de login não é editável por aqui, mudar e-mail de autenticação
  exige confirmação por link, fora do escopo pedido) com botão de
  copiar (`navigator.clipboard`, com fallback avisando se o navegador
  bloquear). `profiles.email` já era preenchido automaticamente no
  cadastro desde a Fase 1 (trigger `handle_new_user`), só faltava
  mostrar.

**Atualização (13/07, mesmo dia — desenho de referência mandado
depois)**: o parágrafo acima já não reflete o estado atual —
`EditarPerfil.jsx` **foi removido**. Motivo: o pedido seguinte (com um
desenho mostrando foto+nome+e-mail+contadores todos numa tela só)
deixou claro que a divisão em 2 telas (Painel resumo + Editar Perfil
separado) não era o que fazia sentido pro fluxo — ter as duas era
redundante. Consolidado tudo em `Painel.jsx`:

- Foto (editável), nome (input + "Salvar" ao lado, sem popup/tela
  separada) e e-mail (só leitura + copiar) ficam juntos no topo.
- Os contadores (Convites pendentes / Personagens / Campanhas criadas /
  Campanhas que participa) viraram uma **lista simples de números**
  (`.painel-contadores`) — de propósito **sem link nenhum** (pedido
  explícito: "não quero links, apenas contadores"). Antes eram cartões
  clicáveis que levavam pra `/painel/personagens` e `/painel/campanhas`
  — isso saiu. Navegação de verdade continua só pelo menu lateral.
- **"Sair" saiu do cabeçalho compartilhado** (`PainelShell.jsx`, que
  aparecia em toda tela do Painel) e só existe na tela inicial agora —
  pedido explícito também.
- Rota `/perfil` e o item "Editar Perfil" do menu foram removidos
  (`App.jsx`, `PainelShell.jsx`) — não tinham mais função, tudo que
  faziam já está na tela inicial.

### Painel — acesso de qualquer tela, layout e Logout (13/07, 3ª rodada)

Consolidar tudo em `Painel.jsx` (rodada anterior) teve um efeito
colateral não previsto: sem "Editar Perfil" no menu, essa informação só
era alcançável voltando pra `/painel` manualmente — de qualquer outra
tela (ficha, campanha, Seus Personagens) não tinha como chegar lá.
Corrigido:

- **"Perfil" voltou ao menu lateral** (`PainelShell.jsx`), primeiro
  item da lista, apontando pra `/painel` — a MESMA tela consolidada de
  antes (não recriei uma tela separada), só restaurando o acesso via
  menu.
- **Layout**: foto foi de "quadrada" (4rem) pra "retrato" (6.5rem —
  maior), nome/e-mail ficaram menores (nome: 1.3rem → 1.05rem; e-mail:
  ganhou `font-size: 0.8rem`) ao lado dela. O bloco de perfil e a lista
  de contadores ganharam `max-width: 420px; margin: 0 auto` — antes
  esticavam pra largura toda do `.painel` (720px), agora ficam
  centralizados como um cartão, mais organizado.
- **"Sair" → "Logout"**, com classe própria (`.botao-logout`) em vez de
  `.botao-secundario` — fundo vermelho (`--cor-sangue`), mais largura,
  centralizado — pedido explícito de ficar "um pouco mais destacado".

### Painel — centralização, largura dos contadores, convites com ação (13/07, 4ª rodada)

- **Foto descentralizada**: `.painel-perfil` tinha `flex-wrap`, mas
  nenhum `justify-content` — quando a tela é estreita o bastante pra
  foto+nome/e-mail quebrarem linha, a foto ficava sozinha na linha de
  cima **encostada à esquerda** (padrão do flexbox sem
  `justify-content`). Adicionado `justify-content: center`.
- **Números colados no texto**: `.painel-contadores` e seus `<li>` não
  tinham `width: 100%` explícito — dependiam só do comportamento padrão
  de `align-items: stretch` de um flex column, que aparentemente não
  bastou (ou algo no fluxo ao redor interferiu). Adicionado `width:
  100%` explícito nos dois, garantindo que o `justify-content:
  space-between` de cada linha realmente tenha os 420px inteiros pra
  empurrar o número até a ponta.
- **"Convites pendentes" virou o único contador clicável**: um número
  sozinho não serve pra nada num convite — precisa poder aceitar ou
  recusar. Os outros 3 (Personagens, Campanhas criadas, Campanhas que
  participa) continuam só números — não existe "ação" possível neles
  a partir daqui, então não ganharam popup. Clicar em "Convites
  pendentes" abre um popup com a lista de verdade (mesma lógica de
  `PainelCampanhas.jsx`: Aceitar navega pra campanha, Recusar recarrega
  a lista) — o `<li>` continua com a MESMA aparência dos outros
  (rótulo à esquerda, número à direita), só que agora é um `<button>`
  por dentro em vez de só texto.

### Rodada de melhorias gerais (13/07) — visual, UX, mecânica e técnico

Depois de eu listar sugestões de melhoria (visual incomodando sem saber
nomear o quê, UX, mecânica, técnico), você pediu pra implementar a
lista quase inteira de uma vez (ficaram de fora, por pedido: rolagem de
dados, duplicar personagem, busca/filtro — não estavam na lista que
você reenviou). Registro tudo numa seção só porque foi tudo na mesma
leva.

**Auditoria de RLS (migration `0012`)** — feita com um script Python
comparando toda política existente (select/insert/update/delete) de
TODAS as tabelas contra toda operação que `dados.js` realmente chama,
não só "olhando". Achou mais duas lacunas iguais à de
`personagem_habilidades` (migration `0010`): `campanha_personagens`
nunca teve UPDATE, `profiles` nunca teve INSERT nem DELETE. Nenhuma das
duas é bug ativo hoje (nada tenta fazer essas operações agora — perfis
são criados por trigger, o vínculo campanha-personagem nunca precisou
de update) — são exatamente o tipo de lacuna que só aparece quando
alguém tenta pela primeira vez, como já tinha acontecido. Fechadas com
`is_admin()` (profiles) ou a mesma regra do insert/delete (campanha_
personagens). Rodando o script de novo depois da migration: zero
lacunas em todas as 11 tabelas.

**`window.confirm()` substituído em todo o app** — 9 ocorrências em 7
arquivos (`TabelaArmas`, `Montaria`, `TabelaItens` ×2, `Habilidades`,
`UploadFoto`, `Combate` ×2, `CampanhaDetalhe`). Componente novo,
`PopupConfirmar.jsx`, reutilizado em todos. Como o React não pausa
esperando clique (diferente do `confirm()` nativo, que é bloqueante),
cada tela guarda em estado local QUAL item está pendente de confirmação
e só executa a ação de verdade dentro do `onConfirmar`.

**Tokens visuais** (`:root`, `global.css`) — `--radio-padrao` (6px,
substituiu 4px/6px/8px espalhados, 25 ocorrências unificadas),
`--divisor-forte` (2px dashed, separação entre seções maiores),
`--divisor-sutil` (1px solid, separação entre itens de lista). Aplicado
via script, não um por um.

**Hierarquia de botões** — `.botao-remover` (vermelho) já existia mas
não estava em todo canto; agora também no "Remover" de personagem
vinculado (`CampanhaDetalhe.jsx`) e no "Recusar" de convite
(`PainelCampanhas.jsx`, alinhado ao mesmo `.botao-secundario` que
`Painel.jsx` já usava).

**Toast reutilizável** — `toastBus.js` (pub/sub bem simples, sem
Context/Provider) + `ToastHost.jsx` (montado uma vez em `App.jsx`).
Qualquer lugar chama `mostrarToast('mensagem')`. Só troquei os dois
avisos ad-hoc que já existiam em `Painel.jsx` (nome salvo, e-mail
copiado) — **não** varri o app inteiro trocando cada salvamento
silencioso, porque a maioria dos `onSalvar` de hoje não devolve
sucesso/erro pro chamador (só trata o erro internamente); fazer isso
direito em todo lugar seria um refactor bem maior do contrato dessas
funções. Fica pronto pra usar aos poucos.

**Densidade da tabela de Armas** — Peso/Dano/Tipo saíram da linha
principal e viraram uma linha de "Detalhes" expansível por arma (toggle
▾/▲). Nome/Transporte/Munição (o que se consulta durante o jogo)
continuam sempre visíveis.

**Acento de cor por categoria** — `.ficha h2` ganhou uma borda lateral
colorida (`ficha-acento-geral/combate/inventario/montaria`), reaproveitando
cores já existentes na paleta (couro/sangue/poeira/tinta-suave) — sem
cor nova, só usando cada uma com mais intenção.

**Badge de convite pendente** — `PainelShell.jsx` busca a contagem de
convites (só a contagem, não a lista) e passa pro `BotaoHamburguer`
(prop `badge`, bolinha vermelha no canto). Resolve "só descubro
entrando no Painel" sem precisar de push notification de verdade.

**Foto órfã no Storage** — `UploadFoto.jsx`: ao remover uma foto, agora
apaga o arquivo de verdade do bucket (`supabase.storage.remove`), não
só limpa o campo no banco. Falha nessa limpeza é silenciosa de
propósito (não deve travar a remoção do campo por causa disso).

**Tooltip da munição** — botão "?" em `MunicaoPool.jsx` abre um popup
(reaproveita `PopupReferencia.jsx`, do Rastreador de Combate) explicando
capacidade × excedente em linguagem direta.

**PWA básico** — `manifest.json` + `sw.js` (service worker) +
ícones novos (`icon-192.png`/`icon-512.png`, gerados com o motivo da
estrela da paleta do app) + registro em `main.jsx`. **Importante
entender o alcance real**: só o ESQUELETO do app (HTML/CSS/JS) fica em
cache, pra abrir instalado/offline — os DADOS (fichas, campanhas,
combate) são sempre buscados ao vivo do Supabase, nunca ficam em cache.
Isso não é "editar sem internet e sincronizar depois" (exigiria fila de
sincronização e resolução de conflito — projeto bem maior); é só "o
app abre e a tela aparece mesmo numa mesa sem wi-fi", que resolve o
problema mais citado sem virar um projeto à parte.

**Histórico de mudanças — versão mínima, não o log completo**: como
expliquei antes, um log de verdade (o que mudou, quando, quem mudou)
exige decisões que não estavam claras (o que logar, por quanto tempo
guardar, mostrar onde) — não tentei adivinhar isso sozinho. O que
entra agora é bem mais simples: `personagens.updated_at` **já existia**
desde a Fase 1 (atualizado sozinho por trigger a cada UPDATE) — só
nunca tinha sido exibido. Agora aparece "Última alteração: dd/mm/aaaa,
hh:mm" no rodapé da ficha. Não diz O QUE mudou, só QUANDO — se quiser
o log de verdade (com o quê), é um projeto à parte pra decidir o
escopo certo.

### Tabela de Armas desalinhada, e Combate ligado a personagens de verdade (13/07)

**Tabela "em escada"**: os botões da linha (−1/+1/Recarregar, o
"Detalhes ▾" novo, e "Remover") tinham alturas diferentes (uns com
`height: 2rem` explícito, outros sem nenhuma altura fixa), e as células
da tabela não tinham `vertical-align` definido — cada célula alinhava
pelo próprio conteúdo, criando o efeito de degrau. Corrigido com
`vertical-align: middle` em todas as células de `.tabela-ficha`, e
altura consistente (2rem) nos botões que estavam sem.

**Combate ligado a personagens de verdade (migration `0013`)**: até
aqui, `combate_entradas` era sempre um bloco de stats digitado na hora,
sem referenciar `personagens.id` de propósito (decisão documentada
desde a criação do Rastreador). Pedido novo: puxar os jogadores da
campanha já com Vida/Dor atualizados, e que uma mudança na ficha do
jogador reflita sozinha no combate.

A solução **não foi sincronização** — foi eliminar a cópia. Coluna
nova `combate_entradas.personagem_id` (nullable, `on delete set null`):
quando setada, a entrada não guarda Vida/Dor próprios — o app lê e
escreve DIRETO em `personagens` (mesma linha que a ficha do jogador
usa). Não tem como "dessincronizar" porque não existem duas cópias, só
uma linha vista de dois lugares. `listarCombateEntradas`/
`criarCombateEntrada`/`atualizarCombateEntrada` (`dados.js`) agora
embutem esse personagem ligado na mesma consulta (`select('*,
personagem:personagens(...)')`), sem precisar de busca separada.

- **"Importar jogadores da campanha"** (botão novo em `Combate.jsx`) —
  busca todo personagem vinculado à campanha (`listarPersonagensDaCampanha`,
  já existia) que ainda não está na lista, e cria uma entrada ligada pra
  cada um (`tipo: 'jogador'`, iniciativa 0 — o Mestre rola/ajusta na
  hora). Não existe seletor pra escolher quais importar — traz todos de
  uma vez; se algum não for pra este combate específico, é só "Remover"
  depois (remove só a entrada, não mexe no personagem).
- **Vida/Dor**: `vidaAtualDe`/`vidaMaxDe`/`dorAtualDe`/`dorMaxDe`
  (funções auxiliares em `Combate.jsx`) leem do `entrada.personagem`
  embutido quando existir, senão da própria entrada (NPC). `ajustarVida`/
  `ajustarDor` ramificam do mesmo jeito na escrita: entrada ligada chama
  `atualizarPersonagem` (escreve na ficha de verdade); NPC continua
  chamando `atualizarCombateEntrada`, como sempre foi.
- **"Ajustar máximos"**: pra entrada ligada, Vida máx./Dor máx. ficam
  **escondidos** (só um aviso: "ajuste na própria ficha") — esses
  valores vêm dos Atributos do personagem; deixar o Mestre sobrescrever
  isso pelo Combate ficaria inconsistente com a ficha. Balas máx.
  também some (personagem ligado usa a lista de armas de verdade, não
  o campo solto de NPC). Iniciativa continua editável nos dois casos —
  é específico de cada combate, não existe na ficha.
- **Armas**: mostradas como referência (nome + munição atual/máx. de
  cada arma), buscadas em lote (`listarArmas`, uma vez por personagem
  único entre as entradas ligadas, não uma vez por entrada). **Só
  leitura no Rastreador** — editar arma/munição continua sendo na
  própria ficha do personagem; não construí um −1/Recarregar por arma
  aqui dentro pra não duplicar a UI que já existe em `TabelaArmas.jsx`
  com mais contexto (transporte, pool de reserva etc.).
- **O que "ao vivo" quer dizer, com precisão**: é a mesma linha do
  banco — não existe um mecanismo empurrando updates entre pessoas/abas
  em tempo real (isso exigiria Realtime do Supabase, que não está
  configurado). Se o jogador mexer na própria ficha enquanto o Mestre
  está com o Rastreador aberto em outra aba, o Mestre só vê o valor novo
  na próxima vez que a tela recarregar dados (F5, reentrar na tela, ou
  importar de novo) — nunca um valor desatualizado sendo mostrado como
  se fosse atual, só não atualiza sozinho no meio da tela aberta.

### Rodada de melhorias do Combate, Catálogo e Trilha (13/07)

**Rastreador de Combate**:
- **Combatente caído mais dramático**: além da borda vermelha, o card
  inteiro agora escurece e dessatura (`filter: grayscale(0.7); opacity:
  0.7;`) — mais fácil notar batendo o olho rápido na tela.
- **Turno atual e Rodada**: guardados na CAMPANHA (`campanhas.
  combate_turno_index`, `combate_rodada` — migration `0014`), não como
  estado local do React — se a página recarregar no meio da sessão, o
  Mestre não perde o lugar. "Próximo turno" avança o índice; ao
  ultrapassar o último da lista, volta pro primeiro E soma 1 na
  Rodada (é assim que "uma rodada" é definida: todo mundo agiu uma
  vez). Rodada também pode ser ajustada manualmente (+1/−1). Encerrar
  o combate zera os dois de volta.
- **Desfazer**: diferente do resto do app, ajustar Vida/Dor no combate
  não pede confirmação antes (atrapalharia o ritmo da mesa) — em troca,
  guarda o valor de ANTES por 6 segundos numa barra fixa no rodapé.
  Só a ÚLTIMA mudança pode ser desfeita (não é um histórico), e só
  ajustes de Vida/Dor registram isso — editar Iniciativa ou Máximos
  não passa por aqui.

**Busca no inventário** (`TabelaItens.jsx`): campo de busca (só aparece
com mais de 3 itens) filtra a EXIBIÇÃO da tabela; a carga usada/limite
continuam somando todos os itens sempre — filtrar a lista visível não
pode "esconder" peso da conta.

**Catálogo de Equipamento** — nova aba "Catálogo de Equipamento" no
menu da ficha, abre um popup de leitura. Decisão técnica importante:
em vez de renderizar o PDF no navegador (`react-pdf`/pdf.js exigem um
"worker" script à parte, com configuração que eu não conseguiria testar
de verdade daqui, só compilar), as 14 páginas do PDF enviado foram
convertidas UMA VEZ em imagem (`pdftoppm`, 130dpi) e ficam em
`public/catalogo/pagina-01.jpg` a `pagina-14.jpg`, servidas como
arquivo estático — simples e garantido de funcionar, ao custo de não
poder selecionar/copiar texto de dentro do catálogo (só imagem). O
leitor (`LeitorCatalogo.jsx`) é só isso: uma imagem por vez, Anterior/
Próxima (também funciona com as setas do teclado), com uma transição
leve de "virar página".

**Trilha de Redenção** (migration `0015`, tabela nova
`personagem_trilha_passos`) — conteúdo das 6 trilhas (Vingança, Fuga,
Dívida, Remorso, Recomeço, Ambição) extraído do PDF enviado, cada uma
com 6 passos fixos. Decisões:
- **Uma trilha ativa por vez** (o livro é explícito: "representada por
  UMA das Trilhas") — escolher uma nova apaga os passos da anterior
  (com confirmação, já que perde o progresso).
- **Passos são editáveis, não só uma checklist fixa** — o texto padrão
  do livro tem lacunas tipo "(nome)"/"(assassinou/sequestrou)" que o
  livro pede explicitamente pra preencher com a história de cada
  personagem; por isso cada passo é um textarea (começa com o texto
  padrão, o jogador ajusta), com um checkbox separado pra marcar
  concluído.
- **Ao completar os 6 passos, a recompensa é só CELEBRADA, não
  aplicada sozinha**: mostra "+1 Habilidade, +2 de Vida, carta extra
  na Iniciativa", mas não adiciona uma Habilidade automaticamente (é
  o jogador que escolhe QUAL) nem mexe em Vida máx. direto (isso já é
  calculado a partir de Atributo — sobrescrever aqui ia ficar
  inconsistente com esse cálculo). O jogador aplica manualmente nas
  abas correspondentes depois de ver a mensagem.
- RLS: mesma regra de sempre pra dado de personagem (dono, Mestre de
  campanha vinculada, ou Admin) — auditoria (script da migration
  `0012`) reconfirmada depois, incluindo a tabela nova.

### Realtime, Proteção, Explosivos, Convite por nome, e 3 ajustes visuais (13/07)

**Realtime (migration `0016`)** — `alter publication supabase_realtime add table ...` pra `personagens` e
`combate_entradas`. `Combate.jsx` se inscreve num canal que recarrega os
dados (silenciosamente — sem piscar "Carregando...") quando:
- Qualquer linha de `combate_entradas` desta campanha muda (`filter:
  campanha_id=eq.{id}`).
- Um `personagens` **especificamente ligado a este combate** é
  atualizado (`filter: id=in.(...)`, construído a partir dos
  `personagem_id` das entradas atuais — **não** um filtro vazio, que
  recarregaria a tela toda vez que QUALQUER personagem do banco
  mudasse, de qualquer campanha). O filtro só se reconstrói quando o
  CONJUNTO de personagens ligados muda (import/remoção) — não a cada
  ajuste de Vida/Dor. Debounce de 400ms evita recarregar em excesso se
  vários campos mudarem quase juntos.
- RLS continua valendo pra Realtime — só chega evento pra quem já teria
  permissão de SELECT naquela linha.

**Proteção (migration `0017`)** — `items` ganhou `reducao_dano`,
`limite_dano_max`, `limite_dano_atual`. Seção "Proteção ▾" expansível
por item (mesmo padrão de "Detalhes" da tabela de Armas), com botão de
usar (−1 no limite) e "Consertar" (enche de volta). **Escopo
deliberadamente contido**: só os campos existem e são editáveis —
aplicar a redução automaticamente no dano recebido (e decrementar o
limite sozinho) continuaria sendo uma automação de fluxo de combate
maior, não construída agora; por ora é o jogador/Mestre que ajusta
manualmente, igual outras mecânicas do app já funcionam.

**Explosivos e Dano em área** — popup de referência (mesmo padrão de
Iniciativa/Dor) com o texto de área de efeito, alcance da metralhadora
por Ação de Combate, regra do "1 no dado" de explosivo, e Canhão.
Ferramenta nova "Dano em área" no Rastreador: escolhe quem foi
atingido (checkboxes) e um valor de dano, aplica em todos de uma vez
(reaproveita `ajustarVida` pra cada alvo — mesma ramificação
personagem-ligado/NPC, mesmo desfazer, só que o desfazer, como sempre,
só lembra da ÚLTIMA mudança).

**Convite por nome** — `buscarUsuarioPorNomeOuEmail` (`dados.js`) usa
`.or('display_name.ilike.%termo%,email.ilike.%termo%')` em vez do
antigo `.ilike('email', ...)` sem wildcard (só batia exato). RLS já
permitia (`profiles_select_all_authenticated`, `using (true)`) — nenhuma
policy nova precisou ser criada, só a consulta mudou.

**Três ajustes visuais**:
- **Trilha de Redenção com cara de "Carta de Sina"** (nome que o livro
  usa pro marco de passo concluído) — cada passo ganhou um índice de
  canto (como o número de uma carta) e um selo circular quando
  concluído, com borda dupla lembrando uma carta/ficha em vez de um
  formulário genérico.
- **Esqueletos de carregamento** (`Esqueleto.jsx`, componente
  reutilizável) — bloco cinza pulsando no lugar de "Carregando..." em
  texto solto. `EsqueletoFicha` (composto) usado na ficha do
  personagem (a tela com mais dado pra buscar de uma vez); as listas de
  Personagens/Campanhas ganharam a versão simples (linhas soltas).
- **Efeito de "livro de verdade" no Catálogo** — sombra em camadas
  (simula uma pilha de páginas atrás da atual) + um degradê sutil na
  borda esquerda da imagem (sugere a lombada) — tudo via CSS, sem
  biblioteca de flip 3D.

### Experiência do Mestre e reforço visual (13/07)

Até aqui, todo o app era desenhado mobile-first, sem distinção entre
quem joga (normalmente no celular) e quem mestre (normalmente no
computador, com mais tela). Decisão consciente: o jogador continua
exatamente igual — nada mudou pra ele. As DUAS telas que o Mestre mais
usa (`CampanhaDetalhe.jsx` e `Combate.jsx`) ganharam tratamento
diferente, condicionado ao tamanho da tela, não ao papel do usuário —
ou seja, um jogador acessando essas mesmas telas num computador grande
também vê a versão mais larga; a distinção é "tamanho de tela", que na
prática coincide com "Mestre" a maior parte do tempo.

- **`.pagina-larga`** — classe nova, `max-width: 720px` (igual sempre)
  até 860px de largura; acima disso, `1100px`. Aplicada só nessas duas
  telas.
- **Cartões de personagem com vislumbre** — `CampanhaDetalhe.jsx`
  trocou a lista simples de nomes por uma GRADE de cartões (foto +
  nome + dono + barra de Vida/Dor), que reflui sozinha: 1 coluna no
  celular, várias lado a lado em tela larga. `listarPersonagensDaCampanha`
  (`dados.js`) foi estendida com `foto_url` e os 4 campos de Vida/Dor
  pra alimentar isso sem precisar de uma consulta extra.
- **`BarraVidaDor.jsx`** (componente novo) — barra visual em vez de só
  o número "3/6", reaproveitada nos cartões da campanha E no
  Rastreador de Combate (ali, como um complemento visual aos botões
  −1/+1 que já existiam, não uma substituição).
- **Rastreador de Combate em 2 colunas** em telas largas
  (`.lista-combate`, media query) — cada combatente já é bem denso de
  informação (Vida, Dor, munição, armas de referência); 2 colunas
  aproveita a tela grande sem espremer demais cada cartão.
- **"Rastreador de Combate" virou botão** (`.botao-like-link`) em vez
  de link solto em texto — é a ação mais importante do Mestre nessa
  tela, merecia mais destaque visual.
- **Sombra sutil em todos os cartões de lista** (`.lista-cards li`,
  já usada em várias telas) — mesmo toque de profundidade que os
  cartões novos de personagem, pra ficar consistente em vez de só as
  telas novas parecerem "mais bonitas".

### Realtime bidirecional, testes, e mais melhorias pro Mestre (13/07)

**Realtime na outra direção** — `Personagem.jsx` ganhou o espelho do
que já existia em `Combate.jsx`: se inscreve num canal ouvindo UPDATE
na própria linha (`filter: id=eq.{id}`) e aplica `payload.new` direto
no estado (sem re-buscar) quando o Mestre mexe em algo (ex.: dano em
área no Rastreador). Com isso as duas telas se atualizam sozinhas nos
dois sentidos.

**Primeira leva de testes automatizados** — Vitest instalado
(`npm test` roda tudo), `src/lib/regras.test.js` com 44 casos cobrindo
toda `regras.js`: quebra de resistência (incluindo quebra dupla numa
tacada só, e o corte quando a Vida chega a 0), stats derivados,
espaço/capacidade de montaria, limites de transporte de arma
(inclusive o caso de borda de uma arma "trocar" pro mesmo meio que já
tinha, sem contar a si mesma no limite), peso de munição excedente, e
recarga. Cobre só `regras.js` de propósito — é onde a regra de negócio
de verdade está concentrada; o resto do app é majoritariamente CRUD +
RLS, que a auditoria de RLS (script à parte, não Vitest) já cobre
melhor do que teste unitário cobriria.

**Categoria de item (migration `0018`)** — `items.categoria` (enum:
munição/arma branca/comida/roupa/remédio/ferramenta/outro).
`IconeCategoria.jsx` — forma + cor por categoria, SVG desenhado (não
emoji), ao lado do nome na tabela de Itens. Seletor de categoria só
aparece quando editável.

**Estado vazio com mais cuidado** — `EstadoVazio.jsx` (caixa
tracejada + selo de estrela discreto) substitui o texto solto em Seus
Personagens, Suas Campanhas, e no Rastreador de Combate.

**Cartão de personagem expansível + visão em tabela** (`CampanhaDetalhe.jsx`)
— toggle Cartões/Tabela (`modoVisualizacao`). No modo cartão, "Mais
detalhes ▾" expande mostrando dinheiro, munição (leve/pesada, soma da
capacidade das armas — buscada sob demanda, só quando expande pela
primeira vez, não pra todo mundo de antemão) e última alteração.
`listarPersonagensDaCampanha` ganhou `dinheiro` e `updated_at` na
mesma consulta. Modo tabela: Nome/Jogador/Vida/Dor compactos, melhor
pra campanhas com mais gente.

**Atalhos de teclado no Rastreador de Combate** — espaço ou → avança o
turno (mesma função do botão "Próximo turno", incluindo o
incremento de rodada ao dar a volta); ← volta um turno (função nova,
`voltarTurno`, que de propósito NÃO mexe na rodada — a ambiguidade de
"voltar" também deveria descontar rodada não parecia valer a
complexidade). Ignora os atalhos quando o foco está num campo de
texto/número/select (senão apertar espaço editando o nome de uma arma
"roubaria" o espaço do texto).

### Estrutura e visual pro Mestre — modo Sessão/Preparação, notas, breadcrumb, tema escuro (13/07)

Nota sobre esta seção: ao começar essa rodada, encontrei o componente
`Breadcrumb.jsx` e o hook `useTemaEscuro.js` (com o CSS do tema escuro
completo em `global.css`) **já existindo** no projeto, prontos mas o
tema escuro ainda não estava ligado em nenhuma tela — sinal de que
parte desse trabalho já tinha sido feita numa rodada anterior sem
constar no resumo entregue na hora. Achei um bug de import duplicado
causado por isso (corrigido) e completei o que faltava.

**Modo Sessão / Modo Preparação** (`CampanhaDetalhe.jsx`) — dois jeitos
de ver a mesma campanha, alternados por um toggle visível só pra quem
gerencia:
- **Preparação** (padrão): tudo visível — convidar jogador, vincular
  personagem, convites enviados — igual sempre foi.
- **Sessão**: esconde a parte administrativa (não faz sentido mexer em
  convite no meio de uma mesa rodando); mostra as anotações do Mestre
  em destaque.
- Os personagens da campanha (cartões/tabela) continuam visíveis nos
  dois modos — a diferença é só a parte de gestão/convite.

**Anotações do Mestre** (migration `0019`, tabela `campanha_notas_mestre`)
— rascunho persistente, sempre visível (não popup), nos dois modos.
**Tabela própria de propósito, não uma coluna em `campanhas`**: RLS é
por linha, não por coluna — se fosse uma coluna solta, todo jogador que
pudesse ver a campanha receberia esse campo também na resposta da
consulta (mesmo escondido na tela, dá pra ver no painel de rede do
navegador). Tabela separada com RLS própria (só dono da campanha ou
Admin) resolve isso de verdade. `salvarNotasMestre` usa upsert — não
precisa criar uma linha vazia pra toda campanha nova.

**Breadcrumb estendido pro Personagem.jsx** — o componente já existia
e já era usado em `CampanhaDetalhe.jsx`/`Combate.jsx`; faltava ligar
em `Personagem.jsx` de um jeito CONSCIENTE DO CONTEXTO. Quando o link
pra ficha vem de dentro de uma campanha (`CampanhaDetalhe.jsx` agora
manda `?campanha={id}` na URL), o breadcrumb mostra o NOME da campanha
no lugar de "Seus Personagens" genérico, e linka de volta pra ela — lê
`campanhasVinculadas` (já buscado pra outro propósito, o cálculo de
"é Mestre desta campanha") em vez de fazer uma consulta nova só pra
isso.

**Tema escuro** — hook `useTemaEscuro.js` (já existia) aplica/remove a
classe `.tema-escuro` no `<body>` inteiro (não só numa tela — o
fundo/textura da página é pintado no body) e lembra a escolha via
`localStorage`. Como todo o CSS já usa `var(--cor-x)`, o tema se aplica
sozinho em tudo sem duplicar regra nenhuma. Só ficou faltando CHAMAR o
hook e mostrar o botão — feito agora em `CampanhaDetalhe.jsx` e
`Combate.jsx` (as duas telas do Mestre). Sai sozinho ao trocar de tela
(o efeito limpa a classe ao desmontar) — uma tela de jogador aberta
depois não herda o tema escuro por engano.

## 7. Fluxo de autenticação

- **Cadastro aberto, sem escolha de papel**: qualquer pessoa pode se
  cadastrar (nome, e-mail, senha). Todo mundo nasce com papel `usuario`
  — "admin" vira admin só quem for promovido manualmente via SQL (passo
  8 do README).
- **Confirmação de e-mail**: por padrão o Supabase exige confirmar o e-mail
  antes do primeiro login. Isso é uma configuração do projeto
  (Authentication → Providers → Email → "Confirm email"), não do código —
  dá pra desligar durante os testes se for incômodo.
- **Redirect URLs**: pra o link de "esqueci minha senha" funcionar, o
  Supabase precisa autorizar a URL de retorno. Em Authentication → URL
  Configuration, adicione `http://localhost:5173/**` (dev) e, na Fase 8, a
  URL do Netlify também.
- **Telas**: `/login`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha`,
  e `/painel` (único painel pra qualquer papel — não existe mais rota
  "roteadora" por papel).

## 8. Campanhas, Personagens e Convites (v2)

- **`profiles.email`**: continua existindo pelo mesmo motivo de antes —
  quem cria uma campanha precisa buscar um usuário existente pra
  convidar, e `auth.users` não é consultável direto pelo cliente.
  Trade-off assumido (igual antes): todo usuário autenticado lê o e-mail
  de todo mundo — ok pra grupo fechado, dá pra travar depois com uma
  view/RPC restrita.
- **Busca por e-mail exato** (não parcial): mesma decisão de antes, pra
  não abrir brecha de descobrir e-mails de terceiros aos poucos.
- **Convite não é adição direta**: `convites` guarda status
  `pendente | aceito | recusado`. Um índice único parcial
  (`idx_convites_pendente_unico`) impede 2 convites pendentes pra
  mesma pessoa na mesma campanha ao mesmo tempo, mas permite convidar de
  novo depois de um "recusado".
- **Vincular personagem exige**: ser dono do personagem E (ser dono da
  campanha OU ter convite aceito nela) — função `tenho_convite_aceito`.
  O dono da campanha vincula os próprios personagens livremente, sem
  precisar se autoconvidar.
- **`personagens_update`/`delete` é só o dono** (ou admin) — mesmo o
  dono da campanha onde o personagem está vinculado **não edita** a
  ficha de outro usuário, só vê. Isso é diferente do modelo antigo (onde
  o Mestre podia editar qualquer ficha da própria sessão) — decisão
  tomada em 13/07 pra bater com "personagens podem alterar apenas a
  própria ficha".
- **Rotas `/campanha/:id` e `/personagem/:id`**: abertas a qualquer papel
  autenticado — quem decide o que a pessoa vê de fato é o RLS, não a
  rota (mesmo princípio de antes com `/sessao/:id`/`/ficha/:id`).
- **Consultas com "join"** (`profiles(display_name, email)` embutido
  dentro de `campanhas`/`personagens`/`convites`): usam a sintaxe de
  embedding do PostgREST, que funciona quando existe só 1 chave
  estrangeira entre as duas tabelas. Não tenho como testar isso contra
  um projeto Supabase de verdade a partir daqui — se der erro do tipo
  "more than one relationship was found", é só me colar a mensagem que
  eu ajusto a query com o nome exato da constraint.