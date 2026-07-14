-- =====================================================================
-- Sacramento RPG — Migração 0007: revisão de armas/munição, inventário
-- da montaria por sub-local, e campos de dinheiro/recompensa na ficha.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ITEMS
-- `tipo_carregador` (coldre/bandoleira como flag de ITEM) sai — isso
-- virou propriedade da ARMA (weapons.meio_transporte), não do item.
-- `local_montaria`: quando o item é da montaria (mount_id setado), diz
-- em qual sub-local ele está guardado — importa pra saber o peso de
-- cada um separado (se a bolsa for perdida, dá pra saber exatamente o
-- que tinha nela).
-- ---------------------------------------------------------------------
alter table public.items
  drop column tipo_carregador,
  add column local_montaria text check (local_montaria in ('cavalo', 'bolsa', 'carro', 'carroca'));

-- ---------------------------------------------------------------------
-- WEAPONS
-- `categoria` (leve/pesada) sai, substituída por `meio_transporte`
-- (coldre/bandoleira/bainha) — já diz tanto o meio de transporte quanto
-- a categoria de munição (coldre = leve, bandoleira = pesada; bainha =
-- arma branca, sem munição). Limites (validados no app, não aqui):
-- bandoleira ≤ 2, coldre + bandoleira ≤ 4, bainha ≤ 1.
-- `tipo_dano`: já existia desde a Fase 1 sem uso — agora vira campo de
-- verdade (Dor = a grande maioria das armas; Vida = ferimento direto,
-- bypassa a Dor, mesma lógica de "ferimento direto na vida" da ficha).
-- ---------------------------------------------------------------------
alter table public.weapons
  drop column categoria,
  add column meio_transporte text check (meio_transporte in ('coldre', 'bandoleira', 'bainha'));

alter table public.weapons
  add constraint weapons_tipo_dano_valido check (tipo_dano is null or tipo_dano in ('dor', 'vida'));

-- ---------------------------------------------------------------------
-- PERSONAGENS
-- `dinheiro` já existia desde a Fase 1 (fora da tela até agora).
-- `valor_recompensa`: novo — quanto vale a cabeça do personagem.
-- ---------------------------------------------------------------------
alter table public.personagens
  add column valor_recompensa numeric not null default 0;