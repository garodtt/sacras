-- =====================================================================
-- Sacramento RPG — Migração 0018: categoria do item — usada só pra dar
-- um ícone/cor discreto na lista (escanear rápido um inventário
-- longo), sem regra de jogo nenhuma atrelada.
-- =====================================================================

alter table public.items
  add column categoria text not null default 'outro'
    check (categoria in ('municao', 'arma_branca', 'comida', 'roupa', 'remedio', 'ferramenta', 'outro'));