import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  listarMeusPersonagens,
  criarPersonagem,
  listarMinhasCampanhas,
  listarCampanhasQueParticipo,
  criarCampanha,
  listarConvitesPendentes,
  responderConvite,
} from '../lib/dados.js';

// Painel único — não existe mais separação Mestre/Jogador. Qualquer
// usuário (Admin incluso, que também é "tratado como usuário") vê a
// mesma tela: convites pendentes, seus personagens e suas campanhas
// (criadas e em que participa). Admin ganha só um link extra pra /admin.
export default function Painel() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [personagens, setPersonagens] = useState([]);
  const [campanhasCriadas, setCampanhasCriadas] = useState([]);
  const [campanhasParticipo, setCampanhasParticipo] = useState([]);
  const [convites, setConvites] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [nomePersonagem, setNomePersonagem] = useState('');
  const [criandoPersonagem, setCriandoPersonagem] = useState(false);

  const [nomeCampanha, setNomeCampanha] = useState('');
  const [descricaoCampanha, setDescricaoCampanha] = useState('');
  const [criandoCampanha, setCriandoCampanha] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setCarregando(true);
    setErro('');

    const [resPersonagens, resCriadas, resParticipo, resConvites] = await Promise.all([
      listarMeusPersonagens(profile.id),
      listarMinhasCampanhas(profile.id),
      listarCampanhasQueParticipo(profile.id),
      listarConvitesPendentes(profile.id),
    ]);

    if (resPersonagens.error) setErro(resPersonagens.error.message);
    else if (resCriadas.error) setErro(resCriadas.error.message);
    else if (resParticipo.error) setErro(resParticipo.error.message);
    else if (resConvites.error) setErro(resConvites.error.message);

    setPersonagens(resPersonagens.data ?? []);
    setCampanhasCriadas(resCriadas.data ?? []);

    // Dedupe por campanha.id: o mesmo usuário pode ter >1 personagem na
    // mesma campanha, o que geraria linhas repetidas aqui.
    const vistos = new Set();
    const participo = [];
    for (const row of resParticipo.data ?? []) {
      if (row.campanha && !vistos.has(row.campanha.id)) {
        vistos.add(row.campanha.id);
        participo.push(row.campanha);
      }
    }
    setCampanhasParticipo(participo);

    setConvites(resConvites.data ?? []);
    setCarregando(false);
  }

  async function handleCriarPersonagem(e) {
    e.preventDefault();
    if (!nomePersonagem.trim()) return;

    setErro('');
    setCriandoPersonagem(true);
    const { data, error } = await criarPersonagem({ userId: profile.id, nome: nomePersonagem.trim() });
    setCriandoPersonagem(false);

    if (error) setErro(error.message);
    else navigate(`/personagem/${data.id}`);
  }

  async function handleCriarCampanha(e) {
    e.preventDefault();
    if (!nomeCampanha.trim()) return;

    setErro('');
    setCriandoCampanha(true);
    const { data, error } = await criarCampanha({
      nome: nomeCampanha.trim(),
      descricao: descricaoCampanha.trim() || null,
      criadoPor: profile.id,
    });
    setCriandoCampanha(false);

    if (error) setErro(error.message);
    else navigate(`/campanha/${data.id}`);
  }

  async function handleResponderConvite(convId, status, campanhaId) {
    setErro('');
    const { error } = await responderConvite(convId, status);

    if (error) {
      setErro(error.message);
    } else if (status === 'aceito') {
      // Já cai direto na campanha, pra vincular um personagem em seguida.
      navigate(`/campanha/${campanhaId}`);
    } else {
      carregar();
    }
  }

  return (
    <main className="painel">
      <header className="painel-header">
        <h1>Sacramento RPG</h1>
        <span>
          {profile?.role === 'admin' && <Link to="/admin">Visão geral (Admin)</Link>}
          {profile?.role === 'admin' && ' · '}
          <button onClick={signOut}>Sair</button>
        </span>
      </header>
      <p>Bem-vindo, {profile?.display_name}.</p>

      {erro && <p className="erro">{erro}</p>}

      {!carregando && convites.length > 0 && (
        <section>
          <h2>Convites pendentes</h2>
          <ul className="lista-cards">
            {convites.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{c.campanha?.nome}</strong>
                  <p>Convite de {c.campanha?.dono?.display_name}</p>
                </div>
                <span>
                  <button onClick={() => handleResponderConvite(c.id, 'aceito', c.campanha?.id)}>Aceitar</button>{' '}
                  <button onClick={() => handleResponderConvite(c.id, 'recusado', c.campanha?.id)}>Recusar</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Seus personagens</h2>
        {carregando ? (
          <p>Carregando...</p>
        ) : personagens.length === 0 ? (
          <p>Você ainda não criou nenhum personagem.</p>
        ) : (
          <ul className="lista-cards">
            {personagens.map((p) => (
              <li key={p.id}>
                <Link to={`/personagem/${p.id}`}>{p.nome || '(sem nome)'}</Link>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleCriarPersonagem} className="form-inline">
          <label>
            Nome do personagem
            <input value={nomePersonagem} onChange={(e) => setNomePersonagem(e.target.value)} required />
          </label>
          <button type="submit" disabled={criandoPersonagem}>
            {criandoPersonagem ? 'Criando...' : 'Criar personagem'}
          </button>
        </form>
      </section>

      <section>
        <h2>Campanhas que você criou</h2>
        {carregando ? (
          <p>Carregando...</p>
        ) : campanhasCriadas.length === 0 ? (
          <p>Você ainda não criou nenhuma campanha.</p>
        ) : (
          <ul className="lista-cards">
            {campanhasCriadas.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{c.nome}</strong>
                  {c.descricao && <p>{c.descricao}</p>}
                </div>
                <Link to={`/campanha/${c.id}`}>Gerenciar</Link>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleCriarCampanha} className="form-inline">
          <label>
            Nome da campanha
            <input value={nomeCampanha} onChange={(e) => setNomeCampanha(e.target.value)} required />
          </label>
          <label>
            Descrição (opcional)
            <textarea value={descricaoCampanha} onChange={(e) => setDescricaoCampanha(e.target.value)} rows={2} />
          </label>
          <button type="submit" disabled={criandoCampanha}>
            {criandoCampanha ? 'Criando...' : 'Criar campanha'}
          </button>
        </form>
      </section>

      {!carregando && campanhasParticipo.length > 0 && (
        <section>
          <h2>Campanhas que você participa</h2>
          <ul className="lista-cards">
            {campanhasParticipo.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{c.nome}</strong>
                  {c.descricao && <p>{c.descricao}</p>}
                </div>
                <Link to={`/campanha/${c.id}`}>Ver</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}