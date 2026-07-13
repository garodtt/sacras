import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

// O Supabase, ao clicar no link do e-mail, já abre esta página com uma
// sessão de recuperação ativa (o client detecta isso sozinho pela URL).
// Só falta pedir a nova senha e chamar updatePassword().
export default function RedefinirSenha() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');

    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }

    setCarregando(true);
    const { error } = await updatePassword(senha);
    setCarregando(false);

    if (error) setErro(error.message);
    else navigate('/login');
  }

  return (
    <main className="tela-auth">
      <div className="card-auth">
        <h1>Escolher nova senha</h1>
        <form onSubmit={handleSubmit}>
          <label>
            Nova senha
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirmar nova senha
            <input
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>

          {erro && <p className="erro">{erro}</p>}

          <button type="submit" disabled={carregando}>
            {carregando ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </main>
  );
}
