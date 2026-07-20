-- =====================================================================
-- Sacramento RPG — Migração 0016: habilita Realtime em `personagens` e
-- `combate_entradas`, pro Rastreador de Combate atualizar sozinho
-- quando o jogador mexe na própria ficha (ou o Mestre mexe no
-- Rastreador) enquanto a outra tela está aberta ao mesmo tempo.
--
-- Sem isso, cada mudança só aparecia na próxima vez que a tela
-- buscasse dados de novo (F5, reentrar, importar de novo) — o que já
-- documentei como limitação conhecida quando o Combate foi ligado a
-- personagens de verdade (migration 0013).
--
-- RLS continua valendo pra Realtime — o Supabase só entrega o evento
-- pra quem já teria permissão de SELECT naquela linha, então não abre
-- nenhum buraco de segurança novo.
-- =====================================================================

alter publication supabase_realtime add table public.personagens;
alter publication supabase_realtime add table public.combate_entradas;