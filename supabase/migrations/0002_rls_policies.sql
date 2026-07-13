-- =====================================================================
-- Sacramento RPG — Migração 0002: Row Level Security (v2)
-- Rode DEPOIS do 0001_schema_inicial.sql
--
-- Regra geral aplicada aqui:
--   admin           -> vê e edita tudo
--   dono da campanha -> vê a campanha e os personagens vinculados a ela;
--                       NÃO edita personagem de outro usuário (só o dono
--                       do personagem edita o próprio)
--   dono do personagem -> edita só o próprio personagem; vê campanhas em
--                       que participa (tem pelo menos 1 personagem
--                       vinculado) ou pra que foi convidado
-- =====================================================================

alter table public.profiles              enable row level security;
alter table public.campanhas             enable row level security;
alter table public.personagens           enable row level security;
alter table public.campanha_personagens  enable row level security;
alter table public.convites              enable row level security;
alter table public.items                 enable row level security;
alter table public.weapons               enable row level security;
alter table public.mounts                enable row level security;

-- ---------------------------------------------------------------------
-- Funções auxiliares (security definer = não recursa nas próprias
-- policies quando consultam outras tabelas)
-- ---------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create function public.e_dono_da_campanha(p_campanha_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.campanhas
    where id = p_campanha_id and criado_por = auth.uid()
  );
$$;

create function public.e_dono_do_personagem(p_personagem_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.personagens
    where id = p_personagem_id and user_id = auth.uid()
  );
$$;

-- "Eu participo dessa campanha" = tenho pelo menos 1 personagem meu
-- vinculado a ela.
create function public.participo_da_campanha(p_campanha_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.campanha_personagens cp
    join public.personagens p on p.id = cp.personagem_id
    where cp.campanha_id = p_campanha_id and p.user_id = auth.uid()
  );
$$;

-- Tenho convite ACEITO pra essa campanha? (usado pra liberar eu mesmo
-- vincular um personagem meu a ela)
create function public.tenho_convite_aceito(p_campanha_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.convites
    where campanha_id = p_campanha_id
      and usuario_convidado_id = auth.uid()
      and status = 'aceito'
  );
$$;

-- Quem pode VER um personagem (ficha + itens/armas/montaria): o dono,
-- o admin, ou o dono de alguma campanha onde esse personagem está
-- vinculado (equivalente ao antigo "mestre vê ficha da sua sessão").
create function public.pode_ver_personagem(p_personagem_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.personagens p
    where p.id = p_personagem_id
      and (
        public.is_admin()
        or p.user_id = auth.uid()
        or exists (
          select 1 from public.campanha_personagens cp
          join public.campanhas c on c.id = cp.campanha_id
          where cp.personagem_id = p.id and c.criado_por = auth.uid()
        )
      )
  );
$$;

-- ---------------------------------------------------------------------
-- PROFILES (igual v1: todo autenticado lê nome/e-mail/papel de todo
-- mundo — precisa pra busca de convite por e-mail exato)
-- ---------------------------------------------------------------------
create policy "profiles_select_all_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- CAMPANHAS
-- ---------------------------------------------------------------------
create policy "campanhas_select"
  on public.campanhas for select
  to authenticated
  using (
    public.is_admin()
    or criado_por = auth.uid()
    or public.participo_da_campanha(id)
    -- quem tem qualquer convite (pendente, aceito ou recusado) precisa
    -- ver ao menos o nome/descrição da campanha pra decidir/lembrar
    or exists (
      select 1 from public.convites
      where campanha_id = campanhas.id and usuario_convidado_id = auth.uid()
    )
  );

create policy "campanhas_insert"
  on public.campanhas for insert
  to authenticated
  with check (criado_por = auth.uid());

create policy "campanhas_update"
  on public.campanhas for update
  to authenticated
  using (criado_por = auth.uid() or public.is_admin());

create policy "campanhas_delete"
  on public.campanhas for delete
  to authenticated
  using (criado_por = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- PERSONAGENS — só o dono (ou admin) cria/edita/apaga. Ver é mais
-- aberto (dono da campanha vinculada também vê, mas não edita).
--
-- IMPORTANTE: usa as colunas da própria linha (user_id, id) direto, sem
-- passar por uma função que reconsulta "personagens" (auto-referência).
-- Uma versão anterior usava pode_ver_personagem(id) aqui e isso travava
-- a releitura da linha logo após o INSERT (o .select().single() do
-- client) — descoberto em produção em 13/07, corrigido na migração
-- 0003 pra quem já tinha rodado a versão antiga.
-- ---------------------------------------------------------------------
create policy "personagens_select"
  on public.personagens for select
  to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.campanha_personagens cp
      join public.campanhas c on c.id = cp.campanha_id
      where cp.personagem_id = personagens.id and c.criado_por = auth.uid()
    )
  );

create policy "personagens_insert"
  on public.personagens for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin());

create policy "personagens_update"
  on public.personagens for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "personagens_delete"
  on public.personagens for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- CAMPANHA_PERSONAGENS — o vínculo em si. Inserir exige ser dono do
-- personagem E (ser dono da campanha OU ter convite aceito nela).
-- ---------------------------------------------------------------------
create policy "campanha_personagens_select"
  on public.campanha_personagens for select
  to authenticated
  using (
    public.is_admin()
    or public.e_dono_da_campanha(campanha_id)
    or public.e_dono_do_personagem(personagem_id)
  );

create policy "campanha_personagens_insert"
  on public.campanha_personagens for insert
  to authenticated
  with check (
    public.is_admin()
    or (
      public.e_dono_do_personagem(personagem_id)
      and (public.e_dono_da_campanha(campanha_id) or public.tenho_convite_aceito(campanha_id))
    )
  );

create policy "campanha_personagens_delete"
  on public.campanha_personagens for delete
  to authenticated
  using (
    public.is_admin()
    or public.e_dono_da_campanha(campanha_id)
    or public.e_dono_do_personagem(personagem_id)
  );

-- ---------------------------------------------------------------------
-- CONVITES — só o dono da campanha convida. Só o convidado responde
-- (aceita/recusa). Dono da campanha ou o próprio convidado podem apagar
-- (cancelar / limpar da lista).
-- ---------------------------------------------------------------------
create policy "convites_select"
  on public.convites for select
  to authenticated
  using (
    public.is_admin()
    or usuario_convidado_id = auth.uid()
    or public.e_dono_da_campanha(campanha_id)
  );

create policy "convites_insert"
  on public.convites for insert
  to authenticated
  with check (public.is_admin() or public.e_dono_da_campanha(campanha_id));

create policy "convites_update"
  on public.convites for update
  to authenticated
  using (usuario_convidado_id = auth.uid() or public.is_admin());

create policy "convites_delete"
  on public.convites for delete
  to authenticated
  using (
    public.is_admin()
    or public.e_dono_da_campanha(campanha_id)
    or usuario_convidado_id = auth.uid()
  );

-- ---------------------------------------------------------------------
-- ITEMS / WEAPONS / MOUNTS — ver segue a mesma regra do personagem-pai
-- (pode_ver_personagem); escrever é só o dono do personagem (ou admin).
-- ---------------------------------------------------------------------
create policy "items_select" on public.items for select to authenticated
  using (public.pode_ver_personagem(personagem_id));
create policy "items_insert" on public.items for insert to authenticated
  with check (public.e_dono_do_personagem(personagem_id) or public.is_admin());
create policy "items_update" on public.items for update to authenticated
  using (public.e_dono_do_personagem(personagem_id) or public.is_admin())
  with check (public.e_dono_do_personagem(personagem_id) or public.is_admin());
create policy "items_delete" on public.items for delete to authenticated
  using (public.e_dono_do_personagem(personagem_id) or public.is_admin());

create policy "weapons_select" on public.weapons for select to authenticated
  using (public.pode_ver_personagem(personagem_id));
create policy "weapons_insert" on public.weapons for insert to authenticated
  with check (public.e_dono_do_personagem(personagem_id) or public.is_admin());
create policy "weapons_update" on public.weapons for update to authenticated
  using (public.e_dono_do_personagem(personagem_id) or public.is_admin())
  with check (public.e_dono_do_personagem(personagem_id) or public.is_admin());
create policy "weapons_delete" on public.weapons for delete to authenticated
  using (public.e_dono_do_personagem(personagem_id) or public.is_admin());

create policy "mounts_select" on public.mounts for select to authenticated
  using (public.pode_ver_personagem(personagem_id));
create policy "mounts_insert" on public.mounts for insert to authenticated
  with check (public.e_dono_do_personagem(personagem_id) or public.is_admin());
create policy "mounts_update" on public.mounts for update to authenticated
  using (public.e_dono_do_personagem(personagem_id) or public.is_admin())
  with check (public.e_dono_do_personagem(personagem_id) or public.is_admin());
create policy "mounts_delete" on public.mounts for delete to authenticated
  using (public.e_dono_do_personagem(personagem_id) or public.is_admin());