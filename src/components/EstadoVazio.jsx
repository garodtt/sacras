// Estado vazio (13/07) — antes era só um <p> de texto solto em toda
// lista sem nada ainda. Selo de estrela discreto (mesmo componente do
// cabeçalho, já usado no app — não é ilustração nova) + texto,
// centralizado numa caixa tracejada. Simples de propósito: o ganho
// aqui é o respiro/moldura, não uma ilustração elaborada.
import EstrelaXerife from './EstrelaXerife.jsx';

export default function EstadoVazio({ children }) {
  return (
    <div className="estado-vazio">
      <EstrelaXerife className="estado-vazio-estrela" />
      <p>{children}</p>
    </div>
  );
}