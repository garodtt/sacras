import { Link } from 'react-router-dom';

// Menu lateral (drawer) reutilizável — usado em dois contextos
// diferentes (13/07):
// 1. No Painel (App.jsx): itens com `to` — navegação de verdade entre
//    /painel/personagens, /painel/campanhas etc.
// 2. Dentro da ficha do personagem: itens com `onClick` — troca de aba
//    local (sem navegar, mesma URL), pra não espalhar tudo na tela de
//    uma vez só no celular.
// Cada item usa OU `to` OU `onClick`, nunca os dois. Fecha o menu
// sozinho ao escolher qualquer item, ou ao clicar fora.
export default function MenuLateral({ aberto, onFechar, titulo, itens }) {
  if (!aberto) return null;

  return (
    <div className="menu-lateral-fundo" onClick={onFechar}>
      <nav className="menu-lateral" onClick={(e) => e.stopPropagation()}>
        <div className="menu-lateral-cabecalho">
          <strong>{titulo}</strong>
          <button type="button" className="menu-lateral-fechar" onClick={onFechar} aria-label="Fechar menu">
            ✕
          </button>
        </div>
        <ul>
          {itens.map((item, i) => (
            <li key={i} className={item.ativo ? 'menu-lateral-ativo' : ''}>
              {item.to ? (
                <Link to={item.to} onClick={onFechar}>
                  {item.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onFechar();
                    item.onClick();
                  }}
                >
                  {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}