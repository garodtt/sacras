import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { listarMeusPersonagens } from '../lib/dados.js';
import PainelShell from '../components/layout/PainelShell.jsx';
import { Esqueleto } from '../components/Esqueleto.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';

// "Seus Personagens" (13/07) — antes era uma seção dentro do Painel
// único; agora é a própria tela, acessada pelo menu lateral. Criar um
// personagem novo continua sendo o popup do menu (PainelShell.jsx), não
// um formulário fixo aqui.
export default function PainelPersonagens() {
  const { profile } = useAuth();
  const [personagens, setPersonagens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarMeusPersonagens(profile.id).then(({ data, error }) => {
      if (error) setErro(error.message);
      setPersonagens(data ?? []);
      setCarregando(false);
    });
  }, [profile.id]);

  return (
    <PainelShell>
      <h2>Seus personagens</h2>
      {erro && <p className="erro">{erro}</p>}
      {carregando ? (
        <div className="esqueleto-lista">
          <Esqueleto altura="2.4rem" />
          <Esqueleto altura="2.4rem" />
          <Esqueleto altura="2.4rem" />
        </div>
      ) : personagens.length === 0 ? (
        <EstadoVazio>
          Você ainda não criou nenhum personagem. Abra o menu e toque em "Criar Personagem".
        </EstadoVazio>
      ) : (
        <ul className="lista-cards">
          {personagens.map((p) => (
            <li key={p.id}>
              <Link to={`/personagem/${p.id}`}>{p.nome || '(sem nome)'}</Link>
            </li>
          ))}
        </ul>
      )}
    </PainelShell>
  );
}