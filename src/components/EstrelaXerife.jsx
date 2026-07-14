// Selo de estrela (13/07) — SVG desenhado, não emoji. Usado como acento
// discreto ao lado do nome do sistema (cabeçalho do Painel/ficha).
// `currentColor` puxa a cor de quem chamar (ver .selo-estrela no CSS).
export default function EstrelaXerife({ className = 'selo-estrela' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.9 6.3 6.9.8-5.1 4.7 1.5 6.8-6.2-3.6-6.2 3.6 1.5-6.8-5.1-4.7 6.9-.8z" />
    </svg>
  );
}