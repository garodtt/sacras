import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import PopupConfirmar from '../components/PopupConfirmar.jsx';
import BarraVidaDor from '../components/BarraVidaDor.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';
import { Esqueleto } from '../components/Esqueleto.jsx';
import { calcularCapacidadeMunicaoDeArmas } from '../lib/regras.js';
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
      const resConvites = await listarConvitesDaCampanha(id);
      setConvitesEnviados(resConvites.data ?? []);
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

  async function handleDesvincular() {
    const vinculoId = vinculoParaRemover;
    setVinculoParaRemover(null);
    const { error } = await desvincularPersonagem(vinculoId);
    if (error) setErro(error.message);
    else carregarTudo();
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
      <p><Link to="/painel">&larr; Voltar</Link></p>
      <h1>{campanha.nome}</h1>
      {campanha.descricao && <p>{campanha.descricao}</p>}
      {podeGerenciar && (
        <p><Link to={`/campanha/${id}/combate`} className="botao-like-link">⚔ Abrir Rastreador de Combate</Link></p>
      )}
      {erro && <p className="erro">{erro}</p>}

      <section>
        <div className="painel-header">
          <h2>Personagens nesta campanha</h2>
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
              return (
                <div className={`cartao-personagem-campanha ${expandido ? 'cartao-expandido' : ''}`} key={m.id}>
                  <div className="cartao-personagem-topo">
                    <div
                      className="cartao-personagem-foto"
                      style={m.personagem.foto_url ? { backgroundImage: `url("${m.personagem.foto_url}")` } : undefined}
                    />
                    <div className="cartao-personagem-corpo">
                      <Link to={`/personagem/${m.personagem.id}`} className="cartao-personagem-nome">
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
                    </div>
                  )}

                  {(podeGerenciar || m.personagem.user_id === profile.id) && (
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
                    <td data-label="Nome">
                      <Link to={`/personagem/${m.personagem.id}`}>{m.personagem.nome || '(sem nome)'}</Link>
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

      {podeGerenciar && (
        <section>
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
    </main>
  );
}

function legendaStatus(status) {
  if (status === 'pendente') return 'Aguardando resposta';
  if (status === 'aceito') return 'Aceito';
  return 'Recusado';
}