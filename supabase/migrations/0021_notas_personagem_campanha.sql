-- =====================================================================
-- Sacramento RPG — Migração 0021: nota privada do Mestre por
-- personagem VINCULADO a uma campanha (ganchos de história, segredos)
-- — nunca visível ao jogador, nunca misturada com a ficha dele.
--
-- Chave é `campanha_personagens.id` (o VÍNCULO), não `personagens.id`
-- direto: o mesmo personagem pode estar em mais de uma campanha, e a
-- nota faz sentido ser por campanha (o segredo que importa numa
-- história pode não ter nada a ver com outra). Mesmo motivo de sempre
-- pra ser tabela própria (0019): RLS é por linha, não por coluna — se
-- fosse uma coluna solta em `personagens`, o DONO do personagem (o
-- jogador) receberia ela também numa consulta normal da própria ficha,
-- mesmo se a tela nunca mostrasse.
-- =====================================================================

create table public.campanha_personagem_notas (
  campanha_personagem_id uuid primary key references public.campanha_personagens(id) on delete cascade,
  notas       text not null default '',
  updated_at  timestamptz not null default now()
);

comment on table public.campanha_personagem_notas is 'Nota privada do Mestre sobre um personagem, específica de UM vínculo campanha-personagem — nunca visível ao jogador dono do personagem.';

alter table public.campanha_personagem_notas enable row level security;

-- Mesma regra de sempre: só quem criou a campanha (ou Admin) — nunca o
-- dono do personagem, mesmo sendo o dono do próprio personagem.
create policy "campanha_personagem_notas_select" on public.campanha_personagem_notas for select to authenticated
  using (
    exists (
      select 1 from public.campanha_personagens cp
      join public.campanhas c on c.id = cp.campanha_id
      where cp.id = campanha_personagem_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "campanha_personagem_notas_insert" on public.campanha_personagem_notas for insert to authenticated
  with check (
    exists (
      select 1 from public.campanha_personagens cp
      join public.campanhas c on c.id = cp.campanha_id
      where cp.id = campanha_personagem_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "campanha_personagem_notas_update" on public.campanha_personagem_notas for update to authenticated
  using (
    exists (
      select 1 from public.campanha_personagens cp
      join public.campanhas c on c.id = cp.campanha_id
      where cp.id = campanha_personagem_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  )
  with check (
    exists (
      select 1 from public.campanha_personagens cp
      join public.campanhas c on c.id = cp.campanha_id
      where cp.id = campanha_personagem_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "campanha_personagem_notas_delete" on public.campanha_personagem_notas for delete to authenticated
  using (
    exists (
      select 1 from public.campanha_personagens cp
      join public.campanhas c on c.id = cp.campanha_id
      where cp.id = campanha_personagem_id and (c.criado_por = (select auth.uid()) or (select public.is_admin()))
    )
  );