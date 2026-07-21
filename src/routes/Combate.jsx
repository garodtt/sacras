import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import PopupConfirmar from '../components/PopupConfirmar.jsx';
import {
  buscarCampanha,
  atualizarCampanha,
  listarCombateEntradas,
  criarCombateEntrada,
  atualizarCombateEntrada,
  removerCombateEntrada,
  removerTodasCombateEntradas,
  listarPersonagensDaCampanha,
  listarArmas,
  atualizarPersonagem,
  listarNpcsCampanha,
  listarPastasNpc,
} from '../lib/dados.js';
import { MODELOS_NPC } from '../lib/modelosNpc.js';
import { aplicarDano, ajustarValorSimples } from '../lib/regras.js';
import CampoEditavel from '../components/personagem/CampoEditavel.jsx';
import { EFEITOS_DOR } from '../components/personagem/EfeitoDorPopup.jsx';
import PopupReferencia from '../components/combate/PopupReferencia.jsx';
import BarraVidaDor from '../components/BarraVidaDor.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';
import Breadcrumb from '../components/Breadcrumb.jsx';

const TIPO_LABEL = { npc: 'NPC', jogador: 'Jogador' };

// Facção (13/07) — agrupar por cor em combates com várias gangues ao
// mesmo tempo. Só 3 opções fixas (não texto livre) — simples de
// escanear rápido numa lista grande; "aliado" existe pro caso raro de
// um NPC lutando do lado dos jogadores.
const FACCAO_LABEL = { aliado: 'Aliado', inimigo: 'Inimigo', neutro: 'Neutro' };

// Bônus por carta na Iniciativa — texto vem direto do livro. O ícone da
// carta J é a caveira (Vida), igual às outras habilidades do catálogo.
const CARTAS_INICIATIVA = [
  { carta: 'A', bonus: '+1 para Testes de Violência' },
  { carta: 'K', bonus: '+1 Ação de Combate' },
  { carta: 'Q', bonus: '+1 Movimento' },
  { carta: 'J', bonus: '+1 de Vida' },
];

// "Mortal" (linha 1) é a única com ícone no livro — dano crítico
// (punho = Dor), não ganho de Vida pro atacante. Assumido a partir do
// contexto (é a tabela de ACERTO crítico); se estiver errado, é só
// avisar.
const ACERTOS_CRITICOS = [
  { n: 1, nome: 'Mortal', efeito: '+2 de Dor no ataque.' },
  { n: 2, nome: 'Dança Maluca', efeito: 'O inimigo perde seu próximo turno no combate.' },
  { n: 3, nome: 'Desarmar', efeito: 'O inimigo não pode mais atirar com aquela arma.' },
  { n: 4, nome: 'Vantagem Moral', efeito: '+1 para seus Testes de Violência até o fim do combate.' },
  { n: 5, nome: 'Vantagem Tática', efeito: '+1 Movimento no seu turno até o fim do combate.' },
  { n: 6, nome: 'Marca da Vingança', efeito: 'O inimigo foge, mas jura vingança contra você.' },
];

const FALHAS_CRITICAS = [
  { n: 1, efeito: 'Seu ataque acerta um aliado ou uma pessoa inocente.' },
  { n: 2, efeito: 'Sua arma quebra ou, em caso de porrada, o dano é anulado.' },
  { n: 3, efeito: 'Guarda aberta: +1 em testes dos inimigos contra você até o fim do combate.' },
  { n: 4, efeito: 'Pressão: -1 no ataque contra os inimigos até o fim do combate.' },
  { n: 5, efeito: 'Você está abatido e perde seu próximo turno para se recompor.' },
  { n: 6, efeito: 'Você cai... igual bosta. E perde duas ações de qualquer tipo para levantar.' },
];

// Rastreador de combate do Mestre (13/07, revisado). NPCs continuam
// sendo um "bloco de stats" digitado na hora (sem referenciar
// personagens.id, como sempre foi). Jogadores agora podem ser
// IMPORTADOS da campanha (botão "Importar jogadores") — nesse caso a
// entrada guarda `personagem_id` (migration 0013) e Vida/Dor deixam de
// ter cópia própria: leem e escrevem DIRETO na tabela `personagens`
// (mesma linha que a ficha do jogador usa). Não existe sincronização
// de verdade acontecendo — é a MESMA linha do banco vista de dois
// lugares, então não tem como "dessincronizar". Se o jogador muda a
// Vida na própria ficha, aparece aqui na próxima vez que os dados forem
// buscados (o React não empurra updates sozinho entre abas/pessoas —
// dá F5/reentra na tela pra ver a mudança de outra sessão, mas nunca
// mostra um valor requentado).
//
// Armas/munição do jogador importado aparecem como referência (nome +
// munição atual/máx. de cada arma) — só leitura aqui; editar arma
// continua sendo na ficha do próprio personagem, não no rastreador.
//
// Só o dono da campanha (ou Admin) vê essa tela; RLS já bloqueia o
// resto no banco, mas mostramos um aviso claro em vez de uma lista
// vazia sem explicação.
export default function Combate() {
  const { id } = useParams();
  const { profile } = useAuth();

  const [campanha, setCampanha] = useState(null);
  const [entradas, setEntradas] = useState([]);
  const [armasPorPersonagem, setArmasPorPersonagem] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [entradaParaRemover, setEntradaParaRemover] = useState(null);
  const [confirmandoEncerrar, setConfirmandoEncerrar] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [desfazerAcao, setDesfazerAcao] = useState(null);
  const desfazerTimeoutRef = useRef(null);

  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('npc');
  const [faccao, setFaccao] = useState('inimigo');
  const [iniciativa, setIniciativa] = useState('');
  const [vidaMax, setVidaMax] = useState(6);
  const [dorMax, setDorMax] = useState(6);
  const [balasMax, setBalasMax] = useState(0);
  const [modeloSelecionado, setModeloSelecionado] = useState('');
  const [mostrarTabelaIniciativa, setMostrarTabelaIniciativa] = useState(false);
  const [mostrarTabelaDor, setMostrarTabelaDor] = useState(false);
  const [areaAberta, setAreaAberta] = useState(false);
  const [mostrarExplosivos, setMostrarExplosivos] = useState(false);
  const [alvosArea, setAlvosArea] = useState(() => new Set());
  const [danoAreaValor, setDanoAreaValor] = useState(1);
  const [aplicandoArea, setAplicandoArea] = useState(false);
  const [logAcoes, setLogAcoes] = useState([]);
  const [bibliotecaNpcs, setBibliotecaNpcs] = useState([]);
  const [pastasNpcCombate, setPastasNpcCombate] = useState([]);
  const [importarNpcAberto, setImportarNpcAberto] = useState(false);
  const [npcsParaImportar, setNpcsParaImportar] = useState(() => new Set());
  const [importandoNpcs, setImportandoNpcs] = useState(false);

  useEffect(() => {
    carregar();
    return () => clearTimeout(desfazerTimeoutRef.current);
  }, [id]);

  // Chave estável derivada dos personagens ligados nesta lista — só
  // muda quando alguém é importado/removido, não a cada ajuste de
  // Vida/Dor (isso evita recriar a inscrição do Realtime sem
  // necessidade a cada clique de −1/+1).
  const personagemIdsLigados = entradas
    .map((e) => e.personagem_id)
    .filter(Boolean)
    .sort()
    .join(',');

  // Realtime (13/07) — sem isso, uma mudança na ficha do jogador (ou
  // outro Mestre mexendo no mesmo combate) só aparecia na próxima vez
  // que a tela buscasse dados de novo (F5, reentrar, importar de
  // novo). Recarga SILENCIOSA (não usa a `carregar()` que liga
  // `carregando=true` — isso piscaria "Carregando..." na tela toda
  // sempre que alguém mexesse na própria ficha); o filtro de
  // `personagens` é restrito aos IDs realmente ligados a este combate
  // (senão recarregaria toda vez que QUALQUER personagem do banco
  // mudasse, de qualquer campanha). Debounce curto evita recarregar
  // em excesso se vários campos mudarem quase juntos (Vida e Dor no
  // mesmo clique de dano crítico, por exemplo).
  useEffect(() => {
    let timeoutRecarga = null;
    function recarregarComDebounce() {
      clearTimeout(timeoutRecarga);
      timeoutRecarga = setTimeout(() => recarregarSilenciosamente(), 400);
    }

    const canal = supabase.channel(`combate-${id}`).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'combate_entradas', filter: `campanha_id=eq.${id}` },
      recarregarComDebounce
    );

    if (personagemIdsLigados) {
      canal.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'personagens', filter: `id=in.(${personagemIdsLigados})` },
        recarregarComDebounce
      );
    }

    canal.subscribe();

    return () => {
      clearTimeout(timeoutRecarga);
      supabase.removeChannel(canal);
    };
  }, [id, personagemIdsLigados]);

  // Atalhos de teclado (13/07) — o Mestre normalmente está no
  // computador com teclado, faz sentido não depender só de clique pra
  // ações repetitivas de mesa (avançar turno é a MAIS repetida de
  // todas). Ignora quando o foco está num campo de texto/número/select
  // (senão apertar espaço enquanto edita o nome de uma arma, por
  // exemplo, "roubaria" o espaço do texto digitado).
  useEffect(() => {
    function handleTecla(e) {
      const alvo = document.activeElement;
      const editando = alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName);
      if (editando) return;

      if (e.code === 'Space' || e.code === 'ArrowRight') {
        e.preventDefault();
        avancarTurno();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        voltarTurno();
      }
    }

    window.addEventListener('keydown', handleTecla);
    return () => window.removeEventListener('keydown', handleTecla);
  }, [entradas, campanha]);

  async function carregar() {
    setCarregando(true);
    setErro('');
    const [resCampanha, resEntradas, resNpcs, resPastas] = await Promise.all([
      buscarCampanha(id),
      listarCombateEntradas(id),
      listarNpcsCampanha(id),
      listarPastasNpc(id),
    ]);
    if (resCampanha.error || resEntradas.error) setErro((resCampanha.error || resEntradas.error).message);
    setCampanha(resCampanha.data ?? null);
    const listaEntradas = resEntradas.data ?? [];
    setEntradas(listaEntradas);
    setBibliotecaNpcs(resNpcs.data ?? []);
    setPastasNpcCombate(resPastas.data ?? []);
    await carregarArmasLigadas(listaEntradas);
    setCarregando(false);
  }

  // Igual carregar(), mas NUNCA liga `carregando` — usado pelo
  // Realtime, que não deve piscar "Carregando..." na tela toda toda
  // vez que alguém mexe na própria ficha em outra aba.
  async function recarregarSilenciosamente() {
    const [resCampanha, resEntradas] = await Promise.all([buscarCampanha(id), listarCombateEntradas(id)]);
    if (!resCampanha.error) setCampanha(resCampanha.data ?? null);
    if (!resEntradas.error) {
      const listaEntradas = resEntradas.data ?? [];
      setEntradas(listaEntradas);
      await carregarArmasLigadas(listaEntradas);
    }
  }

  // Busca as armas de cada personagem LIGADO (uma vez por personagem,
  // não por entrada — se dois jogadores raros tivessem o mesmo id isso
  // nem seria possível, mas evita repetir busca à toa de qualquer jeito).
  async function carregarArmasLigadas(listaEntradas) {
    const ids = [...new Set(listaEntradas.map((e) => e.personagem_id).filter(Boolean))];
    if (ids.length === 0) {
      setArmasPorPersonagem({});
      return;
    }
    const resultados = await Promise.all(ids.map((pid) => listarArmas(pid)));
    const mapa = {};
    ids.forEach((pid, i) => {
      mapa[pid] = resultados[i].data ?? [];
    });
    setArmasPorPersonagem(mapa);
  }

  const souCriador = campanha?.criado_por === profile.id;
  const ehAdmin = profile.role === 'admin';
  const podeGerenciar = souCriador || ehAdmin;

  // Mantém a lista sempre ordenada por Iniciativa (maior primeiro),
  // igual o gerenciador antigo — sem precisar buscar tudo de novo a
  // cada ajuste de Vida/Dor/Balas.
  function reordenar(lista) {
    return [...lista].sort((a, b) => b.iniciativa - a.iniciativa || a.created_at.localeCompare(b.created_at));
  }

  function atualizarLocal(entradaAtualizada) {
    setEntradas((atual) => reordenar(atual.map((e) => (e.id === entradaAtualizada.id ? entradaAtualizada : e))));
  }

  // Desfazer (13/07) — clique errado durante uma mesa é comum, e
  // diferente do resto do app, aqui não tem confirmação antes de tirar
  // Vida/Dor (uma confirmação a cada −1 ia atrapalhar o ritmo do
  // combate). Em troca, guarda os valores de ANTES por alguns segundos
  // — dá pra desfazer só a última mudança, não um histórico inteiro.
  // Só ajustes de Vida/Dor registram desfazer (quem chama passa
  // explicitamente o que precisa reverter) — editar Iniciativa/Máximos
  // não passa por aqui, então não teria o que "desfazer" com um clique
  // só mesmo.
  // Log de ações (13/07) — diferente do desfazer (que só lembra da
  // ÚLTIMA mudança pra reverter), isso é só um resumo pra lembrar o que
  // aconteceu nas últimas jogadas, sem precisar confiar na memória.
  // Só em memória (não salva no banco) — é uma ajuda pra ESSA sessão,
  // não um histórico permanente; começa vazio a cada vez que a tela é
  // aberta. Guarda só as últimas 8, mais que isso não cabe numa lista
  // pequena e a mais antiga já não importa tanto.
  function registrarLog(mensagem) {
    setLogAcoes((atual) => [{ id: `${Date.now()}-${Math.random()}`, texto: mensagem }, ...atual].slice(0, 8));
  }

  function registrarDesfazer(entrada, camposAnteriores) {
    clearTimeout(desfazerTimeoutRef.current);
    setDesfazerAcao({ entrada, camposAnteriores });
    desfazerTimeoutRef.current = setTimeout(() => setDesfazerAcao(null), 6000);
  }

  function desfazer() {
    if (!desfazerAcao) return;
    clearTimeout(desfazerTimeoutRef.current);
    const { entrada, camposAnteriores } = desfazerAcao;
    setDesfazerAcao(null);
    if (entrada.personagem_id) persistirPersonagem(entrada, camposAnteriores);
    else persistir(entrada, camposAnteriores);
  }

  async function persistir(entrada, campos) {
    const { data, error } = await atualizarCombateEntrada(entrada.id, campos);
    if (error) setErro(error.message);
    else atualizarLocal(data);
  }

  // Modelo rápido (13/07) — mesma lista de src/lib/modelosNpc.js usada
  // na Biblioteca de NPCs da campanha; aqui só pré-preenche o
  // formulário (o jogador ainda pode ajustar antes de criar).
  function aplicarModeloRapido(nomeModelo) {
    setModeloSelecionado(nomeModelo);
    const modelo = MODELOS_NPC.find((m) => m.nome === nomeModelo);
    if (!modelo) return;
    setNome(modelo.nome);
    setVidaMax(modelo.vida_max);
    setDorMax(modelo.dor_max);
    setBalasMax(modelo.balas_max);
  }

  async function adicionar(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setErro('');
    setAdicionando(true);
    const { data, error } = await criarCombateEntrada(id, {
      nome: nome.trim(),
      tipo,
      faccao,
      iniciativa: Number(iniciativa) || 0,
      vida_max: Math.max(1, Number(vidaMax) || 1),
      vida_atual: Math.max(1, Number(vidaMax) || 1),
      dor_max: Math.max(1, Number(dorMax) || 1),
      dor_atual: Math.max(1, Number(dorMax) || 1),
      balas_max: Math.max(0, Number(balasMax) || 0),
      balas_atual: Math.max(0, Number(balasMax) || 0),
    });
    setAdicionando(false);
    if (error) setErro(error.message);
    else {
      setEntradas((atual) => reordenar([...atual, data]));
      setNome('');
      setIniciativa('');
      setModeloSelecionado('');
    }
  }

  // Duplicar NPC (13/07) — spawnar o mesmo capanga várias vezes rápido
  // em vez de digitar tudo de novo. Só faz sentido pra NPC (jogador é
  // ligado a uma ficha real — "duplicar" um jogador não tem
  // significado nenhum). Copia os MÁXIMOS e reseta os ATUAIS pro
  // máximo (a cópia começa "fresca", não com o dano que o original já
  // tomou) — e não copia Iniciativa (cada um rola a própria, ou o
  // Mestre ajusta depois).
  async function duplicarNpc(entrada) {
    setErro('');
    const { data, error } = await criarCombateEntrada(id, {
      nome: entrada.nome,
      tipo: 'npc',
      faccao: entrada.faccao,
      iniciativa: 0,
      vida_max: entrada.vida_max,
      vida_atual: entrada.vida_max,
      dor_max: entrada.dor_max,
      dor_atual: entrada.dor_max,
      balas_max: entrada.balas_max,
      balas_atual: entrada.balas_max,
    });
    if (error) setErro(error.message);
    else {
      registrarLog(`${entrada.nome} duplicado`);
      setEntradas((atual) => reordenar([...atual, data]));
    }
  }

  function alternarNpcParaImportar(npcId) {
    setNpcsParaImportar((atual) => {
      const novo = new Set(atual);
      if (novo.has(npcId)) novo.delete(npcId);
      else novo.add(npcId);
      return novo;
    });
  }

  // Importar da biblioteca (13/07) — puxa NPCs pré-criados
  // (CampanhaDetalhe.jsx, "Biblioteca de NPCs") pro combate de agora.
  // Cria linhas NOVAS e independentes (não um vínculo vivo, diferente
  // de personagem_id — ver comentário da migration 0020): o molde na
  // biblioteca não deveria perder Vida só porque uma cópia dele morreu
  // numa luta.
  async function importarNpcsDaBiblioteca() {
    if (npcsParaImportar.size === 0) return;
    setImportandoNpcs(true);
    const npcsEscolhidos = bibliotecaNpcs.filter((n) => npcsParaImportar.has(n.id));

    const resultados = await Promise.all(
      npcsEscolhidos.map((npc) =>
        criarCombateEntrada(id, {
          nome: npc.nome,
          tipo: 'npc',
          faccao: 'inimigo',
          iniciativa: 0,
          vida_max: npc.vida_max,
          vida_atual: npc.vida_max,
          dor_max: npc.dor_max,
          dor_atual: npc.dor_max,
          balas_max: npc.balas_max,
          balas_atual: npc.balas_max,
        })
      )
    );

    const comErro = resultados.find((r) => r.error);
    setImportandoNpcs(false);
    if (comErro) {
      setErro(comErro.error.message);
      return;
    }

    registrarLog(`${npcsEscolhidos.length} NPC(s) importado(s) da biblioteca`);
    setEntradas((atual) => reordenar([...atual, ...resultados.map((r) => r.data)]));
    setImportarNpcAberto(false);
    setNpcsParaImportar(new Set());
  }

  async function remover() {
    const entrada = entradaParaRemover;
    setEntradaParaRemover(null);
    const { error } = await removerCombateEntrada(entrada.id);
    if (error) setErro(error.message);
    else setEntradas((atual) => atual.filter((e) => e.id !== entrada.id));
  }

  async function encerrarCombate() {
    setConfirmandoEncerrar(false);
    const { error } = await removerTodasCombateEntradas(id);
    if (error) setErro(error.message);
    else {
      setEntradas([]);
      // Zera turno/rodada também — não faz sentido continuar em
      // "Rodada 7" quando a lista de combatentes já foi embora.
      const { data } = await atualizarCampanha(id, { combate_turno_index: 0, combate_rodada: 1 });
      if (data) setCampanha(data);
    }
  }

  // Turno/rodada (13/07) — guardado na campanha (não como estado local
  // do React) pra não perder o lugar se a página recarregar no meio da
  // sessão. Avançar passa pro próximo da lista de iniciativa; ao
  // ultrapassar o último, volta pro primeiro E soma 1 na rodada — é
  // assim que "uma rodada" é definida (todo mundo agiu uma vez).
  async function avancarTurno() {
    if (entradas.length === 0) return;
    const proximoIndex = campanha.combate_turno_index + 1;
    const passouDoUltimo = proximoIndex >= entradas.length;
    const { data, error } = await atualizarCampanha(id, {
      combate_turno_index: passouDoUltimo ? 0 : proximoIndex,
      combate_rodada: passouDoUltimo ? campanha.combate_rodada + 1 : campanha.combate_rodada,
    });
    if (error) setErro(error.message);
    else setCampanha(data);
  }

  // Só pra navegar rápido pra trás (setas) — de propósito NÃO mexe na
  // rodada (diferente de avançar, que soma 1 rodada ao dar a volta na
  // lista). Travado em 0: não faz sentido "voltar" pro combatente
  // anterior ao primeiro sem também decidir se isso desconta uma
  // rodada, e essa ambiguidade não parecia valer a complexidade extra
  // pra um atalho de navegação.
  async function voltarTurno() {
    if (entradas.length === 0 || campanha.combate_turno_index === 0) return;
    const { data, error } = await atualizarCampanha(id, { combate_turno_index: campanha.combate_turno_index - 1 });
    if (error) setErro(error.message);
    else setCampanha(data);
  }

  async function ajustarRodada(delta) {
    const nova = Math.max(1, campanha.combate_rodada + delta);
    const { data, error } = await atualizarCampanha(id, { combate_rodada: nova });
    if (error) setErro(error.message);
    else setCampanha(data);
  }

  // Importar jogadores (13/07) — pega todo personagem vinculado à
  // campanha que AINDA não está na lista de combate, e cria uma
  // entrada ligada (personagem_id) pra cada um. Vida/Dor não são
  // copiadas — a entrada só referencia o personagem; o valor mostrado
  // sempre vem direto da tabela `personagens` (ver `vidaAtualDe`/
  // `dorAtualDe` abaixo), então já entra com o que estiver valendo
  // agora mesmo, sem precisar de nenhuma lógica extra de "atualizar".
  async function importarJogadores() {
    setErro('');
    setImportando(true);

    const { data: vinculos, error: erroVinculos } = await listarPersonagensDaCampanha(id);
    if (erroVinculos) {
      setErro(erroVinculos.message);
      setImportando(false);
      return;
    }

    const jaNaLista = new Set(entradas.map((e) => e.personagem_id).filter(Boolean));
    const paraImportar = (vinculos ?? [])
      .map((v) => v.personagem)
      .filter((p) => p && !jaNaLista.has(p.id));

    if (paraImportar.length === 0) {
      setErro('Todos os personagens da campanha já estão na lista (ou a campanha não tem nenhum vinculado).');
      setImportando(false);
      return;
    }

    const resultados = await Promise.all(
      paraImportar.map((p) =>
        criarCombateEntrada(id, {
          personagem_id: p.id,
          nome: p.nome, // cópia só de segurança (se o personagem for excluído, a entrada não fica sem nome)
          tipo: 'jogador',
          iniciativa: 0,
        })
      )
    );

    const comErro = resultados.find((r) => r.error);
    if (comErro) {
      setErro(comErro.error.message);
      setImportando(false);
      return;
    }

    const novasEntradas = resultados.map((r) => r.data);
    const listaCompleta = reordenar([...entradas, ...novasEntradas]);
    setEntradas(listaCompleta);
    await carregarArmasLigadas(listaCompleta);
    setImportando(false);
  }

  // Valor de Vida/Dor "de verdade" pra uma entrada — se for ligada a um
  // personagem, vem do personagem (ao vivo); senão, vem da própria
  // entrada (NPC digitado na hora).
  function vidaAtualDe(entrada) {
    return entrada.personagem ? entrada.personagem.circulos_vida_atual : entrada.vida_atual;
  }
  function vidaMaxDe(entrada) {
    return entrada.personagem ? entrada.personagem.circulos_vida_max : entrada.vida_max;
  }
  function dorAtualDe(entrada) {
    return entrada.personagem ? entrada.personagem.circulos_dor_atual : entrada.dor_atual;
  }
  function dorMaxDe(entrada) {
    return entrada.personagem ? entrada.personagem.circulos_dor_max : entrada.dor_max;
  }
  function nomeDe(entrada) {
    return entrada.personagem?.nome || entrada.nome;
  }

  // Atualiza o `.personagem` embutido de uma entrada específica, sem
  // precisar reordenar (Vida/Dor não mexem em Iniciativa).
  function atualizarPersonagemLocal(entradaId, personagemAtualizado) {
    setEntradas((atual) =>
      atual.map((e) => (e.id === entradaId ? { ...e, personagem: personagemAtualizado } : e))
    );
  }

  async function persistirPersonagem(entrada, campos) {
    const { data, error } = await atualizarPersonagem(entrada.personagem_id, campos);
    if (error) setErro(error.message);
    else atualizarPersonagemLocal(entrada.id, data);
  }

  function alternarAlvoArea(entradaId) {
    setAlvosArea((atual) => {
      const novo = new Set(atual);
      if (novo.has(entradaId)) novo.delete(entradaId);
      else novo.add(entradaId);
      return novo;
    });
  }

  // Dano em área (13/07) — explosivos/molotovs (1,5m de raio),
  // metralhadora (atinge todos em linha) e canhão (3m de raio) afetam
  // vários combatentes de uma vez; sem isso, o Mestre teria que clicar
  // Vida −1 em cada um manualmente. Reaproveita ajustarVida (mesma
  // ramificação personagem-ligado/NPC, mesmo desfazer) pra cada alvo
  // selecionado — só que o "desfazer" só lembra do ÚLTIMO aplicado,
  // igual já era o caso pra ajustes individuais.
  function aplicarDanoArea() {
    if (alvosArea.size === 0) return;
    const alvos = entradas.filter((e) => alvosArea.has(e.id));
    registrarLog(`Dano em área -${danoAreaValor} em ${alvos.length} combatente(s)`);
    alvos.forEach((entrada) => ajustarVida(entrada, -Math.abs(danoAreaValor)));
    setAreaAberta(false);
    setAlvosArea(new Set());
  }

  // Vida: ferimento direto, não passa pela Dor (mesma regra da ficha).
  // Ramifica: entrada ligada a um personagem escreve DIRETO na ficha de
  // verdade (`personagens`); NPC continua só na própria entrada.
  function ajustarVida(entrada, delta) {
    const atual = vidaAtualDe(entrada);
    const max = vidaMaxDe(entrada);
    const nova = ajustarValorSimples({ atual, max, delta });
    if (nova === atual) return;

    registrarLog(`Vida ${delta > 0 ? '+' : ''}${delta} em ${nomeDe(entrada)}`);
    if (entrada.personagem_id) {
      registrarDesfazer(entrada, { circulos_vida_atual: atual });
      persistirPersonagem(entrada, { circulos_vida_atual: nova });
    } else {
      registrarDesfazer(entrada, { vida_atual: atual });
      persistir(entrada, { vida_atual: nova });
    }
  }

  // Dor: subir é simples; descer aciona a quebra de resistência (mesma
  // função de src/lib/regras.js usada na ficha do personagem).
  function ajustarDor(entrada, delta) {
    const vidaAtual = vidaAtualDe(entrada);
    const vidaMax = vidaMaxDe(entrada);
    const dorAtual = dorAtualDe(entrada);
    const dorMax = dorMaxDe(entrada);

    if (delta > 0) {
      const nova = ajustarValorSimples({ atual: dorAtual, max: dorMax, delta });
      if (nova === dorAtual) return;
      registrarLog(`Dor +${delta} em ${nomeDe(entrada)}`);
      if (entrada.personagem_id) {
        registrarDesfazer(entrada, { circulos_dor_atual: dorAtual });
        persistirPersonagem(entrada, { circulos_dor_atual: nova });
      } else {
        registrarDesfazer(entrada, { dor_atual: dorAtual });
        persistir(entrada, { dor_atual: nova });
      }
      return;
    }

    const resultado = aplicarDano({ vidaAtual, vidaMax, dorAtual, dorMax, dano: 1 });
    registrarLog(
      resultado.quebras > 0
        ? `Dor -1 em ${nomeDe(entrada)} (quebrou! Vida -${resultado.quebras})`
        : `Dor -1 em ${nomeDe(entrada)}`
    );
    if (entrada.personagem_id) {
      registrarDesfazer(entrada, { circulos_vida_atual: vidaAtual, circulos_dor_atual: dorAtual });
      persistirPersonagem(entrada, {
        circulos_vida_atual: resultado.vidaAtual,
        circulos_dor_atual: resultado.dorAtual,
      });
    } else {
      registrarDesfazer(entrada, { vida_atual: vidaAtual, dor_atual: dorAtual });
      persistir(entrada, { vida_atual: resultado.vidaAtual, dor_atual: resultado.dorAtual });
    }
  }

  function ajustarBalas(entrada, delta) {
    const nova = Math.max(0, Math.min(entrada.balas_max, entrada.balas_atual + delta));
    if (nova !== entrada.balas_atual) {
      registrarLog(`Balas ${delta > 0 ? '+' : ''}${delta} em ${nomeDe(entrada)}`);
      persistir(entrada, { balas_atual: nova });
    }
  }

  function recarregar(entrada) {
    registrarLog(`${nomeDe(entrada)} recarregou`);
    persistir(entrada, { balas_atual: entrada.balas_max });
  }

  if (carregando) return <p style={{ padding: '2rem' }}>Carregando...</p>;
  if (!campanha) return <p style={{ padding: '2rem' }}>Campanha não encontrada (ou sem acesso).</p>;
  if (!podeGerenciar) {
    return (
      <main className="painel pagina-larga">
        <p><Link to={`/campanha/${id}`}>&larr; Voltar</Link></p>
        <p className="aviso-somente-leitura">
          O rastreador de combate é uma ferramenta do Mestre — só quem criou a campanha (ou o Admin) usa esta tela.
        </p>
      </main>
    );
  }

  return (
    <main className="painel pagina-larga">
      <Breadcrumb
        itens={[
          { label: 'Início', to: '/painel' },
          { label: 'Suas Campanhas', to: '/painel/campanhas' },
          { label: campanha.nome, to: `/campanha/${id}` },
          { label: 'Rastreador de Combate' },
        ]}
      />
      <h1>⚔ Rastreador de Combate</h1>
      {erro && <p className="erro">{erro}</p>}

      <section>
        <h2>Adicionar combatente</h2>
        <form onSubmit={adicionar} className="form-inline">
          <label>
            Modelo rápido
            <select value={modeloSelecionado} onChange={(e) => aplicarModeloRapido(e.target.value)}>
              <option value="">Do zero...</option>
              {MODELOS_NPC.map((m) => (
                <option key={m.nome} value={m.nome}>{m.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Nome
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </label>
          <label>
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="npc">NPC</option>
              <option value="jogador">Jogador</option>
            </select>
          </label>
          <label>
            Facção
            <select value={faccao} onChange={(e) => setFaccao(e.target.value)}>
              <option value="inimigo">Inimigo</option>
              <option value="aliado">Aliado</option>
              <option value="neutro">Neutro</option>
            </select>
          </label>
          <label>
            Iniciativa
            <input type="number" value={iniciativa} onChange={(e) => setIniciativa(e.target.value)} />
          </label>
          <label>
            Vida máx.
            <input type="number" min="1" value={vidaMax} onChange={(e) => setVidaMax(e.target.value)} />
          </label>
          <label>
            Dor máx.
            <input type="number" min="1" value={dorMax} onChange={(e) => setDorMax(e.target.value)} />
          </label>
          <label>
            Balas máx.
            <input type="number" min="0" value={balasMax} onChange={(e) => setBalasMax(e.target.value)} />
          </label>
          <button type="submit" disabled={adicionando}>
            {adicionando ? 'Adicionando...' : '+ Adicionar'}
          </button>
        </form>
      </section>

      <section>
        <div className="painel-header">
          <h2>Ordem de iniciativa ({entradas.length})</h2>
          <span>
            <button type="button" onClick={importarJogadores} disabled={importando}>
              {importando ? 'Importando...' : 'Importar jogadores da campanha'}
            </button>{' '}
            {bibliotecaNpcs.length > 0 && (
              <button type="button" onClick={() => setImportarNpcAberto(true)}>
                Importar NPC da biblioteca
              </button>
            )}{' '}
            {entradas.length > 0 && (
              <button type="button" className="botao-remover" onClick={() => setConfirmandoEncerrar(true)}>
                Encerrar combate
              </button>
            )}
          </span>
        </div>
        <p className="detalhe-secundario">
          "Importar jogadores" traz Vida/Dor sempre ao vivo da ficha de cada personagem vinculado à campanha — mudou
          na ficha, mudou aqui também, porque é a mesma linha do banco.
        </p>

        {entradas.length > 0 && (
          <div className="combate-rodada-controle combate-rodada-controle--fixo">
            <span>
              Rodada{' '}
              <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarRodada(-1)}>
                −1
              </button>
              <strong>{campanha.combate_rodada}</strong>
              <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarRodada(1)}>
                +1
              </button>
            </span>
            <button type="button" onClick={avancarTurno}>
              Próximo turno →
            </button>
          </div>
        )}

        {entradas.length > 0 && (
          <p className="detalhe-secundario dica-teclado">
            Atalhos: espaço ou → avança o turno, ← volta.
          </p>
        )}

        {entradas.length > 1 && (
          <div className="combate-rodada-controle">
            <button type="button" onClick={() => setAreaAberta(true)}>
              Dano em área
            </button>
            <button type="button" className="link-referencia detalhe-secundario" onClick={() => setMostrarExplosivos(true)}>
              Explosivos e alcances
            </button>
          </div>
        )}

        {logAcoes.length > 0 && (
          <details className="log-acoes">
            <summary>Últimas ações ({logAcoes.length})</summary>
            <ul>
              {logAcoes.map((item) => (
                <li key={item.id}>{item.texto}</li>
              ))}
            </ul>
          </details>
        )}

        {entradas.length === 0 && <EstadoVazio>Nenhum combatente ainda — adicione acima.</EstadoVazio>}

        <ul className="lista-combate">
          {entradas.map((entrada, index) => {
            const ligado = Boolean(entrada.personagem_id);
            const vidaAtual = vidaAtualDe(entrada);
            const vidaMax = vidaMaxDe(entrada);
            const dorAtual = dorAtualDe(entrada);
            const dorMax = dorMaxDe(entrada);
            const caido = vidaAtual <= 0;
            const turnoAtual = index === campanha.combate_turno_index;
            const armasDoPersonagem = ligado ? armasPorPersonagem[entrada.personagem_id] ?? [] : [];

            return (
              <li
                key={entrada.id}
                className={[
                  `combatente-faccao--${entrada.faccao || 'inimigo'}`,
                  caido && 'combatente-caido',
                  turnoAtual && 'combatente-turno-atual',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="combatente-cabecalho">
                  <span className={`badge-tipo badge-tipo--${entrada.tipo}`}>{TIPO_LABEL[entrada.tipo]}</span>
                  <span className={`badge-faccao badge-faccao--${entrada.faccao || 'inimigo'}`}>
                    {FACCAO_LABEL[entrada.faccao] ?? FACCAO_LABEL.inimigo}
                  </span>
                  <strong>{nomeDe(entrada)}</strong>
                  {caido && <span className="badge-caido">Caído</span>}
                  {turnoAtual && <span className="badge-turno">Turno atual</span>}
                  <button
                    type="button"
                    className="link-referencia detalhe-secundario"
                    onClick={() => setMostrarTabelaIniciativa(true)}
                  >
                    Iniciativa {entrada.iniciativa}
                  </button>
                  {!ligado && (
                    <button type="button" className="botao-secundario" onClick={() => duplicarNpc(entrada)}>
                      Duplicar
                    </button>
                  )}
                  <button type="button" className="botao-remover" onClick={() => setEntradaParaRemover(entrada)}>
                    Remover
                  </button>
                </div>

                <BarraVidaDor vidaAtual={vidaAtual} vidaMax={vidaMax} dorAtual={dorAtual} dorMax={dorMax} />

                <div className="combatente-status">
                  <div className="status-linha">
                    <span>Vida</span>
                    <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarVida(entrada, -1)}>
                      −1
                    </button>
                    <strong className="status-valor">
                      {vidaAtual} / {vidaMax}
                    </strong>
                    <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarVida(entrada, 1)}>
                      +1
                    </button>
                  </div>

                  <div className="status-linha">
                    <button
                      type="button"
                      className="link-referencia"
                      onClick={() => setMostrarTabelaDor(true)}
                    >
                      Dor
                    </button>
                    <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarDor(entrada, -1)}>
                      −1
                    </button>
                    <strong className="status-valor">
                      {dorAtual} / {dorMax}
                    </strong>
                    <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarDor(entrada, 1)}>
                      +1
                    </button>
                  </div>

                  {!ligado && entrada.balas_max > 0 && (
                    <div className="status-linha">
                      <span>Balas</span>
                      {entrada.balas_atual > 0 ? (
                        <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarBalas(entrada, -1)}>
                          −1
                        </button>
                      ) : (
                        <button type="button" onClick={() => recarregar(entrada)}>
                          Recarregar
                        </button>
                      )}
                      <strong className="status-valor">
                        {entrada.balas_atual} / {entrada.balas_max}
                      </strong>
                    </div>
                  )}

                  {ligado && armasDoPersonagem.length > 0 && (
                    <div className="armas-referencia">
                      <span className="detalhe-secundario">Armas (editar na ficha):</span>
                      <ul>
                        {armasDoPersonagem.map((arma) => (
                          <li key={arma.id}>
                            {arma.nome || '(sem nome)'}
                            {arma.municao_max > 0 && (
                              <span className="detalhe-secundario">
                                {' '}
                                — {arma.municao_atual ?? 0}/{arma.municao_max}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <details className="ajuste-maximos">
                  <summary>Ajustar máximos</summary>
                  <div className="grid-campos">
                    {ligado ? (
                      <p className="detalhe-secundario">
                        Vida/Dor máximos deste personagem vêm dos Atributos — ajuste na própria ficha, não aqui.
                      </p>
                    ) : (
                      <>
                        <CampoEditavel
                          label="Vida máx."
                          valor={entrada.vida_max}
                          min={1}
                          onSalvar={(v) => {
                            const nova = ajustarValorSimples({ atual: entrada.vida_atual, max: v, delta: v - entrada.vida_max });
                            persistir(entrada, { vida_max: v, vida_atual: nova });
                          }}
                        />
                        <CampoEditavel
                          label="Dor máx."
                          valor={entrada.dor_max}
                          min={1}
                          onSalvar={(v) => {
                            const nova = ajustarValorSimples({ atual: entrada.dor_atual, max: v, delta: v - entrada.dor_max });
                            persistir(entrada, { dor_max: v, dor_atual: nova });
                          }}
                        />
                        <CampoEditavel
                          label="Balas máx."
                          valor={entrada.balas_max}
                          min={0}
                          onSalvar={(v) => persistir(entrada, { balas_max: v, balas_atual: Math.min(v, entrada.balas_atual) })}
                        />
                      </>
                    )}
                    <CampoEditavel
                      label="Iniciativa"
                      valor={entrada.iniciativa}
                      onSalvar={(v) => persistir(entrada, { iniciativa: v })}
                    />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      <PopupReferencia
        titulo="Iniciativa"
        aberto={mostrarTabelaIniciativa}
        onFechar={() => setMostrarTabelaIniciativa(false)}
      >
        <table className="tabela-efeitos-dor tabela-responsiva">
          <thead>
            <tr>
              <th>Carta</th>
              <th>Bônus</th>
            </tr>
          </thead>
          <tbody>
            {CARTAS_INICIATIVA.map((c) => (
              <tr key={c.carta}>
                <td data-label="Carta" className="celula-numero">{c.carta}</td>
                <td data-label="Bônus">{c.bonus}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>1d6 — Acerto crítico</h4>
        <table className="tabela-efeitos-dor tabela-responsiva">
          <thead>
            <tr>
              <th>#</th>
              <th>Efeito</th>
            </tr>
          </thead>
          <tbody>
            {ACERTOS_CRITICOS.map((e) => (
              <tr key={e.n}>
                <td data-label="#" className="celula-numero">{e.n}</td>
                <td data-label="Efeito">
                  <strong>{e.nome}:</strong> {e.efeito}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>1d6 — Falha crítica</h4>
        <table className="tabela-efeitos-dor tabela-responsiva">
          <thead>
            <tr>
              <th>#</th>
              <th>Efeito</th>
            </tr>
          </thead>
          <tbody>
            {FALHAS_CRITICAS.map((e) => (
              <tr key={e.n}>
                <td data-label="#" className="celula-numero">{e.n}</td>
                <td data-label="Efeito">{e.efeito}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PopupReferencia>

      <PopupReferencia titulo="Efeitos de Dor" aberto={mostrarTabelaDor} onFechar={() => setMostrarTabelaDor(false)}>
        <p className="detalhe-secundario">Efeito de acordo com os Círculos de Dor já marcados.</p>
        <table className="tabela-efeitos-dor tabela-responsiva">
          <thead>
            <tr>
              <th>#</th>
              <th>Efeito</th>
              <th>Consequência</th>
            </tr>
          </thead>
          <tbody>
            {EFEITOS_DOR.map((e) => (
              <tr key={e.n}>
                <td data-label="#" className="celula-numero">{e.n}</td>
                <td data-label="Efeito">{e.nome}</td>
                <td data-label="Consequência">{e.efeito}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PopupReferencia>

      <PopupConfirmar
        aberto={Boolean(entradaParaRemover)}
        mensagem={`Remover "${entradaParaRemover?.nome}" do combate?`}
        onConfirmar={remover}
        onCancelar={() => setEntradaParaRemover(null)}
      />
      <PopupConfirmar
        aberto={confirmandoEncerrar}
        mensagem="Encerrar o combate e remover todos os combatentes da lista?"
        textoConfirmar="Encerrar combate"
        onConfirmar={encerrarCombate}
        onCancelar={() => setConfirmandoEncerrar(false)}
      />

      {desfazerAcao && (
        <div className="barra-desfazer">
          <span>Vida/Dor de {nomeDe(desfazerAcao.entrada)} alterada.</span>
          <button type="button" onClick={desfazer}>
            Desfazer
          </button>
        </div>
      )}

      {areaAberta && (
        <div className="popup-fundo" onClick={() => setAreaAberta(false)}>
          <div className="popup-caixa" onClick={(e) => e.stopPropagation()}>
            <h3>Dano em área</h3>
            <p className="detalhe-secundario">
              Escolha quem foi atingido e o dano de Vida a aplicar em todos de uma vez — explosivo, molotov,
              metralhadora ou canhão.
            </p>
            <label className="campo-editavel">
              Dano (Vida)
              <input
                type="number"
                min="1"
                value={danoAreaValor}
                onChange={(e) => setDanoAreaValor(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <ul className="area-lista-alvos">
              {entradas.map((entrada) => (
                <li key={entrada.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={alvosArea.has(entrada.id)}
                      onChange={() => alternarAlvoArea(entrada.id)}
                    />
                    {nomeDe(entrada)}
                  </label>
                </li>
              ))}
            </ul>
            <div className="popup-acoes">
              <button type="button" onClick={aplicarDanoArea} disabled={alvosArea.size === 0}>
                Aplicar em {alvosArea.size || 0}
              </button>
              <button type="button" className="botao-secundario" onClick={() => setAreaAberta(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {importarNpcAberto && (
        <div className="popup-fundo" onClick={() => setImportarNpcAberto(false)}>
          <div className="popup-caixa" onClick={(e) => e.stopPropagation()}>
            <h3>Importar NPC da biblioteca</h3>
            <p className="detalhe-secundario">
              Cria uma cópia independente pra este combate — a Vida/Dor daqui não afeta o molde salvo na biblioteca.
            </p>
            {Object.entries(
              bibliotecaNpcs.reduce((porPasta, npc) => {
                const chave = npc.pasta_id ?? '__sem_pasta__';
                (porPasta[chave] ??= []).push(npc);
                return porPasta;
              }, {})
            ).map(([chave, npcsDaPasta]) => {
              const nomePasta = chave === '__sem_pasta__' ? 'Sem pasta' : pastasNpcCombate.find((p) => p.id === chave)?.nome ?? 'Sem pasta';
              return (
              <div key={chave} className="pasta-npcs">
                <h4>{nomePasta}</h4>
                <ul className="area-lista-alvos">
                  {npcsDaPasta.map((npc) => (
                    <li key={npc.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={npcsParaImportar.has(npc.id)}
                          onChange={() => alternarNpcParaImportar(npc.id)}
                        />
                        {npc.nome}{' '}
                        <span className="detalhe-secundario">
                          (Vida {npc.vida_max} · Dor {npc.dor_max} · Balas {npc.balas_max})
                        </span>
                        {npc.descricao && <p className="detalhe-secundario campo-dica">{npc.descricao}</p>}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              );
            })}
            <div className="popup-acoes">
              <button type="button" onClick={importarNpcsDaBiblioteca} disabled={npcsParaImportar.size === 0 || importandoNpcs}>
                {importandoNpcs ? 'Importando...' : `Importar ${npcsParaImportar.size || ''}`}
              </button>
              <button type="button" className="botao-secundario" onClick={() => setImportarNpcAberto(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <PopupReferencia titulo="Explosivos e Alcances" aberto={mostrarExplosivos} onFechar={() => setMostrarExplosivos(false)}>
        <p>
          Dinamite, TNT, molotov: dano em área de <strong>1,5m de raio</strong>. Canhão: funciona como explosivo, mas
          com área de <strong>3m de raio</strong>. Metralhadora: atinge todos os alvos em linha reta (não é um raio).
        </p>
        <p>
          Acender e jogar um explosivo custa <strong>1 Movimento + 1 Ação de Combate</strong>. No Teste de Violência
          pra acertar, se o dado cair em <strong>1</strong>: faça um Teste de Resistência de Velocidade — falhando, a
          bomba explode na mão de quem jogou.
        </p>
        <p>
          Metralhadora: <strong>3 de Vida</strong> por Ação de Combate + Movimento gastos usando ela naquele turno
          (ex.: 2 Ações + 2 Movimentos = 6 de Vida). Precisa recarregar no fim do turno.
        </p>
        <p>
          Canhão: NA 7 de Violência em vez de rolar contra a Defesa do alvo. Falhou: erra por 3m numa direção
          aleatória. Falha crítica: acerta um aliado e seus arredores.
        </p>
        <p className="detalhe-secundario">
          Alcances (se usar mapa/miniatura): curto/perto = 9m; médio = 30m; longo = 90m.
        </p>
      </PopupReferencia>
    </main>
  );
}