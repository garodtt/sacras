-- =====================================================================
-- Sacramento RPG — Migração 0020: facção nos combatentes (agrupar
-- aliados/inimigos por cor) e biblioteca de NPCs por campanha (criar
-- de antemão, organizar em pastas, puxar pro combate quando precisar).
-- =====================================================================

alter table public.combate_entradas
  add column faccao text not null default 'inimigo' check (faccao in ('aliado', 'inimigo', 'neutro'));

-- Biblioteca de NPCs da campanha — separada de `combate_entradas` de
-- propósito: um NPC aqui é um "molde" reutilizável (Vida/Dor/Balas
-- MÁXIMOS, pra começar do zero toda vez); `combate_entradas` continua
-- sendo só o que está NA LUTA agora, com Vida/Dor/Balas ATUAIS que vão
-- descendo — puxar um NPC da biblioteca pro combate cria uma linha
-- NOVA e independente em `combate_entradas` (não um vínculo/cópia
-- viva, diferente do que fizemos com personagem_id em 0013 — aqui não
-- faz sentido "ao vivo": o Xerife da biblioteca não deveria perder
-- Vida só porque uma cópia dele morreu numa luta).
create table public.campanha_npcs (
  id           uuid primary key default gen_random_uuid(),
  campanha_id  uuid not null references public.campanhas(id) on delete cascade,
  pasta        text not null default 'Geral',
  nome         text not null,
  vida_max     int not null default 6,
  dor_max      int not null default 6,
  balas_max    int not null default 0,
  created_at   timestamptz not null default now()
);

comment on table public.campanha_npcs is 'Biblioteca de NPCs reutilizáveis por campanha (moldes: só Vida/Dor/Balas MÁXIMOS) — puxar um pro Rastreador de Combate cria uma linha independente em combate_entradas, não um vínculo ao vivo.';

create index idx_campanha_npcs_campanha on public.campanha_npcs(campanha_id);

alter table public.campanha_npcs enable row level security;

-- Mesma regra de sempre pra dado de gestão de campanha: só quem criou
-- a campanha (ou Admin) mexe na biblioteca de NPCs dela.
create policy "campanha_npcs_select" on public.campanha_npcs for select to authenticated
  using (
    exists (
      select 1 from public.campanhas c
      where c.id = campanha_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "campanha_npcs_insert" on public.campanha_npcs for insert to authenticated
  with check (
    exists (
      select 1 from public.campanhas c
      where c.id = campanha_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "campanha_npcs_update" on public.campanha_npcs for update to authenticated
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

create policy "campanha_npcs_delete" on public.campanha_npcs for delete to authenticated
  using (
    exists (
      select 1 from public.campanhas c
      where c.id = campanha_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );