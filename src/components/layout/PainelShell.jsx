import EstrelaXerife from '../EstrelaXerife.jsx';
import MenuGlobal from './MenuGlobal.jsx';

// Casca comum das 3 telas do Painel (Painel.jsx "tela inicial",
// PainelPersonagens.jsx, PainelCampanhas.jsx) — 13/07, reestruturação
// pro celular: em vez de tudo numa página só rolando, cada área vira
// sua própria tela, navegável pelo menu lateral.
//
// 13/07 (4ª rodada): hambúrguer + menu + popups de criar personagem/
// campanha saíram daqui e viraram o componente MenuGlobal.jsx
// (reaproveitado também na ficha do personagem e na campanha, sempre
// com os mesmos 5 itens, independente da tela) — evita ter duas cópias
// da mesma lógica que podem divergir com o tempo.
export default function PainelShell({ children }) {
  return (
    <div className="painel-shell">
      <header className="painel-shell-header">
        <MenuGlobal />
        <h1>
          <EstrelaXerife />
          Sacramento RPG
          <EstrelaXerife />
        </h1>
      </header>

      <div className="painel-shell-conteudo">{children}</div>
      <p className="marca-sacramento">Sacramento</p>
    </div>
  );
}