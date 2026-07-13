import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { listarTodasCampanhas, listarTodosPersonagens } from '../lib/dados.js';

// Visão geral do Admin — mantida por decisão explícita (13/07): além da
// mesma experiência de qualquer usuário (/painel), o Admin tem esta tela
// extra só de leitura com TUDO do sistema (todas as campanhas, de
// qualquer criador, e todos os personagens, de qualquer dono).
export default function AdminDashboard() {
  const { profile, signOut } = useAuth();

  const [campanhas, setCampanhas] = useState([]);
  const [personagens, setPersonagens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([listarTodasCampanhas(), listarTodosPersonagens()]).then(([resCampanhas, resPersonagens]) => {
      if (resCampanhas.error) setErro(resCampanhas.error.message);
      else if (resPersonagens.error) setErro(resPersonagens.error.message);
      setCampanhas(resCampanhas.data ?? []);
      setPersonagens(resPersonagens.data ?? []);
      setCarregando(false);
    });
  }, []);

  return (
    <main className="painel">
      <header className="painel-header">
        <h1>Visão geral (Admin)</h1>
        <span>
          <Link to="/painel">Seu painel</Link>{' · '}
          <button onClick={signOut}>Sair</button>
        </span>
      </header>
      <p>
        Bem-vindo, {profile?.display_name}. Visão macro: todas as
        campanhas e personagens do sistema.
      </p>

      {erro && <p className="erro">{erro}</p>}

      <section>
        <h2>Todas as campanhas</h2>
        {carregando ? (
          <p>Carregando...</p>
        ) : campanhas.length === 0 ? (
          <p>Nenhuma campanha criada ainda no sistema.</p>
        ) : (
          <table className="tabela-admin">
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Criada por</th>
                <th>Criada em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td>{c.dono?.display_name} ({c.dono?.email})</td>
                  <td>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                  <td><Link to={`/campanha/${c.id}`}>Ver</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Todos os personagens</h2>
        {carregando ? (
          <p>Carregando...</p>
        ) : personagens.length === 0 ? (
          <p>Nenhum personagem criado ainda no sistema.</p>
        ) : (
          <table className="tabela-admin">
            <thead>
              <tr>
                <th>Personagem</th>
                <th>Dono</th>
                <th>Criado em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {personagens.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome || '(sem nome)'}</td>
                  <td>{p.dono?.display_name} ({p.dono?.email})</td>
                  <td>{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                  <td><Link to={`/personagem/${p.id}`}>Ver</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}