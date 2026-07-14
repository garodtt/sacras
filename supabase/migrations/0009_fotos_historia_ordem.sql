-- =====================================================================
-- Sacramento RPG — Migração 0009: ordem de habilidades, fotos (item,
-- personagem, perfil), descrição/história do personagem, e o bucket de
-- Storage + RLS que tudo isso precisa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- HABILIDADES — ordem manual (arrastar não, botões de mover pra cima/
-- baixo — mais confiável no celular). Default 0 pra quem já existe;
-- o app sempre manda um valor de verdade ao criar uma nova.
-- ---------------------------------------------------------------------
alter table public.personagem_habilidades
  add column ordem int not null default 0;

-- ---------------------------------------------------------------------
-- PERSONAGENS — retrato e história/descrição.
-- ---------------------------------------------------------------------
alter table public.personagens
  add column foto_url text,
  add column descricao_historia text;

-- ---------------------------------------------------------------------
-- ITEMS — foto por item (só os do personagem, não os da montaria —
-- ver nota no docs/ARQUITETURA.md sobre o porquê do recorte).
-- ---------------------------------------------------------------------
alter table public.items
  add column foto_url text;

-- ---------------------------------------------------------------------
-- PROFILES — foto de perfil.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column foto_url text;

-- ---------------------------------------------------------------------
-- Função auxiliar: consolida em um lugar só a checagem "posso editar
-- este personagem" (dono, Admin, ou Mestre de campanha vinculada —
-- migration 0008). Usada pelas políticas de Storage abaixo; as
-- políticas de items/weapons/mounts/personagens continuam como estavam
-- (já corretas), essa função é só pra Storage não duplicar a lógica.
-- ---------------------------------------------------------------------
create function public.pode_editar_personagem(p_personagem_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select public.e_dono_do_personagem(p_personagem_id)
    or (select public.is_admin())
    or public.e_mestre_de_campanha_do_personagem(p_personagem_id);
$$;

-- ---------------------------------------------------------------------
-- STORAGE — bucket público "fotos" (leitura pública via URL — são fotos
-- de personagem/item, não é dado sensível; escrita continua travada por
-- RLS). Convenção de pasta, ambas sob o mesmo "dono" pra reaproveitar a
-- mesma checagem de permissão:
--   fotos/personagem/{personagem_id}/retrato.*   -> foto do personagem
--   fotos/personagem/{personagem_id}/item-{id}.* -> foto de um item dele
--   fotos/perfil/{user_id}/foto.*                 -> foto de perfil
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

create policy "fotos_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'fotos');

create policy "fotos_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos'
    and (
      (
        (storage.foldername(name))[1] = 'personagem'
        and public.pode_editar_personagem(((storage.foldername(name))[2])::uuid)
      )
      or (
        (storage.foldername(name))[1] = 'perfil'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
    )
  );

create policy "fotos_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'fotos'
    and (
      (
        (storage.foldername(name))[1] = 'personagem'
        and public.pode_editar_personagem(((storage.foldername(name))[2])::uuid)
      )
      or (
        (storage.foldername(name))[1] = 'perfil'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
    )
  );

create policy "fotos_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fotos'
    and (
      (
        (storage.foldername(name))[1] = 'personagem'
        and public.pode_editar_personagem(((storage.foldername(name))[2])::uuid)
      )
      or (
        (storage.foldername(name))[1] = 'perfil'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
    )
  );