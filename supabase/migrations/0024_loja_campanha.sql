-- =====================================================================
-- Sacramento RPG — Migração 0024: Loja da Campanha — itens
-- customizados que o Mestre cadastra (nome, preço, peso, descrição),
-- separados do Catálogo de Equipamento fixo do livro (que já existe
-- na aba Compras). Serve pra vender coisas específicas da história
-- (armas raras, itens únicos, preços locais diferentes do catálogo
-- padrão).
--
-- Acesso (ponto central pedido pelo usuário): SÓ quem gerencia a
-- campanha (Mestre/Admin) OU tem pelo menos um personagem VINCULADO
-- a ela pode ver os itens e preços — ninguém de fora enxerga a loja
-- de uma campanha que não é sua.
-- =====================================================================

create table public.campanha_loja_itens (
  id         uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  nome       text not null,
  preco      numeric not null default 0,
  espaco     numeric not null default 0,
  descricao  text not null default '',
  categoria  text not null default 'outro',
  balas      int,
  dano       text,
  meio_transporte text check (meio_transporte is null or meio_transporte in ('coldre', 'bandoleira', 'bainha')),
  created_at timestamptz not null default now()
);

comment on table public.campanha_loja_itens is 'Loja customizada por campanha — itens e preços que o Mestre cadastra, além do Catálogo de Equipamento fixo do livro.';

create index idx_campanha_loja_itens_campanha on public.campanha_loja_itens(campanha_id);

alter table public.campanha_loja_itens enable row level security;

-- Helper (mesmo padrão de e_dono_do_personagem/e_mestre_de_campanha_*,
-- migration 0006/0008): existe algum personagem MEU vinculado a essa
-- campanha?
create or replace function public.e_membro_da_campanha(p_campanha_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1
    from public.campanha_personagens cp
    join public.personagens p on p.id = cp.personagem_id
    where cp.campanha_id = p_campanha_id and p.user_id = (select auth.uid())
  );
$$;

-- SELECT: gerencia a campanha OU tem personagem vinculado a ela —
-- ninguém mais vê os itens/preços desta loja.
create policy "campanha_loja_itens_select" on public.campanha_loja_itens for select to authenticated
  using (
    exists (
      select 1 from public.campanhas c
      where c.id = campanha_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
    or (select public.e_membro_da_campanha(campanha_id))
  );

-- Cadastrar/editar/remover itens da loja: só quem gerencia a
-- campanha (jogador só LÊ os preços, nunca cria/edita).
create policy "campanha_loja_itens_insert" on public.campanha_loja_itens for insert to authenticated
  with check (
    exists (
      select 1 from public.campanhas c
      where c.id = campanha_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "campanha_loja_itens_update" on public.campanha_loja_itens for update to authenticated
  using (
    exists (
      select 1 from public.campanhas c
      where c.id = campanha_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  )
  with check (
    exists (
      select 1 from public.campanhas c
      where c.id = campanha_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "campanha_loja_itens_delete" on public.campanha_loja_itens for delete to authenticated
  using (
    exists (
      select 1 from public.campanhas c
      where c.id = campanha_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );