import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Cadastro() {
  const { signUp } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const { error } = await signUp({ email, password: senha, displayName });

    setCarregando(false);
    if (error) setErro(error.message);
    else setMensagem('Conta criada! Verifique seu e-mail para confirmar antes de entrar.');
  }

  if (mensagem) {
    return (
      <main className="tela-auth">
        <div className="card-auth">
          <h1>Sacramento RPG</h1>
          <p>{mensagem}</p>
          <p><Link to="/login">Ir para o login</Link></p>
        </div>
      </main>
    );
  }

  return (
    <main className="tela-auth">
      <div className="card-auth">
        <h1>Criar conta</h1>
        <form onSubmit={handleSubmit}>
          <label>
            Nome de exibição
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </label>
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>

          {erro && <p className="erro">{erro}</p>}

          <button type="submit" disabled={carregando}>
            {carregando ? 'Criando...' : 'Criar conta'}
          </button>
        </form>

        <p><Link to="/login">Já tem conta? Entrar</Link></p>
      </div>
    </main>
  );
}