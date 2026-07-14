// Botão de 3 barrinhas que abre o MenuLateral — mesmo visual nos dois
// contextos (Painel e dentro da ficha), só muda o que a lista de itens
// faz (navegar vs. trocar de aba).
export default function BotaoHamburguer({ onClick, label = 'Menu' }) {
  return (
    <button type="button" className="botao-hamburguer" onClick={onClick} aria-label={label}>
      <span></span>
      <span></span>
      <span></span>
    </button>
  );
}