-- =====================================================================
-- Sacramento RPG — Migração 0008: Mestre pode editar a ficha do
-- personagem (não só ver).
--
-- Até aqui, quem edita um personagem é só o dono (user_id) ou o Admin —
-- o dono de uma campanha onde o personagem está vinculado só enxergava
-- (pode_ver_personagem já incluía isso desde a Fase 1). Esta migração
-- estende as políticas de escrita (insert/update/delete) da mesma forma
-- que a leitura já funcionava: dono do personagem, Admin, OU dono de
-- QUALQUER campanha onde esse personagem esteja vinculado.
--
-- Vale pra ficha inteira: personagens, itens, armas, montaria e
-- habilidades — "editar a ficha" inclui tudo que está nela, não só os
-- campos da tabela `personagens`. Criar/excluir o PERSONAGEM em si
-- continua só do dono/Admin (isso não muda) — só edição do que já
-- existe (e dos itens/armas/etc. dentro dele) que passa a valer pro
-- Mestre também.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções auxiliares novas — mesma lógica que já existia dentro de
-- `pode_ver_personagem`/`pode_ver_montaria`, só isoladas pra reaproveitar
-- nas políticas de escrita sem duplicar a subquery em cada uma.
-- ---------------------------------------------------------------------
create function public.e_mestre_de_campanha_do_personagem(p_personagem_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.campanha_personagens cp
    join public.campanhas c on c.id = cp.campanha_id
    where cp.personagem_id = p_personagem_id and c.criado_por = (select auth.uid())
  );
$$;

create function public.e_mestre_de_campanha_da_montaria(p_mount_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.mounts m
    where m.id = p_mount_id and public.e_mestre_de_campanha_do_personagem(m.personagem_id)
  );
$$;

-- ---------------------------------------------------------------------
-- PERSONAGENS — só UPDATE ganha o Mestre (insert/delete continuam
-- dono/Admin: criar ou apagar o personagem em si não é "editar a
-- ficha").
-- ---------------------------------------------------------------------
drop policy "personagens_update" on public.personagens;
create policy "personagens_update"
  on public.personagens for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
    or public.e_mestre_de_campanha_do_personagem(id)
  );

-- ---------------------------------------------------------------------
-- ITEMS
-- ---------------------------------------------------------------------
drop policy "items_insert" on public.items;
create policy "items_insert" on public.items for insert to authenticated
  with check (
    (select public.is_admin())
    or (personagem_id is not null and public.e_dono_do_personagem(personagem_id))
    or (personagem_id is not null and public.e_mestre_de_campanha_do_personagem(personagem_id))
    or (mount_id is not null and public.e_dono_da_montaria(mount_id))
    or (mount_id is not null and public.e_mestre_de_campanha_da_montaria(mount_id))
  );

drop policy "items_update" on public.items;
create policy "items_update" on public.items for update to authenticated
  using (
    (select public.is_admin())
    or (personagem_id is not null and public.e_dono_do_personagem(personagem_id))
    or (personagem_id is not null and public.e_mestre_de_campanha_do_personagem(personagem_id))
    or (mount_id is not null and public.e_dono_da_montaria(mount_id))
    or (mount_id is not null and public.e_mestre_de_campanha_da_montaria(mount_id))
  )
  with check (
    (select public.is_admin())
    or (personagem_id is not null and public.e_dono_do_personagem(personagem_id))
    or (personagem_id is not null and public.e_mestre_de_campanha_do_personagem(personagem_id))
    or (mount_id is not null and public.e_dono_da_montaria(mount_id))
    or (mount_id is not null and public.e_mestre_de_campanha_da_montaria(mount_id))
  );

drop policy "items_delete" on public.items;
create policy "items_delete" on public.items for delete to authenticated
  using (
    (select public.is_admin())
    or (personagem_id is not null and public.e_dono_do_personagem(personagem_id))
    or (personagem_id is not null and public.e_mestre_de_campanha_do_personagem(personagem_id))
    or (mount_id is not null and public.e_dono_da_montaria(mount_id))
    or (mount_id is not null and public.e_mestre_de_campanha_da_montaria(mount_id))
  );

-- ---------------------------------------------------------------------
-- WEAPONS
-- ---------------------------------------------------------------------
drop policy "weapons_insert" on public.weapons;
create policy "weapons_insert" on public.weapons for insert to authenticated
  with check (
    public.e_dono_do_personagem(personagem_id)
    or public.e_mestre_de_campanha_do_personagem(personagem_id)
    or (select public.is_admin())
  );

drop policy "weapons_update" on public.weapons;
create policy "weapons_update" on public.weapons for update to authenticated
  using (
    public.e_dono_do_personagem(personagem_id)
    or public.e_mestre_de_campanha_do_personagem(personagem_id)
    or (select public.is_admin())
  )
  with check (
    public.e_dono_do_personagem(personagem_id)
    or public.e_mestre_de_campanha_do_personagem(personagem_id)
    or (select public.is_admin())
  );

drop policy "weapons_delete" on public.weapons;
create policy "weapons_delete" on public.weapons for delete to authenticated
  using (
    public.e_dono_do_personagem(personagem_id)
    or public.e_mestre_de_campanha_do_personagem(personagem_id)
    or (select public.is_admin())
  );

-- ---------------------------------------------------------------------
-- MOUNTS
-- ---------------------------------------------------------------------
drop policy "mounts_insert" on public.mounts;
create policy "mounts_insert" on public.mounts for insert to authenticated
  with check (
    public.e_dono_do_personagem(personagem_id)
    or public.e_mestre_de_campanha_do_personagem(personagem_id)
    or (select public.is_admin())
  );

drop policy "mounts_update" on public.mounts;
create policy "mounts_update" on public.mounts for update to authenticated
  using (
    public.e_dono_do_personagem(personagem_id)
    or public.e_mestre_de_campanha_do_personagem(personagem_id)
    or (select public.is_admin())
  )
  with check (
    public.e_dono_do_personagem(personagem_id)
    or public.e_mestre_de_campanha_do_personagem(personagem_id)
    or (select public.is_admin())
  );

drop policy "mounts_delete" on public.mounts;
create policy "mounts_delete" on public.mounts for delete to authenticated
  using (
    public.e_dono_do_personagem(personagem_id)
    or public.e_mestre_de_campanha_do_personagem(personagem_id)
    or (select public.is_admin())
  );

-- ---------------------------------------------------------------------
-- PERSONAGEM_HABILIDADES
-- ---------------------------------------------------------------------
drop policy "personagem_habilidades_insert" on public.personagem_habilidades;
create policy "personagem_habilidades_insert" on public.personagem_habilidades
  for insert to authenticated
  with check (
    public.e_dono_do_personagem(personagem_id)
    or public.e_mestre_de_campanha_do_personagem(personagem_id)
    or (select public.is_admin())
  );

drop policy "personagem_habilidades_delete" on public.personagem_habilidades;
create policy "personagem_habilidades_delete" on public.personagem_habilidades
  for delete to authenticated
  using (
    public.e_dono_do_personagem(personagem_id)
    or public.e_mestre_de_campanha_do_personagem(personagem_id)
    or (select public.is_admin())
  );