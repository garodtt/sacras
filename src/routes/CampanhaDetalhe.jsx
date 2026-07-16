import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import PopupConfirmar from '../components/PopupConfirmar.jsx';
import {
  buscarCampanha,
  listarPersonagensDaCampanha,
  listarMeusPersonagens,
  vincularPersonagem,
  desvincularPersonagem,
  buscarUsuarioPorEmail,
  convidarParaCampanha,
  listarConvitesDaCampanha,
  meuAcessoNaCampanha,
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

  const [buscaEmail, setBuscaEmail] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [buscaFeita, setBuscaFeita] = useState(false);

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

  async function handleDesvincular() {
    const vinculoId = vinculoParaRemover;
    setVinculoParaRemover(null);
    const { error } = await desvincularPersonagem(vinculoId);
    if (error) setErro(error.message);
    else carregarTudo();
  }

  async function handleBuscarEmail(e) {
    e.preventDefault();
    if (!buscaEmail.trim()) return;

    setBuscando(true);
    setBuscaFeita(false);
    const { data, error } = await buscarUsuarioPorEmail(buscaEmail);
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
      setBuscaEmail('');
      setBuscaFeita(false);
      carregarTudo();
    }
  }

  if (carregando) return <p style={{ padding: '2rem' }}>Carregando...</p>;
  if (!campanha) return <p style={{ padding: '2rem' }}>Campanha não encontrada (ou você não tem acesso a ela).</p>;

  return (
    <main className="painel">
      <p><Link to="/painel">&larr; Voltar</Link></p>
      <h1>{campanha.nome}</h1>
      {campanha.descricao && <p>{campanha.descricao}</p>}
      {podeGerenciar && (
        <p><Link to={`/campanha/${id}/combate`}>⚔ Rastreador de Combate</Link></p>
      )}
      {erro && <p className="erro">{erro}</p>}

      <section>
        <h2>Personagens nesta campanha</h2>
        <ul className="lista-cards">
          {membros.map((m) => (
            <li key={m.id}>
              <div>
                <Link to={`/personagem/${m.personagem.id}`}>{m.personagem.nome || '(sem nome)'}</Link>{' '}
                <span className="detalhe-secundario">— {m.personagem.dono?.display_name}</span>
              </div>
              {(podeGerenciar || m.personagem.user_id === profile.id) && (
                <button className="botao-remover" onClick={() => setVinculoParaRemover(m.id)}>Remover</button>
              )}
            </li>
          ))}
          {membros.length === 0 && <li>Nenhum personagem vinculado ainda.</li>}
        </ul>

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
              Adicionar jogador (e-mail exato)
              <input
                type="email"
                value={buscaEmail}
                onChange={(e) => setBuscaEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </label>
            <button type="submit" disabled={buscando}>{buscando ? 'Buscando...' : 'Buscar'}</button>
          </form>

          {buscaFeita && resultadosBusca.length === 0 && (
            <p className="detalhe-secundario">Ninguém cadastrado com esse e-mail.</p>
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