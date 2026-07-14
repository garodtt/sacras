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
| Editar personagem | ✅ | ❌ (só vê, não edita o de outro) | ✅ (o próprio) | ❌ |
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