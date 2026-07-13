-- =====================================================================
-- Sacramento RPG — Migração 0003: regras de atributos, Dor (popup),
-- inventário completo (peso × quantidade, montaria com espaço próprio,
-- coldre/bandoleira), munição por categoria (leve/pesada) e catálogo de
-- habilidades. Rode DEPOIS do 0001 e 0002.
--
-- Ao contrário das migrations 0001/0002 (recriação total, só havia dado
-- de teste), esta é incremental de verdade — já existe ficha em uso.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PERSONAGENS
-- `efeito_dor_atual`: qual dos 6 efeitos da tabela de Dor está marcado
-- agora. Marcado manualmente pelo jogador (rola 1d6 na mesa), não é
-- calculado a partir dos círculos — por isso é uma coluna solta, não
-- uma fórmula.
-- `municao_leve_atual` / `municao_pesada_atual`: munição de RESERVA (no
-- coldre/na bandoleira, ainda não carregada em nenhuma arma). A
-- CAPACIDADE de cada uma é derivada dos itens (36 por coldre, 24 por
-- bandoleira) — calculada no app, não guardada aqui.
-- ---------------------------------------------------------------------
alter table public.personagens
  add column efeito_dor_atual    int check (efeito_dor_atual between 1 and 6),
  add column municao_leve_atual   int not null default 0,
  add column municao_pesada_atual int not null default 0;

-- ---------------------------------------------------------------------
-- ITEMS
-- Passam a poder pertencer a um personagem OU a uma montaria (nunca os
-- dois) — isso substitui o antigo `na_montaria` (que era só um
-- checkbox informativo, Fase 5): agora o item muda de dono de verdade,
-- com peso próprio contando pro limite de carga de quem for o dono.
-- `quantidade`: peso total da linha = peso (coluna espaco) × quantidade.
-- `tipo_carregador`: marca o item como coldre (+36 balas leves) ou
-- bandoleira (+24 balas pesadas) — null pra item comum.
-- ---------------------------------------------------------------------
alter table public.items
  alter column personagem_id drop not null,
  add column mount_id uuid references public.mounts(id) on delete cascade,
  add column quantidade int not null default 1 check (quantidade >= 1),
  add column tipo_carregador text check (tipo_carregador in ('coldre', 'bandoleira')),
  drop column na_montaria;

alter table public.items
  add constraint items_dono_unico check (
    (personagem_id is not null and mount_id is null) or
    (personagem_id is null and mount_id is not null)
  );

create index idx_items_mount on public.items(mount_id);

-- ---------------------------------------------------------------------
-- WEAPONS
-- `categoria`: leve (usa munição do coldre) ou pesada (usa munição da
-- bandoleira) — define de qual pool a arma recarrega.
-- municao_atual/municao_max já existiam desde a Fase 1, sem uso até
-- agora (é o que a arma tem carregado agora / cabe no total).
-- ---------------------------------------------------------------------
alter table public.weapons
  add column categoria text check (categoria in ('leve', 'pesada'));

-- ---------------------------------------------------------------------
-- MOUNTS
-- `tem_bolsa` / `tipo_carga`: opções de carga que somam ao espaço
-- padrão (10) — bolsa de montaria (+15), e carro (+20) OU carroça
-- (+30, mutuamente exclusivos entre si, mas qualquer um pode vir
-- junto com a bolsa). Cálculo final fica no app (src/lib/regras.js).
-- `presente`: a montaria está fisicamente com o personagem agora? Se
-- não, os itens dela não estão disponíveis (só um aviso na tela, não
-- trava nada no banco).
-- ---------------------------------------------------------------------
alter table public.mounts
  add column tem_bolsa  boolean not null default false,
  add column tipo_carga text check (tipo_carga in ('carro', 'carroca')),
  add column presente   boolean not null default true;

-- ---------------------------------------------------------------------
-- CATÁLOGO DE HABILIDADES — lista compartilhada (vem do livro),
-- gerenciada pelo admin. `personagem_habilidades` é o vínculo: cada
-- linha referencia o catálogo OU tem um nome_customizado (habilidade
-- criada pelo próprio jogador — "criada pelo jogador" é só
-- catalogo_id ser nulo, sem precisar de coluna extra pra isso).
-- ---------------------------------------------------------------------
create table public.habilidades_catalogo (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  descricao  text,
  created_at timestamptz not null default now()
);

create table public.personagem_habilidades (
  id               uuid primary key default gen_random_uuid(),
  personagem_id    uuid not null references public.personagens(id) on delete cascade,
  catalogo_id      uuid references public.habilidades_catalogo(id) on delete cascade,
  nome_customizado text,
  created_at       timestamptz not null default now(),
  constraint habilidade_origem_unica check (
    (catalogo_id is not null and nome_customizado is null) or
    (catalogo_id is null and nome_customizado is not null)
  )
);

create index idx_personagem_habilidades_personagem on public.personagem_habilidades(personagem_id);

-- =====================================================================
-- RLS — tabelas novas, e ajuste nas políticas de `items` (agora precisa
-- reconhecer dono-por-montaria também, não só dono-por-personagem).
-- =====================================================================

alter table public.habilidades_catalogo   enable row level security;
alter table public.personagem_habilidades enable row level security;

-- Funções auxiliares novas: mesma ideia de e_dono_do_personagem /
-- pode_ver_personagem (migração 0002), só que passando pela montaria.
create function public.e_dono_da_montaria(p_mount_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.mounts m
    where m.id = p_mount_id and public.e_dono_do_personagem(m.personagem_id)
  );
$$;

create function public.pode_ver_montaria(p_mount_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.mounts m
    where m.id = p_mount_id and public.pode_ver_personagem(m.personagem_id)
  );
$$;

-- Catálogo: todo autenticado lê (pra poder escolher); só admin escreve
-- (é conteúdo oficial do livro, não é por personagem).
create policy "habilidades_catalogo_select" on public.habilidades_catalogo
  for select to authenticated using (true);
create policy "habilidades_catalogo_insert" on public.habilidades_catalogo
  for insert to authenticated with check (public.is_admin());
create policy "habilidades_catalogo_update" on public.habilidades_catalogo
  for update to authenticated using (public.is_admin());
create policy "habilidades_catalogo_delete" on public.habilidades_catalogo
  for delete to authenticated using (public.is_admin());

-- Habilidades do personagem: mesma regra de items/weapons/mounts.
create policy "personagem_habilidades_select" on public.personagem_habilidades
  for select to authenticated using (public.pode_ver_personagem(personagem_id));
create policy "personagem_habilidades_insert" on public.personagem_habilidades
  for insert to authenticated
  with check (public.e_dono_do_personagem(personagem_id) or public.is_admin());
create policy "personagem_habilidades_delete" on public.personagem_habilidades
  for delete to authenticated
  using (public.e_dono_do_personagem(personagem_id) or public.is_admin());

-- items_* precisa ser recriada: agora um item pode ter personagem_id OU
-- mount_id, e a política antiga só sabia checar personagem_id (com
-- mount_id, `e_dono_do_personagem(null)` sempre dá falso — travaria
-- geral os itens de montaria).
drop policy "items_select" on public.items;
drop policy "items_insert" on public.items;
drop policy "items_update" on public.items;
drop policy "items_delete" on public.items;

create policy "items_select" on public.items for select to authenticated
  using (
    (personagem_id is not null and public.pode_ver_personagem(personagem_id))
    or (mount_id is not null and public.pode_ver_montaria(mount_id))
  );

create policy "items_insert" on public.items for insert to authenticated
  with check (
    public.is_admin()
    or (personagem_id is not null and public.e_dono_do_personagem(personagem_id))
    or (mount_id is not null and public.e_dono_da_montaria(mount_id))
  );

create policy "items_update" on public.items for update to authenticated
  using (
    public.is_admin()
    or (personagem_id is not null and public.e_dono_do_personagem(personagem_id))
    or (mount_id is not null and public.e_dono_da_montaria(mount_id))
  )
  with check (
    public.is_admin()
    or (personagem_id is not null and public.e_dono_do_personagem(personagem_id))
    or (mount_id is not null and public.e_dono_da_montaria(mount_id))
  );

create policy "items_delete" on public.items for delete to authenticated
  using (
    public.is_admin()
    or (personagem_id is not null and public.e_dono_do_personagem(personagem_id))
    or (mount_id is not null and public.e_dono_da_montaria(mount_id))
  );