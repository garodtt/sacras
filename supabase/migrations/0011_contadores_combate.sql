-- =====================================================================
-- Sacramento RPG — Migração 0011: contadores de assistências e mortes
-- (campos simples, sem regra nenhuma — só números que o jogador anota).
-- =====================================================================

alter table public.personagens
  add column assistencias int not null default 0,
  add column mortes int not null default 0;