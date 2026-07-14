-- =====================================================================
-- Sacramento RPG — Migração 0010: corrige bug — personagem_habilidades
-- nunca teve política de UPDATE.
--
-- Sintoma relatado: reordenar habilidades (▲/▼) não funcionava, com o
-- erro "Cannot coerce the result to a single JSON object" — esse erro
-- do PostgREST acontece quando um update+select().single() não afeta
-- NENHUMA linha. Causa: a tabela só tinha políticas de select/insert/
-- delete desde que foi criada (migration 0003) — nunca precisou de
-- update até a função de reordenar (migration 0009) existir. Sem
-- política de update, o RLS bloqueia silenciosamente (0 linhas
-- afetadas), não com um erro de permissão explícito.
--
-- Mesma regra das outras políticas dessa tabela: dono do personagem,
-- Admin, ou Mestre de campanha vinculada (migration 0008).
-- =====================================================================

create policy "personagem_habilidades_update"
  on public.personagem_habilidades
  for update
  to authenticated
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