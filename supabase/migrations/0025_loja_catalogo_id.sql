-- =====================================================================
-- Sacramento RPG — Migração 0025: liga um item da Loja da Campanha a
-- um item do Catálogo de Equipamento padrão (`src/lib/catalogoCompras.js`,
-- não uma tabela — o catálogo fixo do livro é código, não banco).
--
-- Antes, `campanha_loja_itens` só servia pra itens 100% novos (o
-- Mestre digitava tudo do zero). Isso permite "importar" um item do
-- catálogo padrão pra dentro da loja da campanha já preenchido, editar
-- só o que quiser (preço, peso, descrição...), e o resultado
-- SUBSTITUI a versão padrão desse item especificamente NESSA
-- campanha — as outras campanhas continuam vendo o catálogo original.
-- =====================================================================

alter table public.campanha_loja_itens
  add column catalogo_id text;

comment on column public.campanha_loja_itens.catalogo_id is 'Se preenchido, este item é uma PERSONALIZAÇÃO de um item do catálogo padrão (src/lib/catalogoCompras.js) — o valor é o `id` daquele item no catálogo. Se nulo, é um item 100% novo, exclusivo desta campanha.';