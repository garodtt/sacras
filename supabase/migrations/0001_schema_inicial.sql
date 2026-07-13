-- =====================================================================
-- Sacramento RPG — Migração 0001: schema inicial (v2 — modelo de
-- Campanhas/Personagens, substitui o modelo antigo de Mestre/Sessão).
-- Rode este arquivo primeiro no SQL Editor do Supabase (projeto NOVO —
-- este schema não é compatível com o antigo, ver docs/ARQUITETURA.md).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUM de papéis — só existem 2 agora. "mestre" acabou: qualquer usuário
-- cria campanha e tem personagens. "admin" gerencia tudo, mas também usa
-- o site normalmente (não é mais um papel "separado" na experiência).
-- ---------------------------------------------------------------------
create type public.user_role as enum ('admin', 'usuario');

-- ---------------------------------------------------------------------
-- PROFILES — estende auth.users (Supabase Auth) com nome, e-mail e papel.
-- `email` já nasce aqui (na v1 tinha vindo numa migração separada,
-- 0003_profiles_email.sql — como este schema é novo, já entra de início).
-- ---------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  email         text not null,
  role          public.user_role not null default 'usuario',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Um registro por usuário autenticado. Criado automaticamente no signup pela trigger handle_new_user.';

-- Cria profile automaticamente quando alguém se cadastra. Papel sempre
-- "usuario" — não existe mais escolha de papel no cadastro (Cadastro.jsx
-- não pergunta mais isso). "admin" só via promoção manual por SQL.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email,
    'usuario'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- CAMPANHAS — substitui "sessions". Qualquer usuário pode criar (não só
-- um papel "mestre"). `criado_por` é o dono/gerente da campanha.
-- ---------------------------------------------------------------------
create table public.campanhas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  descricao    text,
  criado_por   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_campanhas_criado_por on public.campanhas(criado_por);

-- ---------------------------------------------------------------------
-- PERSONAGENS — substitui "character_sheets". Agora pertence só ao
-- usuário (não a uma sessão): existe independente de campanha, e depois
-- é vinculado a N campanhas (tabela campanha_personagens, abaixo).
-- Campos numéricos ficam soltos (não em jsonb) — mesmo motivo de sempre:
-- update de 1 campo sem reescrever a ficha inteira.
-- ---------------------------------------------------------------------
create table public.personagens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,

  nome text not null default '',

  -- Atributos (Condições Iniciais: 4 pontos de atributo p/ distribuir)
  atributo_fisico      int not null default 0,
  atributo_velocidade  int not null default 0,
  atributo_intelecto   int not null default 0,
  atributo_coragem     int not null default 0,

  -- Antecedentes — 1d6 + rank (rank 0 a 5, ver ficha original)
  ant_atencao    int not null default 0,
  ant_roubo      int not null default 0,
  ant_medicina   int not null default 0,
  ant_suor       int not null default 0,
  ant_montaria   int not null default 0,
  ant_tradicao   int not null default 0,
  ant_negocios   int not null default 0,
  ant_violencia  int not null default 0,

  -- Estatísticas de combate (editáveis; fórmulas de sugestão ficam no front-end)
  movimentos      int not null default 1,
  acoes_combate   int not null default 1,
  iniciativa      int not null default 0,
  defesa          int not null default 5,

  -- Círculos de vida / dor do personagem (condição inicial: 6 e 6)
  circulos_vida_max    int not null default 6,
  circulos_vida_atual  int not null default 6,
  circulos_dor_max     int not null default 6,
  circulos_dor_atual   int not null default 6,

  -- Espaço de inventário (ver docs/ARQUITETURA.md, pergunta em aberto nº2)
  espaco_max int not null default 10,

  -- Encontrados no projeto antigo mas fora da ficha impressa; mantidos
  -- como campos simples, prontos pra uso se confirmarmos que valem
  dinheiro  numeric not null default 0,
  xp_total  int not null default 0,

  habilidades text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_personagens_user on public.personagens(user_id);

-- ---------------------------------------------------------------------
-- CAMPANHA_PERSONAGENS — vínculo N:N entre personagem e campanha (um
-- personagem pode estar em várias campanhas ao mesmo tempo — decidido
-- em 13/07).
-- ---------------------------------------------------------------------
create table public.campanha_personagens (
  id            uuid primary key default gen_random_uuid(),
  campanha_id   uuid not null references public.campanhas(id) on delete cascade,
  personagem_id uuid not null references public.personagens(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (campanha_id, personagem_id)
);

create index idx_campanha_personagens_campanha on public.campanha_personagens(campanha_id);
create index idx_campanha_personagens_personagem on public.campanha_personagens(personagem_id);

-- ---------------------------------------------------------------------
-- CONVITES — "comunicação interna" (sem disparo de e-mail real). Quem
-- criou a campanha convida um usuário existente (busca por e-mail exato,
-- igual antes); o convidado aceita ou recusa no próprio painel. Só
-- permite 1 convite PENDENTE por (campanha, usuário) — depois de
-- aceito/recusado, um novo convite pode ser criado (índice parcial).
-- ---------------------------------------------------------------------
create type public.status_convite as enum ('pendente', 'aceito', 'recusado');

create table public.convites (
  id                    uuid primary key default gen_random_uuid(),
  campanha_id           uuid not null references public.campanhas(id) on delete cascade,
  usuario_convidado_id  uuid not null references public.profiles(id) on delete cascade,
  status                public.status_convite not null default 'pendente',
  created_at            timestamptz not null default now(),
  respondido_em         timestamptz
);

create index idx_convites_campanha on public.convites(campanha_id);
create index idx_convites_usuario on public.convites(usuario_convidado_id);

create unique index idx_convites_pendente_unico
  on public.convites(campanha_id, usuario_convidado_id)
  where status = 'pendente';

-- ---------------------------------------------------------------------
-- ITEMS / WEAPONS / MOUNTS — agora penduram em PERSONAGENS (não mais em
-- character_sheets/sessão). Mesma estrutura de campos de antes.
-- ---------------------------------------------------------------------
create table public.items (
  id            uuid primary key default gen_random_uuid(),
  personagem_id uuid not null references public.personagens(id) on delete cascade,
  nome          text not null default '',
  espaco        numeric not null default 0,
  na_montaria   boolean not null default false,
  ordem         int not null default 0
);

create index idx_items_personagem on public.items(personagem_id);

create table public.weapons (
  id             uuid primary key default gen_random_uuid(),
  personagem_id  uuid not null references public.personagens(id) on delete cascade,
  nome           text not null default '',
  espaco         numeric not null default 0,
  dano           text not null default '',
  tipo_dano      text,
  municao_atual  int,
  municao_max    int,
  ordem          int not null default 0
);

create index idx_weapons_personagem on public.weapons(personagem_id);

create table public.mounts (
  id                  uuid primary key default gen_random_uuid(),
  personagem_id       uuid not null unique references public.personagens(id) on delete cascade,
  nome                text not null default '',
  potencia            int not null default 0,
  resistencia         int not null default 0,
  circulos_vida_max   int not null default 6,
  circulos_vida_atual int not null default 6,
  circulos_dor_max    int not null default 6,
  circulos_dor_atual  int not null default 6,
  nivel_fidelidade    int not null default 0 check (nivel_fidelidade between 0 and 5)
);

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger trg_campanhas_updated_at before update on public.campanhas
  for each row execute procedure public.set_updated_at();
create trigger trg_personagens_updated_at before update on public.personagens
  for each row execute procedure public.set_updated_at();