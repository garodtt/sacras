import { supabase } from './supabaseClient.js';

// ---------------------------------------------------------------------
// PERSONAGENS — pertencem só ao usuário, independente de campanha.
// ---------------------------------------------------------------------

export function listarMeusPersonagens(userId) {
  return supabase
    .from('personagens')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
}

export function buscarPersonagem(id) {
  return supabase.from('personagens').select('*').eq('id', id).single();
}

export function criarPersonagem({ userId, nome }) {
  return supabase
    .from('personagens')
    .insert({ user_id: userId, nome })
    .select()
    .single();
}

// Admin: todos os personagens do sistema, com o dono
export function listarTodosPersonagens() {
  return supabase
    .from('personagens')
    .select('id, nome, user_id, created_at, dono:profiles(display_name, email)')
    .order('created_at', { ascending: false });
}

// ---------------------------------------------------------------------
// CAMPANHAS — qualquer usuário cria; substitui "sessions".
// ---------------------------------------------------------------------

export function listarMinhasCampanhas(userId) {
  return supabase
    .from('campanhas')
    .select('*')
    .eq('criado_por', userId)
    .order('created_at', { ascending: false });
}

// Campanhas em que EU participo (tenho >=1 personagem vinculado).
// Feito em 2 passos (pega meus personagens, depois os vínculos deles) —
// mais simples e mais fácil de confiar do que filtrar um embed aninhado.
export async function listarCampanhasQueParticipo(userId) {
  const { data: meus, error: errMeus } = await supabase
    .from('personagens')
    .select('id')
    .eq('user_id', userId);

  if (errMeus) return { data: null, error: errMeus };
  if (!meus || meus.length === 0) return { data: [], error: null };

  return supabase
    .from('campanha_personagens')
    .select('campanha_id, personagem_id, campanha:campanhas(id, nome, descricao, criado_por, created_at)')
    .in('personagem_id', meus.map((p) => p.id));
}

export function buscarCampanha(id) {
  return supabase.from('campanhas').select('*').eq('id', id).single();
}

export function criarCampanha({ nome, descricao, criadoPor }) {
  return supabase
    .from('campanhas')
    .insert({ nome, descricao, criado_por: criadoPor })
    .select()
    .single();
}

// Admin: todas as campanhas do sistema, com o dono
export function listarTodasCampanhas() {
  return supabase
    .from('campanhas')
    .select('*, dono:profiles(display_name, email)')
    .order('created_at', { ascending: false });
}

// ---------------------------------------------------------------------
// VÍNCULO CAMPANHA <-> PERSONAGEM (N:N — um personagem pode estar em
// várias campanhas ao mesmo tempo)
// ---------------------------------------------------------------------

export function listarPersonagensDaCampanha(campanhaId) {
  return supabase
    .from('campanha_personagens')
    .select('id, personagem:personagens(id, nome, user_id, dono:profiles(display_name))')
    .eq('campanha_id', campanhaId);
}

// Exige (RLS): ser dono do personagem E (ser dono da campanha OU ter
// convite aceito nela) — ver 0002_rls_policies.sql.
export function vincularPersonagem({ campanhaId, personagemId }) {
  return supabase
    .from('campanha_personagens')
    .insert({ campanha_id: campanhaId, personagem_id: personagemId })
    .select()
    .single();
}

export function desvincularPersonagem(vinculoId) {
  return supabase.from('campanha_personagens').delete().eq('id', vinculoId);
}

// ---------------------------------------------------------------------
// CONVITES — "comunicação interna", sem disparo de e-mail real.
// ---------------------------------------------------------------------

// Busca por e-mail EXATO (case-insensitive) — não é busca parcial, de
// propósito, pra não virar uma forma de listar e-mails de todo mundo aos
// poucos digitando letras.
export function buscarUsuarioPorEmail(email) {
  return supabase
    .from('profiles')
    .select('id, display_name, email, role')
    .ilike('email', email.trim());
}

export function convidarParaCampanha({ campanhaId, usuarioId }) {
  return supabase
    .from('convites')
    .insert({ campanha_id: campanhaId, usuario_convidado_id: usuarioId })
    .select()
    .single();
}

// Convites recebidos por mim que ainda estão pendentes (pro painel)
export function listarConvitesPendentes(userId) {
  return supabase
    .from('convites')
    .select('id, status, created_at, campanha:campanhas(id, nome, descricao, criado_por, dono:profiles(display_name))')
    .eq('usuario_convidado_id', userId)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false });
}

// Convites enviados por uma campanha (visão de quem criou)
export function listarConvitesDaCampanha(campanhaId) {
  return supabase
    .from('convites')
    .select('id, status, created_at, usuario:profiles(id, display_name, email)')
    .eq('campanha_id', campanhaId)
    .order('created_at', { ascending: false });
}

// status: 'aceito' | 'recusado'
export function responderConvite(convId, status) {
  return supabase
    .from('convites')
    .update({ status, respondido_em: new Date().toISOString() })
    .eq('id', convId)
    .select()
    .single();
}

// "Eu tenho convite ACEITO nesta campanha?" — usado pra decidir se
// mostro o formulário de vincular personagem mesmo antes de eu ter
// vinculado o 1º (nesse momento eu ainda não apareceria como
// "participante" via campanha_personagens).
export function meuAcessoNaCampanha(campanhaId, userId) {
  return supabase
    .from('convites')
    .select('id')
    .eq('campanha_id', campanhaId)
    .eq('usuario_convidado_id', userId)
    .eq('status', 'aceito')
    .limit(1);
}

// ---------------------------------------------------------------------
// PERSONAGEM — editar campos da ficha completa (Fase 5). Aceita 1 ou
// vários campos de uma vez, ex.: atualizarPersonagem(id, { atributo_fisico: 2 }).
// RLS (personagens_update) já garante que só o dono (ou admin) consegue;
// isso aqui não reforça a regra, só reflete o que o banco já decide.
// ---------------------------------------------------------------------

export function atualizarPersonagem(id, campos) {
  return supabase
    .from('personagens')
    .update(campos)
    .eq('id', id)
    .select()
    .single();
}

// ---------------------------------------------------------------------
// ITENS — inventário (tabela `items`, 1 personagem : N itens).
// ---------------------------------------------------------------------

export function listarItens(personagemId) {
  return supabase
    .from('items')
    .select('*')
    .eq('personagem_id', personagemId)
    .order('ordem', { ascending: true });
}

export function criarItem(personagemId, ordem) {
  return supabase
    .from('items')
    .insert({ personagem_id: personagemId, ordem })
    .select()
    .single();
}

export function atualizarItem(id, campos) {
  return supabase.from('items').update(campos).eq('id', id).select().single();
}

export function removerItem(id) {
  return supabase.from('items').delete().eq('id', id);
}

// ---------------------------------------------------------------------
// ARMAS (tabela `weapons`, 1 personagem : N armas). Munição e tipo de
// dano já existem como colunas (do projeto antigo) mas ainda não têm
// campo na UI — pergunta em aberto nº4, docs/ARQUITETURA.md seção 6.
// ---------------------------------------------------------------------

export function listarArmas(personagemId) {
  return supabase
    .from('weapons')
    .select('*')
    .eq('personagem_id', personagemId)
    .order('ordem', { ascending: true });
}

export function criarArma(personagemId, ordem) {
  return supabase
    .from('weapons')
    .insert({ personagem_id: personagemId, ordem })
    .select()
    .single();
}

export function atualizarArma(id, campos) {
  return supabase.from('weapons').update(campos).eq('id', id).select().single();
}

export function removerArma(id) {
  return supabase.from('weapons').delete().eq('id', id);
}

// ---------------------------------------------------------------------
// MONTARIA (tabela `mounts`) — 0 ou 1 por personagem (unique em
// personagem_id). maybeSingle() porque "ainda não tem montaria" (0
// linhas) é um resultado válido aqui, não um erro.
// ---------------------------------------------------------------------

export function buscarMontaria(personagemId) {
  return supabase
    .from('mounts')
    .select('*')
    .eq('personagem_id', personagemId)
    .maybeSingle();
}

export function criarMontaria(personagemId, nome) {
  return supabase
    .from('mounts')
    .insert({ personagem_id: personagemId, nome })
    .select()
    .single();
}

export function atualizarMontaria(id, campos) {
  return supabase.from('mounts').update(campos).eq('id', id).select().single();
}

export function removerMontaria(id) {
  return supabase.from('mounts').delete().eq('id', id);
}

// ---------------------------------------------------------------------
// ITENS DA MONTARIA — mesma tabela `items`, só que com mount_id em vez
// de personagem_id (constraint items_dono_unico garante que é um ou
// outro, nunca os dois). Regras novas de 13/07.
// ---------------------------------------------------------------------

export function listarItensMontaria(mountId) {
  return supabase
    .from('items')
    .select('*')
    .eq('mount_id', mountId)
    .order('ordem', { ascending: true });
}

export function criarItemMontaria(mountId, ordem, localMontaria) {
  return supabase
    .from('items')
    .insert({ mount_id: mountId, ordem, local_montaria: localMontaria })
    .select()
    .single();
}

// "Excluir todos" — usado tanto no inventário do personagem quanto no
// da montaria (mesma tabela, filtro diferente).
export function removerTodosItensPersonagem(personagemId) {
  return supabase.from('items').delete().eq('personagem_id', personagemId);
}

export function removerTodosItensMontaria(mountId) {
  return supabase.from('items').delete().eq('mount_id', mountId);
}

// Excluir só os itens de UM sub-local da montaria (ex.: "larguei a
// bolsa" — some só o que tava nela, cavalo/carro/carroça continuam).
export function removerItensMontariaPorLocal(mountId, localMontaria) {
  return supabase.from('items').delete().eq('mount_id', mountId).eq('local_montaria', localMontaria);
}

// ---------------------------------------------------------------------
// HABILIDADES — catálogo compartilhado (do livro, gerenciado pelo
// admin) + o que cada personagem tem. `catalogo_id` nulo numa linha de
// personagem_habilidades = habilidade criada pelo próprio jogador (não
// precisa de coluna separada pra marcar isso).
// ---------------------------------------------------------------------

export function listarCatalogoHabilidades() {
  return supabase
    .from('habilidades_catalogo')
    .select('*')
    .order('categoria', { ascending: true })
    .order('nome', { ascending: true });
}

export function listarHabilidadesPersonagem(personagemId) {
  return supabase
    .from('personagem_habilidades')
    .select('*, habilidades_catalogo(id, nome, descricao)')
    .eq('personagem_id', personagemId)
    .order('created_at', { ascending: true });
}

export function adicionarHabilidadeCatalogo(personagemId, catalogoId) {
  return supabase
    .from('personagem_habilidades')
    .insert({ personagem_id: personagemId, catalogo_id: catalogoId })
    .select('*, habilidades_catalogo(id, nome, descricao)')
    .single();
}

export function criarHabilidadeCustomizada(personagemId, nome) {
  return supabase
    .from('personagem_habilidades')
    .insert({ personagem_id: personagemId, nome_customizado: nome })
    .select('*, habilidades_catalogo(id, nome, descricao)')
    .single();
}

export function removerHabilidadePersonagem(id) {
  return supabase.from('personagem_habilidades').delete().eq('id', id);
}

// ---------------------------------------------------------------------
// RASTREADOR DE COMBATE — ferramenta do Mestre (por campanha). Ordena
// por Iniciativa igual o gerenciador antigo (maior primeiro).
// ---------------------------------------------------------------------

export function listarCombateEntradas(campanhaId) {
  return supabase
    .from('combate_entradas')
    .select('*')
    .eq('campanha_id', campanhaId)
    .order('iniciativa', { ascending: false })
    .order('created_at', { ascending: true });
}

export function criarCombateEntrada(campanhaId, dados) {
  return supabase
    .from('combate_entradas')
    .insert({ campanha_id: campanhaId, ...dados })
    .select()
    .single();
}

export function atualizarCombateEntrada(id, campos) {
  return supabase.from('combate_entradas').update(campos).eq('id', id).select().single();
}

export function removerCombateEntrada(id) {
  return supabase.from('combate_entradas').delete().eq('id', id);
}

export function removerTodasCombateEntradas(campanhaId) {
  return supabase.from('combate_entradas').delete().eq('campanha_id', campanhaId);
}