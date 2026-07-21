import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import PopupConfirmar from '../components/PopupConfirmar.jsx';
import BarraVidaDor from '../components/BarraVidaDor.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';
import { Esqueleto } from '../components/Esqueleto.jsx';
import Breadcrumb from '../components/Breadcrumb.jsx';
import NotasMestre from '../components/NotasMestre.jsx';
import NotaPersonagemCampanha from '../components/NotaPersonagemCampanha.jsx';
import InventarioNpc from '../components/InventarioNpc.jsx';
import UploadFoto from '../components/UploadFoto.jsx';
import { calcularCapacidadeMunicaoDeArmas } from '../lib/regras.js';
import { MODELOS_NPC } from '../lib/modelosNpc.js';
import {
  buscarCampanha,
  listarPersonagensDaCampanha,
  listarMeusPersonagens,
  vincularPersonagem,
  desvincularPersonagem,
  buscarUsuarioPorNomeOuEmail,
  convidarParaCampanha,
  listarConvitesDaCampanha,
  meuAcessoNaCampanha,
  listarArmas,
  buscarNotasMestre,
  listarNpcsCampanha,
  criarNpcCampanha,
  atualizarNpcCampanha,
  removerNpcCampanha,
  listarPastasNpc,
  criarPastaNpc,
  atualizarPastaNpc,
  removerPastaNpc,
  listarNotasPersonagensCampanha,
  removerVinculosEmLote,
} from '../lib/dados.js';

// Abas (13/07) — antes tudo ficava empilhado numa página só rolando
// pra sempre (Personagens + Notas + Biblioteca de NPCs + Convidar,
// tudo visível ao mesmo tempo). Trocado por abas: só uma seção por
// vez, mesma ideia de "diminuir a quantidade de coisa visual por vez".
// Isso também tornou o antigo "Modo Sessão/Preparação" redundante —
// não abrir a aba de Convidar durante a mesa já resolve o mesmo
// problema que aquele toggle tentava resolver, sem precisar de mais
// uma camada de estado.
const ABAS_CAMPANHA = [
  { id: 'personagens', label: 'Personagens' },
  { id: 'notas', label: 'Anotações' },
  { id: 'npcs', label: 'Biblioteca de NPCs' },
  { id: 'convites', label: 'Convidar Jogador' },
];

// Substitui SessaoDetalhe.jsx. Quem vê o quê aqui muda conforme o papel
// do visitante em relação a ESTA campanha específica:
//  - criador (ou Admin): gerencia — convida por e-mail, vê todos os
//    vínculos e todos os convites enviados.
//  - participante (convite aceito): vê a campanha, vincula os próprios
//    personagens, mas só enxerga os PRÓPRIOS vínculos (mesma regra de
//    privacidade que já existia entre jogadores antes).
//  - sem vínculo/convite: só as informações básicas da campanha (nome/
//    descrição) — RLS já resolve isso sozinho.
export default function CampanhaDetalhe() {
  const { id } = useParams();
  const { profile } = useAuth();

  const [campanha, setCampanha] = useState(null);
  const [membros, setMembros] = useState([]);
  const [meusPersonagens, setMeusPersonagens] = useState([]);
  const [convitesEnviados, setConvitesEnviados] = useState([]);
  const [possoVincular, setPossoVincular] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [vinculoParaRemover, setVinculoParaRemover] = useState(null);

  const [personagemParaVincular, setPersonagemParaVincular] = useState('');
  const [vinculando, setVinculando] = useState(false);

  const [buscaTermo, setBuscaTermo] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [buscaFeita, setBuscaFeita] = useState(false);

  const [modoVisualizacao, setModoVisualizacao] = useState('cartoes');
  const [expandidos, setExpandidos] = useState(() => new Set());
  const [armasPorPersonagem, setArmasPorPersonagem] = useState({});
  const [carregandoArmasDe, setCarregandoArmasDe] = useState(null);

  const [abaAtiva, setAbaAtiva] = useState('personagens');
  const [notasMestre, setNotasMestre] = useState(null);

  const [npcs, setNpcs] = useState([]);
  const [npcParaRemover, setNpcParaRemover] = useState(null);
  const [modeloNpc, setModeloNpc] = useState('');
  const [novoNpc, setNovoNpc] = useState({
    pasta_id: '',
    nome: '',
    descricao: '',
    foto_url: null,
    vida_max: 6,
    dor_max: 6,
    balas_max: 6,
  });
  const [criandoNpc, setCriandoNpc] = useState(false);
  const [npcsExpandidos, setNpcsExpandidos] = useState(() => new Set());

  const [pastasNpc, setPastasNpc] = useState([]);
  const [pastaParaRemover, setPastaParaRemover] = useState(null);
  const [novaPasta, setNovaPasta] = useState({ nome: '', descricao: '' });
  const [criandoPasta, setCriandoPasta] = useState(false);
  const [buscaNpc, setBuscaNpc] = useState('');

  const [notasPersonagens, setNotasPersonagens] = useState({});
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [confirmandoRemoverLote, setConfirmandoRemoverLote] = useState(false);
  const [removendoLote, setRemovendoLote] = useState(false);

  useEffect(() => {
    carregarTudo();
  }, [id]);

  const souCriador = campanha?.criado_por === profile.id;
  const ehAdmin = profile.role === 'admin';
  const podeGerenciar = souCriador || ehAdmin;

  async function carregarTudo() {
    setCarregando(true);
    setErro('');

    const [resCampanha, resMembros, resMeus, resAcesso] = await Promise.all([
      buscarCampanha(id),
      listarPersonagensDaCampanha(id),
      listarMeusPersonagens(profile.id),
      meuAcessoNaCampanha(id, profile.id),
    ]);

    if (resCampanha.error) setErro(resCampanha.error.message);

    const dadosCampanha = resCampanha.data ?? null;
    setCampanha(dadosCampanha);
    setMembros(resMembros.data ?? []);
    setMeusPersonagens(resMeus.data ?? []);

    const souCriadorAgora = dadosCampanha?.criado_por === profile.id;
    const ehAdminAgora = profile.role === 'admin';
    setPossoVincular(souCriadorAgora || ehAdminAgora || Boolean(resAcesso.data?.length));

    if (souCriadorAgora || ehAdminAgora) {
      const idsVinculos = (resMembros.data ?? []).map((m) => m.id);
      const [resConvites, resNotas, resNpcs, resNotasPersonagens, resPastas] = await Promise.all([
        listarConvitesDaCampanha(id),
        buscarNotasMestre(id),
        listarNpcsCampanha(id),
        listarNotasPersonagensCampanha(idsVinculos),
        listarPastasNpc(id),
      ]);
      setConvitesEnviados(resConvites.data ?? []);
      setNotasMestre(resNotas.data?.notas ?? '');
      setNpcs(resNpcs.data ?? []);
      setPastasNpc(resPastas.data ?? []);
      const mapaNotas = {};
      (resNotasPersonagens.data ?? []).forEach((n) => {
        mapaNotas[n.campanha_personagem_id] = n.notas;
      });
      setNotasPersonagens(mapaNotas);
    }

    setCarregando(false);
  }

  const idsMeusVinculados = membros
    .filter((m) => m.personagem?.user_id === profile.id)
    .map((m) => m.personagem.id);
  const meusDisponiveisParaVincular = meusPersonagens.filter((p) => !idsMeusVinculados.includes(p.id));

  async function handleVincular(e) {
    e.preventDefault();
    if (!personagemParaVincular) return;

    setErro('');
    setVinculando(true);
    const { error } = await vincularPersonagem({ campanhaId: id, personagemId: personagemParaVincular });
    setVinculando(false);

    if (error) {
      setErro(error.message);
    } else {
      setPersonagemParaVincular('');
      carregarTudo();
    }
  }

  // Cartão expandido (13/07) — mostra dinheiro e última alteração
  // (já vêm na mesma consulta) e o total de munição (leve/pesada),
  // que exige buscar as armas daquele personagem — só quando expande
  // pela primeira vez (não busca de antemão pra todo mundo, a maioria
  // dos cartões talvez nunca seja aberta numa sessão).
  async function alternarExpandido(personagemId) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(personagemId)) novo.delete(personagemId);
      else novo.add(personagemId);
      return novo;
    });

    if (!armasPorPersonagem[personagemId]) {
      setCarregandoArmasDe(personagemId);
      const { data } = await listarArmas(personagemId);
      setArmasPorPersonagem((atual) => ({ ...atual, [personagemId]: data ?? [] }));
      setCarregandoArmasDe(null);
    }
  }

  function aplicarModeloNpc(nomeModelo) {
    setModeloNpc(nomeModelo);
    const modelo = MODELOS_NPC.find((m) => m.nome === nomeModelo);
    if (modelo) setNovoNpc((atual) => ({ ...atual, ...modelo }));
  }

  async function handleCriarNpc(e) {
    e.preventDefault();
    if (!novoNpc.nome.trim()) return;

    setErro('');
    setCriandoNpc(true);
    const { data, error } = await criarNpcCampanha(id, {
      ...novoNpc,
      nome: novoNpc.nome.trim(),
      pasta_id: novoNpc.pasta_id || null,
    });
    setCriandoNpc(false);

    if (error) setErro(error.message);
    else {
      setNpcs((atual) => [...atual, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNovoNpc({
        pasta_id: novoNpc.pasta_id,
        nome: '',
        descricao: '',
        foto_url: null,
        vida_max: 6,
        dor_max: 6,
        balas_max: 6,
      });
      setModeloNpc('');
    }
  }

  function alternarNpcExpandido(npcId) {
    setNpcsExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(npcId)) novo.delete(npcId);
      else novo.add(npcId);
      return novo;
    });
  }

  // Mover NPC de pasta (13/07) — agora é escolher entre as pastas que
  // JÁ EXISTEM (select), não mais digitar um texto livre — pasta virou
  // uma entidade de verdade (migration 0023), então "mover" é só
  // trocar a referência.
  async function moverNpcParaPasta(npc, novaPastaId) {
    const valorFinal = novaPastaId || null;
    if (valorFinal === npc.pasta_id) return;
    const { data, error } = await atualizarNpcCampanha(npc.id, { pasta_id: valorFinal });
    if (error) setErro(error.message);
    else setNpcs((atual) => atual.map((n) => (n.id === npc.id ? data : n)));
  }

  async function salvarDescricaoNpc(npc, descricao) {
    if (descricao === npc.descricao) return;
    const { data, error } = await atualizarNpcCampanha(npc.id, { descricao });
    if (error) setErro(error.message);
    else setNpcs((atual) => atual.map((n) => (n.id === npc.id ? data : n)));
  }

  // Pastas de NPC (13/07) — criar uma pasta é uma ação própria, com
  // nome E descrição (ex.: "Subtrama: A Vingança do Xerife" com um
  // resumo do gancho) — acompanhada como sua própria lista, separada
  // dos NPCs que ela agrupa.
  async function handleCriarPasta(e) {
    e.preventDefault();
    if (!novaPasta.nome.trim()) return;
    setErro('');
    setCriandoPasta(true);
    const { data, error } = await criarPastaNpc(id, { nome: novaPasta.nome.trim(), descricao: novaPasta.descricao });
    setCriandoPasta(false);
    if (error) setErro(error.message);
    else {
      setPastasNpc((atual) => [...atual, data].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNovaPasta({ nome: '', descricao: '' });
    }
  }

  async function salvarDescricaoPasta(pasta, descricao) {
    if (descricao === pasta.descricao) return;
    const { data, error } = await atualizarPastaNpc(pasta.id, { descricao });
    if (error) setErro(error.message);
    else setPastasNpc((atual) => atual.map((p) => (p.id === pasta.id ? data : p)));
  }

  async function handleRemoverPasta() {
    const pastaId = pastaParaRemover;
    setPastaParaRemover(null);
    const { error } = await removerPastaNpc(pastaId);
    if (error) setErro(error.message);
    else {
      setPastasNpc((atual) => atual.filter((p) => p.id !== pastaId));
      // NPCs que estavam nela ficam "sem pasta" — não some da lista.
      setNpcs((atual) => atual.map((n) => (n.pasta_id === pastaId ? { ...n, pasta_id: null } : n)));
    }
  }

  async function handleRemoverNpc() {
    const npcId = npcParaRemover;
    setNpcParaRemover(null);
    const { error } = await removerNpcCampanha(npcId);
    if (error) setErro(error.message);
    else setNpcs((atual) => atual.filter((n) => n.id !== npcId));
  }

  async function handleDesvincular() {
    const vinculoId = vinculoParaRemover;
    setVinculoParaRemover(null);
    const { error } = await desvincularPersonagem(vinculoId);
    if (error) setErro(error.message);
    else carregarTudo();
  }

  // Ações em lote (13/07) — mesmo padrão do "Dano em área" do Combate:
  // seleciona vários, aplica uma vez. Só faz sentido pra quem gerencia
  // (checkbox nem aparece pro jogador comum).
  function alternarSelecionado(vinculoId) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(vinculoId)) novo.delete(vinculoId);
      else novo.add(vinculoId);
      return novo;
    });
  }

  async function removerLote() {
    setConfirmandoRemoverLote(false);
    setRemovendoLote(true);
    const { error } = await removerVinculosEmLote([...selecionados]);
    setRemovendoLote(false);
    if (error) setErro(error.message);
    else {
      setSelecionados(new Set());
      carregarTudo();
    }
  }

  async function handleBuscarEmail(e) {
    e.preventDefault();
    if (!buscaTermo.trim()) return;

    setBuscando(true);
    setBuscaFeita(false);
    const { data, error } = await buscarUsuarioPorNomeOuEmail(buscaTermo);
    setBuscando(false);
    setBuscaFeita(true);

    if (error) setErro(error.message);
    else setResultadosBusca(data ?? []);
  }

  async function handleConvidar(usuarioId) {
    setErro('');
    const { error } = await convidarParaCampanha({ campanhaId: id, usuarioId });

    if (error) {
      setErro(error.message);
    } else {
      setResultadosBusca([]);
      setBuscaTermo('');
      setBuscaFeita(false);
      carregarTudo();
    }
  }

  if (carregando) return <p style={{ padding: '2rem' }}>Carregando...</p>;
  if (!campanha) return <p style={{ padding: '2rem' }}>Campanha não encontrada (ou você não tem acesso a ela).</p>;

  return (
    <main className="painel pagina-larga">
      <Breadcrumb itens={[{ label: 'Início', to: '/painel' }, { label: 'Suas Campanhas', to: '/painel/campanhas' }, { label: campanha.nome }]} />
      <h1>{campanha.nome}</h1>
      {campanha.descricao && <p>{campanha.descricao}</p>}
      {podeGerenciar && (
        <p><Link to={`/campanha/${id}/combate`} className="botao-like-link">⚔ Abrir Rastreador de Combate</Link></p>
      )}

      {podeGerenciar && (
        <nav className="abas-campanha" aria-label="Seções da campanha">
          {ABAS_CAMPANHA.map((aba) => (
            <button
              key={aba.id}
              type="button"
              className={`aba-campanha-botao ${abaAtiva === aba.id ? 'aba-campanha-botao--ativa' : ''}`}
              onClick={() => setAbaAtiva(aba.id)}
            >
              {aba.label}
            </button>
          ))}
        </nav>
      )}

      {erro && <p className="erro">{erro}</p>}

      {(abaAtiva === 'personagens' || !podeGerenciar) && (
      <section className="secao-aba-campanha">
        <h2 className="oculto-visualmente">Personagens nesta campanha</h2>
        <div className="painel-header">
          {selecionados.size > 0 ? (
            <span>
              <strong>{selecionados.size}</strong> selecionado(s){' '}
              <button type="button" className="botao-remover" onClick={() => setConfirmandoRemoverLote(true)}>
                Remover selecionados
              </button>{' '}
              <button type="button" className="botao-secundario" onClick={() => setSelecionados(new Set())}>
                Cancelar seleção
              </button>
            </span>
          ) : (
            <span />
          )}
          {membros.length > 0 && (
            <div className="toggle-visualizacao">
              <button
                type="button"
                className={modoVisualizacao === 'cartoes' ? 'toggle-ativo' : 'botao-secundario'}
                onClick={() => setModoVisualizacao('cartoes')}
              >
                Cartões
              </button>
              <button
                type="button"
                className={modoVisualizacao === 'tabela' ? 'toggle-ativo' : 'botao-secundario'}
                onClick={() => setModoVisualizacao('tabela')}
              >
                Tabela
              </button>
            </div>
          )}
        </div>

        {membros.length === 0 && <EstadoVazio>Nenhum personagem vinculado ainda.</EstadoVazio>}

        {membros.length > 0 && modoVisualizacao === 'cartoes' && (
          <div className="grade-personagens-campanha">
            {membros.map((m) => {
              const expandido = expandidos.has(m.personagem.id);
              const armas = armasPorPersonagem[m.personagem.id];
              const capacidade = armas ? calcularCapacidadeMunicaoDeArmas(armas) : null;
              const podeRemoverEste = podeGerenciar || m.personagem.user_id === profile.id;
              return (
                <div className={`cartao-personagem-campanha ${expandido ? 'cartao-expandido' : ''}`} key={m.id}>
                  <div className="cartao-personagem-topo">
                    {podeGerenciar && (
                      <input
                        type="checkbox"
                        className="checkbox-selecao"
                        checked={selecionados.has(m.id)}
                        onChange={() => alternarSelecionado(m.id)}
                        aria-label={`Selecionar ${m.personagem.nome}`}
                      />
                    )}
                    <div
                      className="cartao-personagem-foto"
                      style={m.personagem.foto_url ? { backgroundImage: `url("${m.personagem.foto_url}")` } : undefined}
                    />
                    <div className="cartao-personagem-corpo">
                      <Link to={`/personagem/${m.personagem.id}?campanha=${id}`} className="cartao-personagem-nome">
                        {m.personagem.nome || '(sem nome)'}
                      </Link>
                      <p className="detalhe-secundario">{m.personagem.dono?.display_name}</p>
                      <BarraVidaDor
                        vidaAtual={m.personagem.circulos_vida_atual}
                        vidaMax={m.personagem.circulos_vida_max}
                        dorAtual={m.personagem.circulos_dor_atual}
                        dorMax={m.personagem.circulos_dor_max}
                        compacta
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="botao-detalhes-toggle cartao-personagem-expandir"
                    onClick={() => alternarExpandido(m.personagem.id)}
                    aria-expanded={expandido}
                  >
                    {expandido ? 'Menos detalhes ▲' : 'Mais detalhes ▾'}
                  </button>

                  {expandido && (
                    <div className="cartao-personagem-detalhes">
                      <p>
                        <span className="detalhe-secundario">Dinheiro:</span> ${m.personagem.dinheiro ?? 0}
                      </p>
                      {carregandoArmasDe === m.personagem.id ? (
                        <Esqueleto altura="1.2rem" />
                      ) : (
                        capacidade && (
                          <p>
                            <span className="detalhe-secundario">Munição:</span> {capacidade.leve} leve / {capacidade.pesada} pesada
                            {' '}(capacidade)
                          </p>
                        )
                      )}
                      {m.personagem.updated_at && (
                        <p className="detalhe-secundario">
                          Última alteração:{' '}
                          {new Date(m.personagem.updated_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                      {podeGerenciar && (
                        <NotaPersonagemCampanha
                          campanhaPersonagemId={m.id}
                          notaInicial={notasPersonagens[m.id] ?? ''}
                        />
                      )}
                    </div>
                  )}

                  {podeRemoverEste && (
                    <button className="botao-remover" onClick={() => setVinculoParaRemover(m.id)}>
                      Remover
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {membros.length > 0 && modoVisualizacao === 'tabela' && (
          <div className="tabela-scroll">
            <table className="tabela-ficha tabela-responsiva">
              <thead>
                <tr>
                  {podeGerenciar && <th></th>}
                  <th>Nome</th>
                  <th>Jogador</th>
                  <th>Vida</th>
                  <th>Dor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {membros.map((m) => (
                  <tr key={m.id}>
                    {podeGerenciar && (
                      <td data-label="">
                        <input
                          type="checkbox"
                          className="checkbox-selecao"
                          checked={selecionados.has(m.id)}
                          onChange={() => alternarSelecionado(m.id)}
                          aria-label={`Selecionar ${m.personagem.nome}`}
                        />
                      </td>
                    )}
                    <td data-label="Nome">
                      <Link to={`/personagem/${m.personagem.id}?campanha=${id}`}>{m.personagem.nome || '(sem nome)'}</Link>
                    </td>
                    <td data-label="Jogador" className="detalhe-secundario">{m.personagem.dono?.display_name}</td>
                    <td data-label="Vida">{m.personagem.circulos_vida_atual}/{m.personagem.circulos_vida_max}</td>
                    <td data-label="Dor">{m.personagem.circulos_dor_atual}/{m.personagem.circulos_dor_max}</td>
                    <td data-label="">
                      {(podeGerenciar || m.personagem.user_id === profile.id) && (
                        <button className="botao-remover" onClick={() => setVinculoParaRemover(m.id)}>
                          Remover
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {possoVincular && meusDisponiveisParaVincular.length > 0 && (
          <form onSubmit={handleVincular} className="form-inline">
            <label>
              Vincular um dos seus personagens
              <select
                value={personagemParaVincular}
                onChange={(e) => setPersonagemParaVincular(e.target.value)}
                required
              >
                <option value="">Selecione...</option>
                {meusDisponiveisParaVincular.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome || '(sem nome)'}</option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={vinculando}>
              {vinculando ? 'Vinculando...' : 'Vincular'}
            </button>
          </form>
        )}

        {possoVincular && meusPersonagens.length === 0 && (
          <p className="detalhe-secundario">
            Você ainda não tem nenhum personagem. Crie um no <Link to="/painel">seu painel</Link> pra vincular aqui.
          </p>
        )}

        {possoVincular && meusPersonagens.length > 0 && meusDisponiveisParaVincular.length === 0 && (
          <p className="detalhe-secundario">Todos os seus personagens já estão nesta campanha.</p>
        )}

        {!possoVincular && (
          <p className="detalhe-secundario">
            Você ainda não participa desta campanha. Se recebeu um convite,
            responda em <Link to="/painel">seu painel</Link>.
          </p>
        )}
      </section>
      )}

      {podeGerenciar && abaAtiva === 'notas' && (
        <section className="secao-aba-campanha">
          <NotasMestre campanhaId={id} notasIniciais={notasMestre ?? ''} />
        </section>
      )}

      {podeGerenciar && abaAtiva === 'npcs' && (
        <section className="secao-aba-campanha">
          <h2>Biblioteca de NPCs</h2>
          <p className="detalhe-secundario">
            Crie de antemão — depois é só puxar pro Rastreador de Combate na hora da luta ("Importar NPC da
            biblioteca"), sem digitar tudo de novo. Pastas têm descrição própria — uma cidade, uma subtrama, uma
            gangue — o que fizer sentido pra sua campanha.
          </p>

          {npcs.length > 3 && (
            <input
              type="search"
              className="campo-busca-itens"
              placeholder="Buscar NPC pelo nome..."
              value={buscaNpc}
              onChange={(e) => setBuscaNpc(e.target.value)}
            />
          )}

          {(() => {
            const termo = buscaNpc.trim().toLowerCase();
            const npcsFiltrados = termo ? npcs.filter((n) => n.nome.toLowerCase().includes(termo)) : npcs;

            if (npcs.length > 0 && npcsFiltrados.length === 0) {
              return <p className="detalhe-secundario">Nenhum NPC bate com "{buscaNpc}".</p>;
            }

            const porPasta = {};
            npcsFiltrados.forEach((npc) => {
              const chave = npc.pasta_id ?? '__sem_pasta__';
              (porPasta[chave] ??= []).push(npc);
            });

            // Mostra TODA pasta cadastrada (mesmo vazia, ou zerada pela busca) — "acompanhar as pastas" da
            // campanha é ver a lista inteira, não só as que têm NPC batendo com o filtro agora.
            const gruposOrdenados = [
              ...pastasNpc.map((p) => ({ id: p.id, nome: p.nome, descricao: p.descricao, npcsDoGrupo: porPasta[p.id] ?? [] })),
              ...(porPasta.__sem_pasta__
                ? [{ id: null, nome: 'Sem pasta', descricao: '', npcsDoGrupo: porPasta.__sem_pasta__ }]
                : []),
            ];

            return gruposOrdenados.map((grupo) => (
              <details key={grupo.id ?? 'sem-pasta'} className="pasta-npcs" open>
                <summary className="pasta-npcs-cabecalho">
                  <h3>{grupo.nome}</h3>
                  {grupo.id && (
                    <button
                      type="button"
                      className="botao-remover"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPastaParaRemover(grupo.id);
                      }}
                    >
                      Remover pasta
                    </button>
                  )}
                </summary>
                {grupo.id && (
                  <textarea
                    className="descricao-pasta"
                    defaultValue={grupo.descricao}
                    rows={2}
                    placeholder="Do que se trata essa pasta (gancho da subtrama, contexto da cidade)..."
                    onBlur={(e) => salvarDescricaoPasta(pastasNpc.find((p) => p.id === grupo.id), e.target.value)}
                  />
                )}
                {grupo.npcsDoGrupo.length === 0 && <p className="detalhe-secundario">Nenhum NPC aqui ainda.</p>}
                {grupo.npcsDoGrupo.length > 0 && (
                  <ul className="lista-cards lista-cards--vertical">
                    {grupo.npcsDoGrupo.map((npc) => {
                      const expandidoNpc = npcsExpandidos.has(npc.id);
                      return (
                        <li key={npc.id} className="cartao-npc-biblioteca">
                          <div className="cartao-npc-topo">
                            {npc.foto_url && (
                              <div className="cartao-personagem-foto" style={{ backgroundImage: `url("${npc.foto_url}")` }} />
                            )}
                            <div className="cartao-personagem-corpo">
                              <strong>{npc.nome}</strong>
                              <p className="detalhe-secundario">
                                Vida {npc.vida_max} · Dor {npc.dor_max} · Balas {npc.balas_max}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="botao-detalhes-toggle"
                              onClick={() => alternarNpcExpandido(npc.id)}
                              aria-expanded={expandidoNpc}
                            >
                              {expandidoNpc ? 'Menos ▲' : 'Mais ▾'}
                            </button>
                            <button className="botao-remover" onClick={() => setNpcParaRemover(npc.id)}>
                              Remover
                            </button>
                          </div>

                          {expandidoNpc && (
                            <div className="cartao-personagem-detalhes cartao-npc-detalhes">
                              <div className="npc-detalhes-linha-superior">
                                <UploadFoto
                                  caminho={`campanha_npc/${npc.id}`}
                                  fotoAtual={npc.foto_url}
                                  editavel
                                  variante="pequena"
                                  alt={npc.nome}
                                  onSalvar={(url) => atualizarNpcCampanha(npc.id, { foto_url: url }).then(({ data }) => data && setNpcs((atual) => atual.map((n) => (n.id === npc.id ? data : n))))}
                                />
                                <label className="campo-editavel-rotulo npc-descricao-campo">
                                  Descrição
                                  <textarea
                                    defaultValue={npc.descricao}
                                    rows={3}
                                    placeholder="Aparência, personalidade, segredos..."
                                    onBlur={(e) => salvarDescricaoNpc(npc, e.target.value)}
                                  />
                                </label>
                              </div>

                              <label className="campo-editavel-rotulo npc-pasta-campo">
                                Mover pra pasta
                                <select value={npc.pasta_id ?? ''} onChange={(e) => moverNpcParaPasta(npc, e.target.value)}>
                                  <option value="">Sem pasta</option>
                                  {pastasNpc.map((p) => (
                                    <option key={p.id} value={p.id}>{p.nome}</option>
                                  ))}
                                </select>
                              </label>

                              <div className="npc-inventario-secao">
                                <h4>Inventário</h4>
                                <InventarioNpc npcId={npc.id} />
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </details>
            ));
          })()}

          <form onSubmit={handleCriarPasta} className="form-inline">
            <label>
              Nova pasta
              <input
                value={novaPasta.nome}
                onChange={(e) => setNovaPasta({ ...novaPasta, nome: e.target.value })}
                placeholder="Sacramento, Subtrama do Xerife..."
              />
            </label>
            <label className="campo-largura-total">
              Descrição da pasta (opcional)
              <input
                value={novaPasta.descricao}
                onChange={(e) => setNovaPasta({ ...novaPasta, descricao: e.target.value })}
                placeholder="Do que se trata..."
              />
            </label>
            <button type="submit" disabled={criandoPasta}>
              {criandoPasta ? 'Criando...' : '+ Criar pasta'}
            </button>
          </form>

          <form onSubmit={handleCriarNpc} className="form-grade">
            <label>
              Modelo rápido (opcional)
              <select value={modeloNpc} onChange={(e) => aplicarModeloNpc(e.target.value)}>
                <option value="">Do zero...</option>
                {MODELOS_NPC.map((m) => (
                  <option key={m.nome} value={m.nome}>{m.nome}</option>
                ))}
              </select>
            </label>
            <label>
              Pasta
              <select value={novoNpc.pasta_id} onChange={(e) => setNovoNpc({ ...novoNpc, pasta_id: e.target.value })}>
                <option value="">Sem pasta</option>
                {pastasNpc.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </label>
            <label>
              Nome
              <input
                value={novoNpc.nome}
                onChange={(e) => setNovoNpc({ ...novoNpc, nome: e.target.value })}
                required
              />
            </label>
            <label>
              Vida
              <input
                type="number"
                min="1"
                value={novoNpc.vida_max}
                onChange={(e) => setNovoNpc({ ...novoNpc, vida_max: Number(e.target.value) || 1 })}
              />
            </label>
            <label>
              Dor
              <input
                type="number"
                min="1"
                value={novoNpc.dor_max}
                onChange={(e) => setNovoNpc({ ...novoNpc, dor_max: Number(e.target.value) || 1 })}
              />
            </label>
            <label>
              Balas
              <input
                type="number"
                min="0"
                value={novoNpc.balas_max}
                onChange={(e) => setNovoNpc({ ...novoNpc, balas_max: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="campo-largura-total">
              Descrição (opcional)
              <textarea
                value={novoNpc.descricao}
                onChange={(e) => setNovoNpc({ ...novoNpc, descricao: e.target.value })}
                placeholder="Aparência, personalidade, segredos..."
                rows={2}
              />
            </label>
            <button type="submit" disabled={criandoNpc}>
              {criandoNpc ? 'Criando...' : '+ Criar NPC'}
            </button>
          </form>
        </section>
      )}

      {podeGerenciar && abaAtiva === 'convites' && (
        <section className="secao-aba-campanha">
          <h2>Convidar jogador</h2>
          <form onSubmit={handleBuscarEmail} className="form-inline">
            <label>
              Adicionar jogador (nome ou e-mail)
              <input
                type="text"
                value={buscaTermo}
                onChange={(e) => setBuscaTermo(e.target.value)}
                placeholder="Nome de exibição ou e-mail..."
              />
            </label>
            <button type="submit" disabled={buscando}>{buscando ? 'Buscando...' : 'Buscar'}</button>
          </form>

          {buscaFeita && resultadosBusca.length === 0 && (
            <p className="detalhe-secundario">Ninguém encontrado com esse nome ou e-mail.</p>
          )}
          {resultadosBusca.length > 0 && (
            <ul className="lista-cards">
              {resultadosBusca.map((u) => (
                <li key={u.id}>
                  {u.display_name} <span className="detalhe-secundario">({u.email})</span>
                  <button onClick={() => handleConvidar(u.id)}>Convidar</button>
                </li>
              ))}
            </ul>
          )}

          {convitesEnviados.length > 0 && (
            <>
              <h3>Convites enviados</h3>
              <ul className="lista-cards">
                {convitesEnviados.map((c) => (
                  <li key={c.id}>
                    {c.usuario?.display_name} <span className="detalhe-secundario">({c.usuario?.email})</span>
                    <span className="detalhe-secundario">{legendaStatus(c.status)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <PopupConfirmar
        aberto={Boolean(vinculoParaRemover)}
        mensagem="Remover este personagem da campanha?"
        onConfirmar={handleDesvincular}
        onCancelar={() => setVinculoParaRemover(null)}
      />
      <PopupConfirmar
        aberto={confirmandoRemoverLote}
        mensagem={`Remover ${selecionados.size} personagem(ns) selecionado(s) da campanha?`}
        textoConfirmar={removendoLote ? 'Removendo...' : 'Remover todos'}
        onConfirmar={removerLote}
        onCancelar={() => setConfirmandoRemoverLote(false)}
      />
      <PopupConfirmar
        aberto={Boolean(npcParaRemover)}
        mensagem="Remover este NPC da biblioteca?"
        onConfirmar={handleRemoverNpc}
        onCancelar={() => setNpcParaRemover(null)}
      />
      <PopupConfirmar
        aberto={Boolean(pastaParaRemover)}
        mensagem="Remover esta pasta? Os NPCs dentro dela não são apagados, só ficam sem pasta."
        onConfirmar={handleRemoverPasta}
        onCancelar={() => setPastaParaRemover(null)}
      />
    </main>
  );
}

function legendaStatus(status) {
  if (status === 'pendente') return 'Aguardando resposta';
  if (status === 'aceito') return 'Aceito';
  return 'Recusado';
}