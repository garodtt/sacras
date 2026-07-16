-- =====================================================================
-- Sacramento RPG — Migração 0014: turno atual e rodada no Rastreador de
-- Combate. Guardado na campanha (não como estado local do React) pra
-- não perder o lugar se a página recarregar no meio de uma sessão.
-- =====================================================================

alter table public.campanhas
  add column combate_turno_index int not null default 0,
  add column combate_rodada int not null default 1;