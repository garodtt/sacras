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
  listarNotasPersonagensCampanha,
  removerVinculosEmLote,
} from '../lib/dados.js';

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

  const [modo, setModo] = useState('preparacao'); // 'preparacao' | 'sessao'
  const [notasMestre, setNotasMestre] = useState(null);

  const [npcs, setNpcs] = useState([]);
  const [npcParaRemover, setNpcParaRemover] = useState(null);
  const [modeloNpc, setModeloNpc] = useState('');
  const [novoNpc, setNovoNpc] = useState({ pasta: 'Geral', nome: '', vida_max: 6, dor_max: 6, balas_max: 6 });
  const [criandoNpc, setCriandoNpc] = useState(false);

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
      const [resConvites, resNotas, resNpcs, resNotasPersonagens] = await Promise.all([
        listarConvitesDaCampanha(id),
        buscarNotasMestre(id),
        listarNpcsCampanha(id),
        listarNotasPersonagensCampanha(idsVinculos),
      ]);
      setConvitesEnviados(resConvites.data ?? []);
      setNotasMestre(resNotas.data?.notas ?? '');
      setNpcs(resNpcs.data ?? []);
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
    const { data, error } = await criarNpcCampanha(id, { ...novoNpc, nome: novoNpc.nome.trim() });
    setCriandoNpc(false);

    if (error) setErro(error.message);
    else {
      setNpcs((atual) => [...atual, data].sort((a, b) => a.pasta.localeCompare(b.pasta) || a.nome.localeCompare(b.nome)));
      setNovoNpc({ pasta: novoNpc.pasta, nome: '', vida_max: 6, dor_max: 6, balas_max: 6 });
      setModeloNpc('');
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
        <div className="controles-mestre-topo">
          <div className="toggle-visualizacao">
            <button
              type="button"
              className={modo === 'sessao' ? 'toggle-ativo' : 'botao-secundario'}
              onClick={() => setModo('sessao')}
              title="Enxuto — só o essencial pra rodar a mesa"
            >
              Modo Sessão
            </button>
            <button
              type="button"
              className={modo === 'preparacao' ? 'toggle-ativo' : 'botao-secundario'}
              onClick={() => setModo('preparacao')}
              title="Completo — convites, vínculos, tudo aberto"
            >
              Modo Preparação
            </button>
          </div>
        </div>
      )}

      {erro && <p className="erro">{erro}</p>}

      <details className="secao-recolhivel" open>
        <summary>
          <h2>Personagens nesta campanha</h2>
        </summary>
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

        {modo === 'preparacao' && possoVincular && meusDisponiveisParaVincular.length > 0 && (
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

        {modo === 'preparacao' && possoVincular && meusPersonagens.length === 0 && (
          <p className="detalhe-secundario">
            Você ainda não tem nenhum personagem. Crie um no <Link to="/painel">seu painel</Link> pra vincular aqui.
          </p>
        )}

        {modo === 'preparacao' && possoVincular && meusPersonagens.length > 0 && meusDisponiveisParaVincular.length === 0 && (
          <p className="detalhe-secundario">Todos os seus personagens já estão nesta campanha.</p>
        )}

        {modo === 'preparacao' && !possoVincular && (
          <p className="detalhe-secundario">
            Você ainda não participa desta campanha. Se recebeu um convite,
            responda em <Link to="/painel">seu painel</Link>.
          </p>
        )}
      </details>

      {podeGerenciar && (
        <NotasMestre campanhaId={id} notasIniciais={notasMestre ?? ''} />
      )}

      {podeGerenciar && modo === 'preparacao' && (
        <details className="secao-recolhivel" open>
          <summary>
            <h2>Biblioteca de NPCs</h2>
          </summary>
          <p className="detalhe-secundario">
            Crie de antemão — depois é só puxar pro Rastreador de Combate na hora da luta ("Importar NPC da
            biblioteca"), sem digitar tudo de novo.
          </p>

          {npcs.length === 0 ? (
            <EstadoVazio>Nenhum NPC criado ainda.</EstadoVazio>
          ) : (
            Object.entries(
              npcs.reduce((porPasta, npc) => {
                (porPasta[npc.pasta] ??= []).push(npc);
                return porPasta;
              }, {})
            ).map(([pasta, npcsDaPasta]) => (
              <div key={pasta} className="pasta-npcs">
                <h3>{pasta}</h3>
                <ul className="lista-cards">
                  {npcsDaPasta.map((npc) => (
                    <li key={npc.id}>
                      <div>
                        <strong>{npc.nome}</strong>
                        <p className="detalhe-secundario">
                          Vida {npc.vida_max} · Dor {npc.dor_max} · Balas {npc.balas_max}
                        </p>
                      </div>
                      <button className="botao-remover" onClick={() => setNpcParaRemover(npc.id)}>
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}

          <form onSubmit={handleCriarNpc} className="form-inline">
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
              <input
                value={novoNpc.pasta}
                onChange={(e) => setNovoNpc({ ...novoNpc, pasta: e.target.value })}
                placeholder="Geral, Gangue do Rio..."
              />
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
            <button type="submit" disabled={criandoNpc}>
              {criandoNpc ? 'Criando...' : '+ Criar NPC'}
            </button>
          </form>
        </details>
      )}

      {podeGerenciar && modo === 'preparacao' && (
        <details className="secao-recolhivel">
          <summary>
            <h2>Convidar jogador</h2>
          </summary>
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
        </details>
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
    </main>
  );
}

function legendaStatus(status) {
  if (status === 'pendente') return 'Aguardando resposta';
  if (status === 'aceito') return 'Aceito';
  return 'Recusado';
}