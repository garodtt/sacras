-- =====================================================================
-- Sacramento RPG — Migração 0015: Trilha de Redenção do personagem.
--
-- Cada personagem escolhe UMA das 6 trilhas (Vingança/Fuga/Dívida/
-- Remorso/Recomeço/Ambição), cada uma com 6 passos fixos. Ao completar
-- os 6, ganha a recompensa de Redenção (+1 Habilidade, +2 Vida, carta
-- extra na Iniciativa) — a recompensa é só celebrada na tela, não
-- aplicada sozinha: qual Habilidade escolher é decisão do jogador, e
-- mexer na Vida máx. direto atropelaria o cálculo por Atributo que já
-- existe.
--
-- Uma linha por passo (não uma coluna JSON) — mesmo padrão relacional
-- do resto do projeto. `texto` começa com a frase padrão do livro (tem
-- lacunas tipo "(nome)") mas o jogador pode editar pra preencher com a
-- história de verdade do próprio personagem — o livro sugere isso
-- explicitamente ("Preencha as lacunas com ideias de acontecimentos e
-- NPCs que estejam na sua jornada").
-- =====================================================================

create table public.personagem_trilha_passos (
  id           uuid primary key default gen_random_uuid(),
  personagem_id uuid not null references public.personagens(id) on delete cascade,
  trilha       text not null check (trilha in ('vinganca', 'fuga', 'divida', 'remorso', 'recomeco', 'ambicao')),
  numero       int not null check (numero between 1 and 6),
  texto        text not null default '',
  concluido    boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (personagem_id, trilha, numero)
);

comment on table public.personagem_trilha_passos is 'Os 6 passos da Trilha de Redenção escolhida por um personagem — só uma trilha ativa por vez (ver dados.js: escolher uma nova apaga os passos da anterior).';

create index idx_trilha_passos_personagem on public.personagem_trilha_passos(personagem_id);

alter table public.personagem_trilha_passos enable row level security;

-- Mesma regra de sempre pra dados do personagem: dono, Mestre de
-- campanha vinculada, ou Admin.
create policy "trilha_passos_select" on public.personagem_trilha_passos for select to authenticated
  using (
    public.e_dono_do_personagem(personagem_id)
    or public.e_mestre_de_campanha_do_personagem(personagem_id)
    or (select public.is_admin())
  );

create policy "trilha_passos_insert" on public.personagem_trilha_passos for insert to authenticated
  with check (
    public.e_dono_do_personagem(personagem_id)
    or public.e_mestre_de_campanha_do_personagem(personagem_id)
    or (select public.is_admin())
  );

create policy "trilha_passos_update" on public.personagem_trilha_passos for update to authenticated
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

create policy "trilha_passos_delete" on public.personagem_trilha_passos for delete to authenticated
  using (
    public.e_dono_do_personagem(personagem_id)
    or public.e_mestre_de_campanha_do_personagem(personagem_id)
    or (select public.is_admin())
  );