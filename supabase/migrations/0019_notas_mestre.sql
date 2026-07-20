-- =====================================================================
-- Sacramento RPG — Migração 0019: anotações privadas do Mestre por
-- campanha.
--
-- Por que tabela própria, e não só uma coluna em `campanhas`: RLS é
-- por LINHA, não por coluna — se `notas_mestre` fosse uma coluna
-- solta em `campanhas`, todo jogador que pudesse ver a campanha (todo
-- membro) IA RECEBER essa coluna também na resposta da consulta,
-- mesmo que a tela nunca mostrasse pra ele (só esconder na tela não
-- esconde o dado — dá pra ver no painel de rede do navegador). Tabela
-- separada com sua própria política de SELECT resolve isso de
-- verdade: só quem criou a campanha (ou Admin) consegue ver a linha.
-- =====================================================================

create table public.campanha_notas_mestre (
  campanha_id uuid primary key references public.campanhas(id) on delete cascade,
  notas       text not null default '',
  updated_at  timestamptz not null default now()
);

comment on table public.campanha_notas_mestre is 'Rascunho/anotações privadas do Mestre por campanha — NUNCA visível a jogadores, nem ao consultar a campanha (é tabela separada de propósito, não coluna em campanhas).';

alter table public.campanha_notas_mestre enable row level security;

create policy "campanha_notas_select" on public.campanha_notas_mestre for select to authenticated
  using (
    exists (
      select 1 from public.campanhas c
      where c.id = campanha_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "campanha_notas_insert" on public.campanha_notas_mestre for insert to authenticated
  with check (
    exists (
      select 1 from public.campanhas c
      where c.id = campanha_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "campanha_notas_update" on public.campanha_notas_mestre for update to authenticated
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

create policy "campanha_notas_delete" on public.campanha_notas_mestre for delete to authenticated
  using (
    exists (
      select 1 from public.campanhas c
      where c.id = campanha_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );