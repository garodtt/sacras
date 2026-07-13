-- =====================================================================
-- Sacramento RPG — Migração 0006: correção de performance do RLS.
--
-- Causa da lentidão: toda função/policy daqui chamava `auth.uid()` (e
-- `is_admin()`) direto, sem empacotar numa subquery `(select ...)`.
-- Isso é uma armadilha conhecida do Postgres/Supabase — sem o `select`,
-- o planejador reexecuta a função A CADA LINHA avaliada pela policy, em
-- vez de rodar uma vez só por consulta (fica guardado como "initPlan").
-- Documentado oficialmente aqui:
-- https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
--
-- Esta migration REESCREVE as funções auxiliares (`create or replace`,
-- mesmo nome/assinatura — nada que já chama essas funções precisa
-- mudar) e recria as policies que chamavam `auth.uid()`/`is_admin()`
-- direto. A LÓGICA de cada uma é idêntica à original — só a forma de
-- chamar `auth.uid()`/`is_admin()` muda, não o que é permitido.
--
-- Funções com parâmetro dependente da linha (`e_dono_da_campanha(id)`,
-- `e_dono_do_personagem(id)`, `pode_ver_personagem(id)` etc.) não podem
-- ser "cacheadas" da mesma forma no ponto de chamada (o resultado muda
-- por linha, então o Postgres precisa mesmo rodar de novo) — o ganho
-- ali vem de dentro delas, corrigindo o `auth.uid()` interno. Só
-- `is_admin()` (sem parâmetro nenhum) se beneficia de também empacotar
-- a CHAMADA em `(select ...)` nas policies, porque o resultado dela é
-- constante pra consulta inteira.
-- =====================================================================

-- ---------------------------------------------------------------------
-- FUNÇÕES AUXILIARES — mesmo nome/assinatura, só o auth.uid() interno
-- (e chamadas a is_admin()) agora empacotados.
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.e_dono_da_campanha(p_campanha_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.campanhas
    where id = p_campanha_id and criado_por = (select auth.uid())
  );
$$;

create or replace function public.e_dono_do_personagem(p_personagem_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.personagens
    where id = p_personagem_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.participo_da_campanha(p_campanha_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.campanha_personagens cp
    join public.personagens p on p.id = cp.personagem_id
    where cp.campanha_id = p_campanha_id and p.user_id = (select auth.uid())
  );
$$;

create or replace function public.tenho_convite_aceito(p_campanha_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.convites
    where campanha_id = p_campanha_id
      and usuario_convidado_id = (select auth.uid())
      and status = 'aceito'
  );
$$;

create or replace function public.pode_ver_personagem(p_personagem_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.personagens p
    where p.id = p_personagem_id
      and (
        (select public.is_admin())
        or p.user_id = (select auth.uid())
        or exists (
          select 1 from public.campanha_personagens cp
          join public.campanhas c on c.id = cp.campanha_id
          where cp.personagem_id = p.id and c.criado_por = (select auth.uid())
        )
      )
  );
$$;

create or replace function public.e_dono_da_montaria(p_mount_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.mounts m
    where m.id = p_mount_id and public.e_dono_do_personagem(m.personagem_id)
  );
$$;

create or replace function public.pode_ver_montaria(p_mount_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.mounts m
    where m.id = p_mount_id and public.pode_ver_personagem(m.personagem_id)
  );
$$;

-- ---------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------
-- CAMPANHAS
-- ---------------------------------------------------------------------
drop policy if exists "campanhas_select" on public.campanhas;
create policy "campanhas_select"
  on public.campanhas for select
  to authenticated
  using (
    (select public.is_admin())
    or criado_por = (select auth.uid())
    or public.participo_da_campanha(id)
    or exists (
      select 1 from public.convites
      where campanha_id = campanhas.id and usuario_convidado_id = (select auth.uid())
    )
  );

drop policy if exists "campanhas_insert" on public.campanhas;
create policy "campanhas_insert"
  on public.campanhas for insert
  to authenticated
  with check (criado_por = (select auth.uid()));

drop policy if exists "campanhas_update" on public.campanhas;
create policy "campanhas_update"
  on public.campanhas for update
  to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "campanhas_delete" on public.campanhas;
create policy "campanhas_delete"
  on public.campanhas for delete
  to authenticated
  using (criado_por = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------
-- PERSONAGENS
-- ---------------------------------------------------------------------
drop policy if exists "personagens_select" on public.personagens;
create policy "personagens_select"
  on public.personagens for select
  to authenticated
  using (
    (select public.is_admin())
    or user_id = (select auth.uid())
    or exists (
      select 1 from public.campanha_personagens cp
      join public.campanhas c on c.id = cp.campanha_id
      where cp.personagem_id = personagens.id and c.criado_por = (select auth.uid())
    )
  );

drop policy if exists "personagens_insert" on public.personagens;
create policy "personagens_insert"
  on public.personagens for insert
  to authenticated
  with check (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "personagens_update" on public.personagens;
create policy "personagens_update"
  on public.personagens for update
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "personagens_delete" on public.personagens;
create policy "personagens_delete"
  on public.personagens for delete
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------
-- CAMPANHA_PERSONAGENS
-- ---------------------------------------------------------------------
drop policy if exists "campanha_personagens_select" on public.campanha_personagens;
create policy "campanha_personagens_select"
  on public.campanha_personagens for select
  to authenticated
  using (
    (select public.is_admin())
    or public.e_dono_da_campanha(campanha_id)
    or public.e_dono_do_personagem(personagem_id)
  );

drop policy if exists "campanha_personagens_insert" on public.campanha_personagens;
create policy "campanha_personagens_insert"
  on public.campanha_personagens for insert
  to authenticated
  with check (
    (select public.is_admin())
    or (
      public.e_dono_do_personagem(personagem_id)
      and (public.e_dono_da_campanha(campanha_id) or public.tenho_convite_aceito(campanha_id))
    )
  );

drop policy if exists "campanha_personagens_delete" on public.campanha_personagens;
create policy "campanha_personagens_delete"
  on public.campanha_personagens for delete
  to authenticated
  using (
    (select public.is_admin())
    or public.e_dono_da_campanha(campanha_id)
    or public.e_dono_do_personagem(personagem_id)
  );

-- ---------------------------------------------------------------------
-- CONVITES
-- ---------------------------------------------------------------------
drop policy if exists "convites_select" on public.convites;
create policy "convites_select"
  on public.convites for select
  to authenticated
  using (
    (select public.is_admin())
    or usuario_convidado_id = (select auth.uid())
    or public.e_dono_da_campanha(campanha_id)
  );

drop policy if exists "convites_insert" on public.convites;
create policy "convites_insert"
  on public.convites for insert
  to authenticated
  with check ((select public.is_admin()) or public.e_dono_da_campanha(campanha_id));

drop policy if exists "convites_update" on public.convites;
create policy "convites_update"
  on public.convites for update
  to authenticated
  using (usuario_convidado_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "convites_delete" on public.convites;
create policy "convites_delete"
  on public.convites for delete
  to authenticated
  using (
    (select public.is_admin())
    or public.e_dono_da_campanha(campanha_id)
    or usuario_convidado_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------
-- ITEMS (versão ativa é a da migração 0003 — refeita aqui com o fix)
-- ---------------------------------------------------------------------
drop policy if exists "items_select" on public.items;
create policy "items_select" on public.items for select to authenticated
  using (
    (personagem_id is not null and public.pode_ver_personagem(personagem_id))
    or (mount_id is not null and public.pode_ver_montaria(mount_id))
  );

drop policy if exists "items_insert" on public.items;
create policy "items_insert" on public.items for insert to authenticated
  with check (
    (select public.is_admin())
    or (personagem_id is not null and public.e_dono_do_personagem(personagem_id))
    or (mount_id is not null and public.e_dono_da_montaria(mount_id))
  );

drop policy if exists "items_update" on public.items;
create policy "items_update" on public.items for update to authenticated
  using (
    (select public.is_admin())
    or (personagem_id is not null and public.e_dono_do_personagem(personagem_id))
    or (mount_id is not null and public.e_dono_da_montaria(mount_id))
  )
  with check (
    (select public.is_admin())
    or (personagem_id is not null and public.e_dono_do_personagem(personagem_id))
    or (mount_id is not null and public.e_dono_da_montaria(mount_id))
  );

drop policy if exists "items_delete" on public.items;
create policy "items_delete" on public.items for delete to authenticated
  using (
    (select public.is_admin())
    or (personagem_id is not null and public.e_dono_do_personagem(personagem_id))
    or (mount_id is not null and public.e_dono_da_montaria(mount_id))
  );

-- ---------------------------------------------------------------------
-- WEAPONS
-- ---------------------------------------------------------------------
drop policy if exists "weapons_insert" on public.weapons;
create policy "weapons_insert" on public.weapons for insert to authenticated
  with check (public.e_dono_do_personagem(personagem_id) or (select public.is_admin()));

drop policy if exists "weapons_update" on public.weapons;
create policy "weapons_update" on public.weapons for update to authenticated
  using (public.e_dono_do_personagem(personagem_id) or (select public.is_admin()))
  with check (public.e_dono_do_personagem(personagem_id) or (select public.is_admin()));

drop policy if exists "weapons_delete" on public.weapons;
create policy "weapons_delete" on public.weapons for delete to authenticated
  using (public.e_dono_do_personagem(personagem_id) or (select public.is_admin()));

-- ---------------------------------------------------------------------
-- MOUNTS
-- ---------------------------------------------------------------------
drop policy if exists "mounts_insert" on public.mounts;
create policy "mounts_insert" on public.mounts for insert to authenticated
  with check (public.e_dono_do_personagem(personagem_id) or (select public.is_admin()));

drop policy if exists "mounts_update" on public.mounts;
create policy "mounts_update" on public.mounts for update to authenticated
  using (public.e_dono_do_personagem(personagem_id) or (select public.is_admin()))
  with check (public.e_dono_do_personagem(personagem_id) or (select public.is_admin()));

drop policy if exists "mounts_delete" on public.mounts;
create policy "mounts_delete" on public.mounts for delete to authenticated
  using (public.e_dono_do_personagem(personagem_id) or (select public.is_admin()));

-- ---------------------------------------------------------------------
-- HABILIDADES_CATALOGO / PERSONAGEM_HABILIDADES
-- ---------------------------------------------------------------------
drop policy if exists "habilidades_catalogo_insert" on public.habilidades_catalogo;
create policy "habilidades_catalogo_insert" on public.habilidades_catalogo
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists "habilidades_catalogo_update" on public.habilidades_catalogo;
create policy "habilidades_catalogo_update" on public.habilidades_catalogo
  for update to authenticated using ((select public.is_admin()));

drop policy if exists "habilidades_catalogo_delete" on public.habilidades_catalogo;
create policy "habilidades_catalogo_delete" on public.habilidades_catalogo
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "personagem_habilidades_insert" on public.personagem_habilidades;
create policy "personagem_habilidades_insert" on public.personagem_habilidades
  for insert to authenticated
  with check (public.e_dono_do_personagem(personagem_id) or (select public.is_admin()));

drop policy if exists "personagem_habilidades_delete" on public.personagem_habilidades;
create policy "personagem_habilidades_delete" on public.personagem_habilidades
  for delete to authenticated
  using (public.e_dono_do_personagem(personagem_id) or (select public.is_admin()));

-- ---------------------------------------------------------------------
-- COMBATE_ENTRADAS
-- ---------------------------------------------------------------------
drop policy if exists "combate_entradas_select" on public.combate_entradas;
create policy "combate_entradas_select" on public.combate_entradas
  for select to authenticated
  using (public.e_dono_da_campanha(campanha_id) or (select public.is_admin()));

drop policy if exists "combate_entradas_insert" on public.combate_entradas;
create policy "combate_entradas_insert" on public.combate_entradas
  for insert to authenticated
  with check (public.e_dono_da_campanha(campanha_id) or (select public.is_admin()));

drop policy if exists "combate_entradas_update" on public.combate_entradas;
create policy "combate_entradas_update" on public.combate_entradas
  for update to authenticated
  using (public.e_dono_da_campanha(campanha_id) or (select public.is_admin()))
  with check (public.e_dono_da_campanha(campanha_id) or (select public.is_admin()));

drop policy if exists "combate_entradas_delete" on public.combate_entradas;
create policy "combate_entradas_delete" on public.combate_entradas
  for delete to authenticated
  using (public.e_dono_da_campanha(campanha_id) or (select public.is_admin()));