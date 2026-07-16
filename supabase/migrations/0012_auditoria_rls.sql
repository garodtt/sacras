create policy "campanha_personagens_update"
  on public.campanha_personagens
  for update
  to authenticated
  using (
    (select public.is_admin())
    or public.e_dono_da_campanha(campanha_id)
    or public.e_dono_do_personagem(personagem_id)
  )
  with check (
    (select public.is_admin())
    or public.e_dono_da_campanha(campanha_id)
    or public.e_dono_do_personagem(personagem_id)
  );

create policy "profiles_insert"
  on public.profiles
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "profiles_delete"
  on public.profiles
  for delete
  to authenticated
  using ((select public.is_admin()));