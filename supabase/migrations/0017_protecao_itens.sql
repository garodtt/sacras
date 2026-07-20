-- =====================================================================
-- Sacramento RPG — Migração 0017: Proteção (armadura improvisada) nos
-- itens — sobretudo, colete, placas de metal etc. (Grande Catálogo de
-- Equipamento, tabela "Proteção").
--
-- Regra do livro: reduz o dano recebido por um número fixo de Círculos,
-- mas tem um Limite de Dano — cada vez que a proteção é usada pra
-- reduzir um golpe, o limite cai 1; ao chegar em 0, quebra e para de
-- funcionar até ser consertada.
--
-- Escopo: só os CAMPOS ficam disponíveis no item (redução, limite
-- máximo, limite atual) — a redução em si (aplicar no dano recebido,
-- decrementar o limite sozinho) continua sendo o jogador/Mestre
-- decidindo e ajustando manualmente, do mesmo jeito que outras
-- mecânicas do app (ex.: Habilidades) já funcionam. Automatizar dentro
-- do fluxo de dano do combate é um passo maior, deixado pra depois se
-- fizer falta.
-- =====================================================================

alter table public.items
  add column reducao_dano int not null default 0,
  add column limite_dano_max int not null default 0,
  add column limite_dano_atual int not null default 0;