# Sacramento RPG — Gerenciador de Personagens

Sistema web para gerenciar personagens do RPG de mesa **Sacramento**:
qualquer usuário cria campanhas e personagens livremente, participa de
campanhas de outros por convite, e um Admin acompanha tudo. Banco de
dados real (Supabase) por trás.

> 🚧 **Status atual: Fases 1 a 7 concluídas** — modelo de Campanhas/
> Personagens (v2), ficha de personagem completa com todas as regras
> (atributos derivados, vida/dor, inventário, munição, habilidades,
> montaria) e o visual definitivo da ficha (fontes, cores, textura de
> papel). Falta só o que ficou deliberadamente de fora até aqui:
> dinheiro, XP, munição/tipo de dano legados, histórico de alterações —
> ver as perguntas em aberto em `docs/ARQUITETURA.md`, seção 6.
> Em 13/07 o projeto também passou por uma refatoração de fundo mais
> antiga: saiu a divisão Mestre/Jogador, entrou um modelo só de
> **usuário + admin**, com **campanhas** (qualquer um cria) e
> **personagens** (vinculáveis a N campanhas, via convite). Detalhe
> completo em `docs/ARQUITETURA.md`, seção 6.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite |
| Backend / Banco | Supabase (Postgres + Auth + Row Level Security) |
| Hospedagem | Netlify |
| Editor | VS Code |

## Quem vê o quê (resumo — detalhe completo em `docs/ARQUITETURA.md`)

- **Todo usuário** cria campanhas e personagens livremente — não existe
  mais um papel "Mestre" separado.
- **Personagem**: pertence a 1 usuário; só o dono edita. Quem criou uma
  campanha (ou o Admin) também **vê e edita** os personagens vinculados
  a ela (13/07) — inclui itens, armas, montaria e habilidades, não só
  os campos soltos.
- **Campanha**: quem cria vira o "dono" — convida outros usuários por
  e-mail exato. O convidado vê o convite no próprio painel e aceita ou
  recusa (é só um registro interno — **sem disparo de e-mail real**, por
  enquanto).
- **Vínculo**: depois de aceitar, o usuário vincula um ou mais dos seus
  personagens à campanha. Um personagem pode estar em **várias
  campanhas ao mesmo tempo**.
- **Rastreador de Combate** (`/campanha/:id/combate`): só quem criou a
  campanha (ou o Admin) — é ferramenta do Mestre, participante comum
  nem vê que a tela existe.
- Por padrão, um jogador comum só enxerga os **próprios** vínculos numa
  campanha (não a lista completa de quem mais está jogando) — mesma
  lógica de privacidade que já existia antes entre jogadores.
- **Admin** (1 usuário, via promoção manual): usa o site normalmente
  como qualquer um, e tem uma tela extra (`/admin`) só de leitura com
  todas as campanhas e personagens do sistema.

Essa regra vive no banco (RLS), não só na tela — mesmo uma chamada
direta à API do Supabase (fora do site) respeita a mesma regra.

## Pré-requisitos

- [Node.js](https://nodejs.org) 18 ou mais recente
- Conta no [Supabase](https://supabase.com) (grátis)
- Conta no [Netlify](https://netlify.com) (grátis) — só precisa a partir da Fase 8
- Git + VS Code

## Setup local

**1. Abra a pasta deste projeto no VS Code.**

**2. Crie um projeto NOVO no Supabase** (este schema v2 não é compatível
com um projeto onde você já rodou as migrations antigas — se você já
tinha um projeto da v1, é mais simples criar outro do zero):
   - https://supabase.com/dashboard → **New Project**
   - Em **Settings → API**, anote a **Project URL** e a **anon public key**

**3. Rode as migrations**, nesta ordem, no **SQL Editor** do Supabase:
   1. `supabase/migrations/0001_schema_inicial.sql`
   2. `supabase/migrations/0002_rls_policies.sql`
   3. `supabase/migrations/0003_atributos_inventario_habilidades.sql` — **nova (13/07)**, precisa rodar mesmo se seu projeto já tinha 0001+0002
   4. `supabase/migrations/0004_seed_habilidades_catalogo.sql` — **nova (13/07)**, popula o catálogo com as 30 habilidades do livro
   5. `supabase/migrations/0005_combate_entradas.sql` — **nova (13/07)**, rastreador de combate do Mestre
   6. `supabase/migrations/0006_rls_performance_fix.sql` — **nova (13/07), importante**: corrige lentidão — as funções de RLS chamavam `auth.uid()` sem empacotar numa subquery (`(select auth.uid())`), fazendo o Postgres reavaliar isso a mais do que precisava
   7. `supabase/migrations/0007_armas_montaria_recompensa.sql` — **nova (13/07)**: revisão de armas (meio de transporte, tipo de dano), inventário da montaria por sub-local, dinheiro/recompensa
   8. `supabase/migrations/0008_mestre_edita_ficha.sql` — **nova (13/07)**: dono de campanha vinculada passa a poder editar a ficha do personagem (não só ver)
   9. `supabase/migrations/0009_fotos_historia_ordem.sql` — **nova (13/07)**: ordem manual de habilidades, fotos (item/personagem/perfil), história do personagem, e o bucket de Storage — **precisa de Storage habilitado no seu projeto Supabase** (vem habilitado por padrão)
   10. `supabase/migrations/0010_fix_update_habilidades.sql` — **nova (13/07), importante**: corrige bug — reordenar habilidades não funcionava porque a tabela nunca teve política de UPDATE
   11. `supabase/migrations/0011_contadores_combate.sql` — **nova (13/07)**: contadores de Assistências e Mortes

**4. Configure as variáveis de ambiente:**
```bash
cp .env.example .env
```
Abra `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os
valores do passo 2.

**5. Instale as dependências e rode o projeto:**
```bash
npm install
npm run dev
```
Abra http://localhost:5173 — agora deve aparecer a tela de **login**.

**6. Configure a autenticação no Supabase** (2 ajustes no dashboard, sem
código):
   - **Authentication → URL Configuration** → em "Redirect URLs", adicione
     `http://localhost:5173/**` (necessário para o e-mail de "esqueci minha
     senha" saber pra onde voltar).
   - **Authentication → Providers → Email** → confira se "Confirm email"
     está do jeito que você quer: ligado (padrão) exige clicar num link no
     e-mail antes do primeiro login; se for só testar rapidinho, pode
     desligar temporariamente.

**7. Teste o cadastro:** crie uma conta em `/cadastro` — agora é só nome,
e-mail e senha (não tem mais escolha de papel). Confirme o e-mail se
necessário, faça login em `/login` — você cai automaticamente em
`/painel`, ainda vazio.

**8. Crie o usuário admin** (opcional, útil pra testar a visão geral):
No **SQL Editor** do Supabase:
```sql
update public.profiles set role = 'admin' where id = '<uuid-do-usuario>';
```
O UUID aparece em **Authentication → Users**. Depois de promovido, o
painel dessa conta ganha um link extra "Visão geral (Admin)".

**9. Teste o fluxo completo** (crie uma 2ª conta de teste também):
   - Como **conta A**: no painel, crie um personagem e crie uma
     campanha. Na tela da campanha, vincule seu próprio personagem (você
     é o dono, não precisa se convidar).
   - Ainda como conta A, em "Convidar jogador", busque a **conta B** pelo
     e-mail exato e convide.
   - Faça login como **conta B**: em "Convites pendentes" no painel,
     aceite — você cai direto na página da campanha. Crie um personagem
     e vincule-o ali.
   - Volte como conta A: na campanha, você (o criador) vê os
     personagens de A **e** de B. Se logar de novo como B, note que B só
     vê o **próprio** vínculo na lista — isso é esperado (ver "Quem vê o
     quê" acima).

> ⚠️ Importante sobre senhas: o Supabase (como qualquer sistema de auth
> sério) **nunca guarda a senha em texto puro, nem para o admin ver**. Ela é
> hasheada e não é exibida em lugar nenhum, nem no dashboard. O que o admin
> pode fazer é: banir/desbanir usuário, deletar usuário, ou forçar o envio
> de um link de redefinição — não "ver a senha atual".

> ℹ️ Sobre quem pode se cadastrar: o cadastro continua aberto — qualquer
> pessoa cria conta em `/cadastro` (só nome/e-mail/senha, sem escolha de
> papel). Todo mundo nasce com papel "usuario"; "admin" só existe via
> promoção manual por SQL (passo 8 acima).

## Solução de problemas

**`Failed to fetch` / `ERR_NAME_NOT_RESOLVED` apontando para algo como
`seu-projeto.supabase.co`** — o `.env` ainda está com os valores de exemplo
do `.env.example` (ou não existe). Corrija assim:
1. Confirme que criou o projeto em https://supabase.com/dashboard (passo 2).
2. Copie a **Project URL** e a **anon public key** reais em Settings → API.
3. Abra o arquivo **`.env`** (não o `.env.example`) na raiz do projeto e
   cole os valores reais em `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. **Pare o servidor (`Ctrl+C`) e rode `npm run dev` de novo** — o Vite só
   lê o `.env` quando o servidor inicia; só salvar o arquivo com o servidor
   já rodando não tem efeito.

**Avisos do tipo "React Router Future Flag Warning" no console** — são só
avisos sobre mudanças que virão no React Router v7, não são erro. Já
deixei as flags `v7_startTransition` e `v7_relativeSplatPath` ativadas no
`App.jsx`, então elas não devem mais aparecer.

## Deploy no Netlify (Fase 8)

- Conectar o repositório GitHub ao Netlify
- Build command: `npm run build` — Publish directory: `dist`
- Adicionar as mesmas variáveis de ambiente do `.env` em
  **Site settings → Environment variables**

## Estrutura de pastas

```
sacramento-rpg/
├── .env.example
├── .gitignore
├── netlify.toml
├── package.json
├── vite.config.js
├── index.html
├── README.md
├── docs/
│   └── ARQUITETURA.md          # schema, matriz de permissões, decisões e perguntas em aberto
├── supabase/
│   └── migrations/
│       ├── 0001_schema_inicial.sql   # campanhas, personagens, convites, campanha_personagens...
│       ├── 0002_rls_policies.sql
│       ├── 0003_atributos_inventario_habilidades.sql   # regras de 13/07 (ver docs/ARQUITETURA.md)
│       ├── 0004_seed_habilidades_catalogo.sql   # as 30 habilidades do livro (combate + profissão)
│       ├── 0005_combate_entradas.sql   # rastreador de combate do Mestre (13/07)
│       ├── 0006_rls_performance_fix.sql   # corrige lentidão do RLS (auth.uid() sem (select ...))
│       ├── 0007_armas_montaria_recompensa.sql   # meio_transporte/tipo_dano, local_montaria, valor_recompensa
│       ├── 0008_mestre_edita_ficha.sql   # Mestre da campanha vinculada também edita a ficha
│       ├── 0009_fotos_historia_ordem.sql   # ordem de habilidades, fotos, história, bucket Storage
│       └── 0010_fix_update_habilidades.sql   # corrige bug: faltava política de UPDATE em personagem_habilidades
└── src/
    ├── main.jsx
    ├── App.jsx                 # rotas (react-router-dom)
    ├── lib/
    │   ├── supabaseClient.js
    │   ├── dados.js             # consultas de campanhas/personagens/convites/itens/habilidades
    │   └── regras.js            # regras de jogo puras (vida/dor, stats derivados, munição, montaria)
    ├── styles/
    │   └── global.css
    ├── contexts/
    │   └── AuthContext.jsx      # sessão, profile, papel + ações de login/cadastro/senha
    ├── components/
    │   ├── ProtectedRoute.jsx   # guarda de rota (exige login / exige papel)
    │   ├── UploadFoto.jsx       # upload de foto reutilizável (item/personagem/perfil) — novo 13/07
    │   ├── RecortarFoto.jsx     # recorte estilo Instagram (arrastar + zoom) — novo 13/07
    │   ├── EstrelaXerife.jsx    # selo de estrela em SVG (não emoji) — novo 13/07
    │   ├── layout/
    │   │   ├── MenuLateral.jsx      # drawer reutilizável (navegação OU troca de aba) — novo 13/07
    │   │   ├── BotaoHamburguer.jsx  # botão de 3 barrinhas que abre o MenuLateral — novo 13/07
    │   │   └── PainelShell.jsx      # casca das 3 telas do Painel (cabeçalho + menu + popups criar) — novo 13/07
    │   ├── combate/
    │   │   └── PopupReferencia.jsx  # shell de popup (tabelas de Iniciativa/Dor no rastreador)
    │   └── personagem/          # sub-componentes da ficha completa
    │       ├── CampoEditavel.jsx   # input com auto-save (onBlur), reutilizável
    │       ├── CampoStepper.jsx    # controle +/- (Máximo de Vida/Dor) — novo 13/07
    │       ├── TrilhaCirculos.jsx  # trilha de círculos clicável (vida/dor/antecedentes)
    │       ├── TabelaItens.jsx     # inventário (peso×quantidade, trava de carga, coldre/bandoleira)
    │       ├── TabelaArmas.jsx     # armas (categoria leve/pesada, munição, recarregar)
    │       ├── MunicaoPool.jsx     # munição de reserva (leve/pesada) — novo 13/07
    │       ├── Habilidades.jsx     # catálogo + habilidade própria — novo 13/07
    │       ├── EfeitoDorPopup.jsx  # popup da tabela de Dor, marcado na mão — novo 13/07
    │       ├── Montaria.jsx        # bloco da montaria (vida/dor, carga, inventário próprio)
    │       └── LinhaCirculosAjustavel.jsx  # +/- dos lados de Vida/Dor atual, usa lib/regras.js
    └── routes/
        ├── Login.jsx
        ├── Cadastro.jsx
        ├── EsqueciSenha.jsx
        ├── RedefinirSenha.jsx
        ├── Painel.jsx            # tela inicial (só o menu lateral leva pro resto agora)
        ├── PainelPersonagens.jsx # "Seus Personagens" — novo 13/07
        ├── PainelCampanhas.jsx   # "Minhas Campanhas" (criadas + participa + convites) — novo 13/07
        ├── EditarPerfil.jsx      # nome de exibição + foto de perfil — novo 13/07
        ├── CampanhaDetalhe.jsx   # gestão da campanha: convite + vínculo de personagem
        ├── Combate.jsx           # rastreador de combate do Mestre (iniciativa, vida/dor, munição) — novo 13/07
        ├── Personagem.jsx        # ficha completa — orquestra os componentes acima
        └── AdminDashboard.jsx    # visão macro: todas as campanhas e personagens
```

> 🔄 **13/07** — Regras novas de atributos/inventário/habilidades
> acrescentaram `CampoStepper`, `MunicaoPool`, `Habilidades` e
> `EfeitoDorPopup` em `components/personagem/`, e a migration `0003`.
> A Fase 7 (visual) mexeu nesses mesmos arquivos de novo — sem
> acrescentar componentes novos, só `src/styles/global.css` (reescrito)
> e um par de linhas de classe em `Personagem.jsx`/`TabelaItens.jsx`/
> `TabelaArmas.jsx`. Também adicionou o link de fontes no `index.html`
> (raiz do projeto, fora de `src/`).

## Roadmap

- [x] **Fase 1** — estrutura do projeto, schema SQL, RLS, scaffold React + Vite
- [x] **Fase 2** — Autenticação: login, cadastro, redefinição de senha
- [x] **Fase 3** — Criar campanha, convidar jogador, criar personagem
- [x] **Fase 4** — Painel único: personagens, campanhas (criadas/participando), convites, visão geral do Admin
- [x] **Fase 5** — Personagem completo (todos os campos da ficha original, editáveis)
- [x] **Fase 6** — Regras de jogo: Vida/Dor ("quebra de resistência", automática via botão "Sofrer dano"). Inventário/espaço não mudou — decisão de 13/07 manteve `espaco_max` como campo fixo editável (já era assim desde a Fase 5)
- [x] **Regras adicionais (13/07)** — atributos somando de verdade (Físico/Velocidade/Coragem/Intelecto), popup de Efeito de Dor marcado na mão, inventário com peso×quantidade e trava de carga real, coldre/bandoleira, munição por categoria (leve/pesada) com recarga, catálogo de Habilidades, montaria com inventário e carga próprios — ver `docs/ARQUITETURA.md`
- [x] **Fase 7** — Visual (fontes Rye + Vollkorn, paleta e textura de papel da ficha original, caixas pretas em Atributos/Itens/Armas/Nível de Fidelidade, responsivo pro celular) — ver `docs/ARQUITETURA.md`
- [x] **Rastreador de Combate (13/07)** — tela do Mestre por campanha: NPCs e jogadores numa lista por Iniciativa, Vida/Dor (mesma regra da ficha) e Balas com recarregar simples — ver `docs/ARQUITETURA.md`
- [x] **Navegação em HUD (13/07)** — Painel virou 3 telas (inicial + Seus Personagens + Minhas Campanhas) navegadas por menu lateral; a ficha ganhou abas (menu de 3 barrinhas interno) em vez de rolar tudo numa página só — ver `docs/ARQUITETURA.md`
- [x] **Mestre edita a ficha do jogador (13/07)** — dono de campanha vinculada agora edita (não só vê) o personagem, itens, armas, montaria e habilidades — ver `docs/ARQUITETURA.md`
- [x] **Fotos, história e ordem de habilidades (13/07)** — foto no personagem/itens/perfil (Supabase Storage), campo de descrição/história, ordem manual de habilidades, e tela de Editar Perfil (nome + foto) — ver `docs/ARQUITETURA.md`
- [x] **Reforço visual e sem emojis (13/07)** — botões com tratamento de carimbo, divisor de seção com losango, selo de estrela (SVG), marca "Sacramento" no rodapé; auditoria confirmou zero emoji de app (só os ícones pedidos: X e espada) — ver `docs/ARQUITETURA.md`
- [ ] **Fase 8** — Deploy no Netlify + variáveis de ambiente de produção
- [ ] **Fase 9** *(opcional, sugerido)* — Histórico de alterações do personagem

> 🔄 **13/07** — Fases 1 a 4 foram refeitas sob o modelo de
> Campanhas/Personagens (v2). O que cada fase entrega funcionalmente não
> mudou (auth, criar/gerenciar "mesas", criar ficha, visão geral do
> admin) — o que mudou foi *quem* pode fazer *o quê* e como as coisas se
> conectam. Ver `docs/ARQUITETURA.md`, seção 6, para o motivo e o antes/depois.

## Sobre o projeto antigo (`garodtt/rpg`)

Antes de propor o schema, li o código do seu protótipo anterior para entender
as regras de vida/dor e inventário que já existiam. O resumo do que encontrei
— e as perguntas que isso gerou — está em `docs/ARQUITETURA.md`, seção 5 e 7.
Resumo rápido: o protótipo antigo usava 1 tabela só (`fichas`) com senha por
ficha (sem conta de usuário de verdade); a base nova que estamos construindo
substitui isso por autenticação e papéis reais, que é justamente o que você
pediu agora.