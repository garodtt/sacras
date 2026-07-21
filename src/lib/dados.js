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

// 13/07 — usado pelo turno/rodada do Rastreador de Combate
// (combate_turno_index, combate_rodada).
export function atualizarCampanha(id, campos) {
  return supabase.from('campanhas').update(campos).eq('id', id).select().single();
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

// 13/07 — estendida com foto e Vida/Dor: alimenta os cartões de
// personagem na visão do Mestre (CampanhaDetalhe.jsx), que mostra um
// resumo de cada um sem precisar entrar na ficha.
// 13/07 — estendida com foto, Vida/Dor, dinheiro e updated_at:
// alimenta os cartões de personagem na visão do Mestre
// (CampanhaDetalhe.jsx), que mostra um resumo de cada um sem precisar
// entrar na ficha.
export function listarPersonagensDaCampanha(campanhaId) {
  return supabase
    .from('campanha_personagens')
    .select(
      'id, personagem:personagens(id, nome, user_id, foto_url, circulos_vida_atual, circulos_vida_max, circulos_dor_atual, circulos_dor_max, dinheiro, updated_at, dono:profiles(display_name))'
    )
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

// Campanhas onde ESTE personagem está vinculado, com quem criou cada
// uma (`criado_por`) — usado em Personagem.jsx pra saber se quem está
// olhando a ficha é Mestre de alguma delas (e por isso pode editar,
// mesmo não sendo o dono do personagem). RLS (campanha_personagens_select)
// já filtra: só volta linha se o usuário puder ver aquele vínculo
// (dono do personagem, dono da campanha, ou Admin).
export function listarCampanhasDoPersonagem(personagemId) {
  return supabase
    .from('campanha_personagens')
    .select('campanha:campanhas(id, nome, criado_por)')
    .eq('personagem_id', personagemId);
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

// 13/07 — busca por nome de exibição OU e-mail, com correspondência
// PARCIAL (antes só existia por e-mail exato — travava se a pessoa não
// soubesse o e-mail de cadastro de cor). RLS já permite ver qualquer
// perfil (profiles_select_all_authenticated), então é só uma consulta
// nova, sem policy nova.
// 13/07, 2ª revisão — trocado de um único .or() pra duas consultas
// simples (nome, depois e-mail) combinadas aqui — o .or() do
// PostgREST tem regras de escape específicas pra caracteres especiais
// dentro do valor, e prefiro não depender disso funcionar igual em
// todo caso. Deduplica por id (uma pessoa pode bater nos dois
// critérios) e limita a 10 no total.
export async function buscarUsuarioPorNomeOuEmail(termo) {
  const busca = `%${termo.trim()}%`;

  const [porNome, porEmail] = await Promise.all([
    supabase.from('profiles').select('id, display_name, email, role').ilike('display_name', busca).limit(10),
    supabase.from('profiles').select('id, display_name, email, role').ilike('email', busca).limit(10),
  ]);

  if (porNome.error) return { data: null, error: porNome.error };
  if (porEmail.error) return { data: null, error: porEmail.error };

  const vistos = new Set();
  const combinado = [];
  for (const linha of [...(porNome.data ?? []), ...(porEmail.data ?? [])]) {
    if (!vistos.has(linha.id)) {
      vistos.add(linha.id);
      combinado.push(linha);
    }
  }

  return { data: combinado.slice(0, 10), error: null };
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
    .order('ordem', { ascending: true });
}

export function adicionarHabilidadeCatalogo(personagemId, catalogoId, ordem) {
  return supabase
    .from('personagem_habilidades')
    .insert({ personagem_id: personagemId, catalogo_id: catalogoId, ordem })
    .select('*, habilidades_catalogo(id, nome, descricao)')
    .single();
}

export function criarHabilidadeCustomizada(personagemId, nome, ordem) {
  return supabase
    .from('personagem_habilidades')
    .insert({ personagem_id: personagemId, nome_customizado: nome, ordem })
    .select('*, habilidades_catalogo(id, nome, descricao)')
    .single();
}

export function removerHabilidadePersonagem(id) {
  return supabase.from('personagem_habilidades').delete().eq('id', id);
}

// Reordenar (13/07) — botões de mover pra cima/baixo trocam a `ordem`
// de duas habilidades vizinhas de uma vez (mais confiável no celular
// do que arrastar). `atualizarCampo` genérica já existe pra outras
// tabelas; aqui é específico só pra deixar a troca de par explícita.
export function trocarOrdemHabilidades(idA, ordemA, idB, ordemB) {
  return Promise.all([
    supabase.from('personagem_habilidades').update({ ordem: ordemB }).eq('id', idA).select().single(),
    supabase.from('personagem_habilidades').update({ ordem: ordemA }).eq('id', idB).select().single(),
  ]);
}

// ---------------------------------------------------------------------
// RASTREADOR DE COMBATE — ferramenta do Mestre (por campanha). Ordena
// por Iniciativa igual o gerenciador antigo (maior primeiro).
// ---------------------------------------------------------------------

// 13/07 — embute o personagem ligado (quando existir) na mesma
// consulta: Vida/Dor vêm sempre ao vivo daqui, sem precisar buscar
// separado nem copiar em `combate_entradas`.
export function listarCombateEntradas(campanhaId) {
  return supabase
    .from('combate_entradas')
    .select('*, personagem:personagens(id, nome, circulos_vida_atual, circulos_vida_max, circulos_dor_atual, circulos_dor_max)')
    .eq('campanha_id', campanhaId)
    .order('iniciativa', { ascending: false })
    .order('created_at', { ascending: true });
}

export function criarCombateEntrada(campanhaId, dados) {
  return supabase
    .from('combate_entradas')
    .insert({ campanha_id: campanhaId, ...dados })
    .select('*, personagem:personagens(id, nome, circulos_vida_atual, circulos_vida_max, circulos_dor_atual, circulos_dor_max)')
    .single();
}

export function atualizarCombateEntrada(id, campos) {
  return supabase
    .from('combate_entradas')
    .update(campos)
    .eq('id', id)
    .select('*, personagem:personagens(id, nome, circulos_vida_atual, circulos_vida_max, circulos_dor_atual, circulos_dor_max)')
    .single();
}

export function removerCombateEntrada(id) {
  return supabase.from('combate_entradas').delete().eq('id', id);
}

export function removerTodasCombateEntradas(campanhaId) {
  return supabase.from('combate_entradas').delete().eq('campanha_id', campanhaId);
}

// ---------------------------------------------------------------------
// PERFIL — nome e foto (13/07). RLS (profiles_update_own_or_admin) já
// permitia o usuário editar a própria linha desde a Fase 1; só nunca
// tinha tela pra isso.
// ---------------------------------------------------------------------
export function atualizarProfile(userId, campos) {
  return supabase.from('profiles').update(campos).eq('id', userId).select().single();
}

// ---------------------------------------------------------------------
// TRILHA DE REDENÇÃO (13/07) — 6 passos fixos por trilha escolhida.
// ---------------------------------------------------------------------
export function listarTrilhaPersonagem(personagemId) {
  return supabase
    .from('personagem_trilha_passos')
    .select('*')
    .eq('personagem_id', personagemId)
    .order('numero', { ascending: true });
}

// Escolher uma trilha (ou trocar de trilha): apaga os passos da
// trilha anterior (se houver) e insere os 6 novos, pré-preenchidos com
// o texto padrão do livro — o jogador edita depois pra colocar nomes e
// detalhes de verdade da própria história.
export async function escolherTrilha(personagemId, trilhaId, passosTexto) {
  const { error: erroLimpar } = await supabase
    .from('personagem_trilha_passos')
    .delete()
    .eq('personagem_id', personagemId);
  if (erroLimpar) return { data: null, error: erroLimpar };

  return supabase
    .from('personagem_trilha_passos')
    .insert(
      passosTexto.map((texto, i) => ({
        personagem_id: personagemId,
        trilha: trilhaId,
        numero: i + 1,
        texto,
      }))
    )
    .select()
    .order('numero', { ascending: true });
}

export function atualizarPassoTrilha(id, campos) {
  return supabase.from('personagem_trilha_passos').update(campos).eq('id', id).select().single();
}

export function removerTrilhaPersonagem(personagemId) {
  return supabase.from('personagem_trilha_passos').delete().eq('personagem_id', personagemId);
}

// ---------------------------------------------------------------------
// NOTAS DO MESTRE (13/07) — privadas, uma linha por campanha. RLS
// (migration 0019) já garante que só o dono da campanha (ou Admin)
// consegue ver/mexer — nunca chega no navegador de um jogador.
// ---------------------------------------------------------------------
export function buscarNotasMestre(campanhaId) {
  return supabase.from('campanha_notas_mestre').select('*').eq('campanha_id', campanhaId).maybeSingle();
}

// upsert: cria a linha na primeira vez que o Mestre escreve algo,
// atualiza depois — evita ter que criar a linha vazia toda vez que uma
// campanha nova é feita (a maioria pode nunca usar isso).
export function salvarNotasMestre(campanhaId, notas) {
  return supabase
    .from('campanha_notas_mestre')
    .upsert({ campanha_id: campanhaId, notas, updated_at: new Date().toISOString() })
    .select()
    .single();
}

// ---------------------------------------------------------------------
// BIBLIOTECA DE NPCs DA CAMPANHA (13/07) — moldes reutilizáveis (só
// Vida/Dor/Balas MÁXIMOS), organizados por pasta. Puxar um pro
// Rastreador de Combate cria uma linha independente em
// combate_entradas (ver Combate.jsx) — não é um vínculo ao vivo.
// ---------------------------------------------------------------------
export function listarNpcsCampanha(campanhaId) {
  return supabase
    .from('campanha_npcs')
    .select('*')
    .eq('campanha_id', campanhaId)
    .order('nome', { ascending: true });
}

// ---------------------------------------------------------------------
// PASTAS DE NPC (13/07) — entidade própria (nome + descrição), não só
// texto solto repetido em cada NPC (migration 0023).
// ---------------------------------------------------------------------
export function listarPastasNpc(campanhaId) {
  return supabase.from('campanha_pastas_npc').select('*').eq('campanha_id', campanhaId).order('nome', { ascending: true });
}

export function criarPastaNpc(campanhaId, { nome, descricao = '' }) {
  return supabase.from('campanha_pastas_npc').insert({ campanha_id: campanhaId, nome, descricao }).select().single();
}

export function atualizarPastaNpc(id, campos) {
  return supabase.from('campanha_pastas_npc').update(campos).eq('id', id).select().single();
}

// Remover uma pasta NÃO apaga os NPCs dentro dela — a coluna
// `campanha_npcs.pasta_id` é `on delete set null`; eles só ficam
// "sem pasta" (mostrados à parte, não perdidos).
export function removerPastaNpc(id) {
  return supabase.from('campanha_pastas_npc').delete().eq('id', id);
}

export function criarNpcCampanha(campanhaId, dados) {
  return supabase
    .from('campanha_npcs')
    .insert({ campanha_id: campanhaId, ...dados })
    .select()
    .single();
}

export function atualizarNpcCampanha(id, campos) {
  return supabase.from('campanha_npcs').update(campos).eq('id', id).select().single();
}

export function removerNpcCampanha(id) {
  return supabase.from('campanha_npcs').delete().eq('id', id);
}

// ---------------------------------------------------------------------
// NOTA PRIVADA DO MESTRE POR PERSONAGEM (13/07) — por VÍNCULO
// (campanha_personagens.id), não pelo personagem direto: o mesmo
// personagem pode estar em mais de uma campanha, com segredos
// diferentes em cada uma. RLS (migration 0021) garante que só quem
// gerencia a campanha vê — nunca o dono do personagem.
// ---------------------------------------------------------------------

// Busca todas de uma vez (uma linha por vínculo já carregado na tela),
// em vez de uma consulta por cartão — mais barato.
export function listarNotasPersonagensCampanha(campanhaPersonagemIds) {
  if (!campanhaPersonagemIds || campanhaPersonagemIds.length === 0) {
    return Promise.resolve({ data: [], error: null });
  }
  return supabase.from('campanha_personagem_notas').select('*').in('campanha_personagem_id', campanhaPersonagemIds);
}

export function salvarNotaPersonagemCampanha(campanhaPersonagemId, notas) {
  return supabase
    .from('campanha_personagem_notas')
    .upsert({ campanha_personagem_id: campanhaPersonagemId, notas, updated_at: new Date().toISOString() })
    .select()
    .single();
}

// ---------------------------------------------------------------------
// AÇÕES EM LOTE (13/07) — remover vários vínculos de campanha_personagens
// de uma vez (mesmo padrão do "Dano em área" do Combate: seleciona
// vários, aplica uma vez).
// ---------------------------------------------------------------------
export function removerVinculosEmLote(ids) {
  return supabase.from('campanha_personagens').delete().in('id', ids);
}

// ---------------------------------------------------------------------
// INVENTÁRIO DE NPC (13/07) — bem mais simples que o de personagem
// (sem peso/espaço/mochila, só "o que ele tem").
// ---------------------------------------------------------------------
export function listarItensNpc(npcId) {
  return supabase.from('campanha_npc_itens').select('*').eq('npc_id', npcId).order('created_at', { ascending: true });
}

export function criarItemNpc(npcId, { nome, quantidade = 1, descricao = '' }) {
  return supabase.from('campanha_npc_itens').insert({ npc_id: npcId, nome, quantidade, descricao }).select().single();
}

export function removerItemNpc(id) {
  return supabase.from('campanha_npc_itens').delete().eq('id', id);
}