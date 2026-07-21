-- =====================================================================
-- Sacramento RPG — Migração 0023: "pasta" de NPC vira uma entidade de
-- verdade (nome + descrição própria), não só um texto solto repetido
-- em cada NPC. Permite dar contexto à pasta (ex.: "Subtrama: A
-- Vingança do Xerife" com uma descrição do gancho) e acompanhar as
-- pastas da campanha como uma lista própria, separada dos NPCs.
--
-- Migra dados existentes: cria uma pasta pra cada valor distinto de
-- `campanha_npcs.pasta` já em uso, aponta cada NPC pra ela, e só
-- depois remove a coluna de texto antiga.
-- =====================================================================

create table public.campanha_pastas_npc (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  nome        text not null,
  descricao   text not null default '',
  created_at  timestamptz not null default now(),
  unique (campanha_id, nome)
);

comment on table public.campanha_pastas_npc is 'Pasta da Biblioteca de NPCs — usada como quiser (cidade, subtrama, gangue); tem descrição própria, separada dos NPCs que ela agrupa.';

create index idx_campanha_pastas_npc_campanha on public.campanha_pastas_npc(campanha_id);

alter table public.campanha_pastas_npc enable row level security;

create policy "campanha_pastas_npc_select" on public.campanha_pastas_npc for select to authenticated
  using (
    exists (
      select 1 from public.campanhas c
      where c.id = campanha_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "campanha_pastas_npc_insert" on public.campanha_pastas_npc for insert to authenticated
  with check (
    exists (
      select 1 from public.campanhas c
      where c.id = campanha_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "campanha_pastas_npc_update" on public.campanha_pastas_npc for update to authenticated
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

create policy "campanha_pastas_npc_delete" on public.campanha_pastas_npc for delete to authenticated
  using (
    exists (
      select 1 from public.campanhas c
      where c.id = campanha_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

-- Backfill: uma pasta por valor distinto (campanha_id, pasta) já em uso.
insert into public.campanha_pastas_npc (campanha_id, nome)
select distinct campanha_id, pasta from public.campanha_npcs
on conflict (campanha_id, nome) do nothing;

alter table public.campanha_npcs add column pasta_id uuid references public.campanha_pastas_npc(id) on delete set null;

update public.campanha_npcs n
set pasta_id = p.id
from public.campanha_pastas_npc p
where p.campanha_id = n.campanha_id and p.nome = n.pasta;

alter table public.campanha_npcs drop column pasta;