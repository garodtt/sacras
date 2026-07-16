// Botão de 3 barrinhas que abre o MenuLateral — mesmo visual nos dois
// contextos (Painel e dentro da ficha), só muda o que a lista de itens
// faz (navegar vs. trocar de aba).
//
// `badge` (13/07): quando true, mostra uma bolinha vermelha no canto —
// usado pelo PainelShell pra avisar "tem convite pendente" sem precisar
// entrar no Painel pra descobrir.
export default function BotaoHamburguer({ onClick, label = 'Menu', badge = false }) {
  return (
    <button type="button" className="botao-hamburguer" onClick={onClick} aria-label={label}>
      <span></span>
      <span></span>
      <span></span>
      {badge && <span className="botao-hamburguer-badge" aria-hidden="true"></span>}
    </button>
  );
}