import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

// Envolve uma rota que exige login. Se "allowedRoles" for passado,
// também exige que o profile.role esteja nessa lista.
export default function ProtectedRoute({ children, allowedRoles }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <p style={{ padding: '2rem' }}>Carregando...</p>;

  if (!session) return <Navigate to="/login" replace />;

  // Sessão existe mas o profile não veio (erro na consulta, linha
  // ausente etc). Antes isso caía no "senão" do PainelRedirect e virava
  // loop infinito entre /painel e /jogador -- agora para aqui.
  if (!profile) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>Não conseguimos carregar seu perfil.</p>
        <button onClick={() => window.location.reload()}>Tentar de novo</button>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/painel" replace />;
  }

  return children;
}