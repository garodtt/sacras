-- =====================================================================
-- Sacramento RPG — Migração 0005: rastreador de combate do Mestre.
--
-- Ferramenta do Mestre pra acompanhar NPCs e jogadores por ordem de
-- Iniciativa numa campanha — Vida/Dor (mesma regra de quebra de
-- resistência da ficha) e Balas com recarregar simples (reseta pro
-- máximo, sem pool de reserva — é uma versão simplificada pra NPC,
-- diferente do sistema de coldre/bandoleira do personagem).
--
-- Entrada aqui é sempre um "bloco de stats" solto (nome + números
-- digitados na hora) — NÃO referencia personagens.id. É de propósito:
-- o Mestre digita rapidamente o que precisar (inclusive uma cópia dos
-- stats de um jogador, se quiser), sem depender de sincronizar com a
-- ficha de verdade. Ver docs/ARQUITETURA.md.
-- =====================================================================

create table public.combate_entradas (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  nome        text not null,
  tipo        text not null default 'npc' check (tipo in ('npc', 'jogador')),
  iniciativa  int not null default 0,
  vida_max    int not null default 6 check (vida_max >= 1),
  vida_atual  int not null default 6,
  dor_max     int not null default 6 check (dor_max >= 1),
  dor_atual   int not null default 6,
  balas_max   int not null default 0 check (balas_max >= 0),
  balas_atual int not null default 0,
  created_at  timestamptz not null default now()
);

create index idx_combate_entradas_campanha on public.combate_entradas(campanha_id);

alter table public.combate_entradas enable row level security;

-- Ferramenta do Mestre: só o dono da campanha (ou Admin) vê e mexe —
-- diferente de items/weapons/mounts, aqui NÃO existe visão de
-- "participante só vê o próprio" porque isso não é do jogador, é o
-- Mestre rastreando o combate (inclusive stats de NPC que o jogador
-- não deveria enxergar).
create policy "combate_entradas_select" on public.combate_entradas
  for select to authenticated
  using (public.e_dono_da_campanha(campanha_id) or public.is_admin());

create policy "combate_entradas_insert" on public.combate_entradas
  for insert to authenticated
  with check (public.e_dono_da_campanha(campanha_id) or public.is_admin());

create policy "combate_entradas_update" on public.combate_entradas
  for update to authenticated
  using (public.e_dono_da_campanha(campanha_id) or public.is_admin())
  with check (public.e_dono_da_campanha(campanha_id) or public.is_admin());

create policy "combate_entradas_delete" on public.combate_entradas
  for delete to authenticated
  using (public.e_dono_da_campanha(campanha_id) or public.is_admin());