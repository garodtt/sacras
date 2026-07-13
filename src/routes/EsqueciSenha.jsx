import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function EsqueciSenha() {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const { error } = await resetPassword(email);

    setCarregando(false);
    if (error) setErro(error.message);
    else setEnviado(true);
  }

  return (
    <main className="tela-auth">
      <div className="card-auth">
        <h1>Redefinir senha</h1>

        {enviado ? (
          <p>Se esse e-mail estiver cadastrado, um link de redefinição foi enviado. Confira sua caixa de entrada (e o spam).</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              E-mail cadastrado
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>

            {erro && <p className="erro">{erro}</p>}

            <button type="submit" disabled={carregando}>
              {carregando ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
          </form>
        )}

        <p><Link to="/login">Voltar ao login</Link></p>
      </div>
    </main>
  );
}
