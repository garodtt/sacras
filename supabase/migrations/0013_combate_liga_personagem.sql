-- =====================================================================
-- Sacramento RPG — Migração 0013: liga o Rastreador de Combate aos
-- personagens de verdade (Vida/Dor sempre ao vivo, sem cópia que possa
-- ficar desatualizada).
--
-- Até aqui, `combate_entradas` era sempre um "bloco de stats" solto,
-- sem referenciar `personagens.id` de propósito (documentado em
-- docs/ARQUITETURA.md) — pra manter o rastreador simples. Pedido novo:
-- puxar os jogadores da campanha com Vida/Dor/Armas já atualizados, e
-- que uma mudança na ficha do jogador reflita no combate sozinha.
--
-- Solução: `personagem_id` (nullable) — quando setado, a entrada
-- representa um jogador de verdade. Nesse caso, o app IGNORA as
-- colunas `vida_max/atual`, `dor_max/atual` daquela linha e lê/escreve
-- direto em `personagens` — não existe cópia, então não tem como
-- "dessincronizar": é a mesma linha do banco, vista de dois lugares
-- (ficha do jogador e Rastreador de Combate). NPC continua como estava
-- (sem personagem_id, usando as colunas locais normalmente).
--
-- `on delete set null`: se o personagem for apagado no meio de um
-- combate, a entrada não desaparece — só "solta" e vira uma entrada
-- comum (com o nome que tinha sido copiado no import, ver dados.js).
-- =====================================================================

alter table public.combate_entradas
  add column personagem_id uuid references public.personagens(id) on delete set null;

create index idx_combate_entradas_personagem on public.combate_entradas(personagem_id);