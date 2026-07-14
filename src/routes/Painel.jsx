import { useAuth } from '../contexts/AuthContext.jsx';
import PainelShell from '../components/layout/PainelShell.jsx';

// Tela inicial (13/07 — reestruturação pro celular). Antes tinha tudo
// (personagens, campanhas, convites, os dois formulários de criar)
// numa página só, rolando bastante — ruim no celular. Agora isso vira
// só a "casca": o menu lateral (☰, PainelShell.jsx) é que leva pra
// /painel/personagens, /painel/campanhas, ou abre os popups de criar.
export default function Painel() {
  const { profile } = useAuth();

  return (
    <PainelShell>
      <p className="boas-vindas">Bem-vindo, {profile?.display_name}.</p>
      <p className="detalhe-secundario">
        Toque no menu (☰, canto superior esquerdo) pra ver seus personagens, suas campanhas, ou criar algo novo.
      </p>
    </PainelShell>
  );
}