import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  listarMinhasCampanhas,
  listarCampanhasQueParticipo,
  listarConvitesPendentes,
  responderConvite,
} from '../lib/dados.js';
import PainelShell from '../components/layout/PainelShell.jsx';

// "Minhas Campanhas" (13/07) — antes era 2-3 seções soltas dentro do
// Painel único (criadas, que participo, convites); agora é uma tela só,
// acessada pelo menu lateral. Convites pendentes entraram aqui (são
// sobre campanha, não tinham um item de menu próprio no pedido).
// Criar campanha continua sendo o popup do menu (PainelShell.jsx).
export default function PainelCampanhas() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [campanhasCriadas, setCampanhasCriadas] = useState([]);
  const [campanhasParticipo, setCampanhasParticipo] = useState([]);
  const [convites, setConvites] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setCarregando(true);
    setErro('');

    const [resCriadas, resParticipo, resConvites] = await Promise.all([
      listarMinhasCampanhas(profile.id),
      listarCampanhasQueParticipo(profile.id),
      listarConvitesPendentes(profile.id),
    ]);

    if (resCriadas.error) setErro(resCriadas.error.message);
    else if (resParticipo.error) setErro(resParticipo.error.message);
    else if (resConvites.error) setErro(resConvites.error.message);

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

  async function handleResponderConvite(convId, status, campanhaId) {
    setErro('');
    const { error } = await responderConvite(convId, status);

    if (error) setErro(error.message);
    else if (status === 'aceito') navigate(`/campanha/${campanhaId}`);
    else carregar();
  }

  return (
    <PainelShell>
      <h2>Suas campanhas</h2>
      {erro && <p className="erro">{erro}</p>}

      {!carregando && convites.length > 0 && (
        <section>
          <h3>Convites pendentes</h3>
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
        <h3>Que você criou</h3>
        {carregando ? (
          <p>Carregando...</p>
        ) : campanhasCriadas.length === 0 ? (
          <p className="detalhe-secundario">
            Você ainda não criou nenhuma campanha. Abra o menu e toque em "Criar Campanha".
          </p>
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
      </section>

      {!carregando && campanhasParticipo.length > 0 && (
        <section>
          <h3>Que você participa</h3>
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
    </PainelShell>
  );
}