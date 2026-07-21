-- =====================================================================
-- Sacramento RPG — Migração 0022: ficha de NPC mais detalhada
-- (descrição, foto) e inventário simples por NPC.
--
-- Inventário de NPC é DELIBERADAMENTE mais simples que o de personagem
-- (`items`, migration 0003): sem peso/espaço/mochila — NPC não
-- carrega limite de carga, isso só importa pros PJs. É só uma lista de
-- "o que ele tem", útil pro Mestre lembrar (ex.: "chave da cadeia",
-- "carta comprometedora") sem virar a mecânica de inventário completa.
-- =====================================================================

alter table public.campanha_npcs
  add column descricao text not null default '',
  add column foto_url text;

create table public.campanha_npc_itens (
  id         uuid primary key default gen_random_uuid(),
  npc_id     uuid not null references public.campanha_npcs(id) on delete cascade,
  nome       text not null,
  quantidade int not null default 1,
  descricao  text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.campanha_npc_itens is 'Inventário simples de um NPC da biblioteca — sem peso/espaço, só "o que ele tem" (chaves, cartas, pertences notáveis).';

create index idx_campanha_npc_itens_npc on public.campanha_npc_itens(npc_id);

alter table public.campanha_npc_itens enable row level security;

-- Mesma regra de sempre — checa quem gerencia a CAMPANHA dona do NPC
-- (join até campanhas, passando por campanha_npcs).
create policy "campanha_npc_itens_select" on public.campanha_npc_itens for select to authenticated
  using (
    exists (
      select 1 from public.campanha_npcs n
      join public.campanhas c on c.id = n.campanha_id
      where n.id = npc_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "campanha_npc_itens_insert" on public.campanha_npc_itens for insert to authenticated
  with check (
    exists (
      select 1 from public.campanha_npcs n
      join public.campanhas c on c.id = n.campanha_id
      where n.id = npc_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "campanha_npc_itens_update" on public.campanha_npc_itens for update to authenticated
  using (
    exists (
      select 1 from public.campanha_npcs n
      join public.campanhas c on c.id = n.campanha_id
      where n.id = npc_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  )
  with check (
    exists (
      select 1 from public.campanha_npcs n
      join public.campanhas c on c.id = n.campanha_id
      where n.id = npc_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "campanha_npc_itens_delete" on public.campanha_npc_itens for delete to authenticated
  using (
    exists (
      select 1 from public.campanha_npcs n
      join public.campanhas c on c.id = n.campanha_id
      where n.id = npc_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );