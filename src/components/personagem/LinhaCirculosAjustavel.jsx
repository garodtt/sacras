import TrilhaCirculos from './TrilhaCirculos.jsx';

// Vida/Dor "atual" com +/- dos lados — pensado pra usar no celular
// (toque rápido, sem abrir teclado numérico). Substitui o antigo painel
// "Sofrer Dano" (13/07): mais limpo, e separa ferimento direto na Vida
// de ferimento direto na Dor — cada um com seu próprio +/-.
//
// `onAjustar` decide a regra (a Dor aciona quebra de resistência ao
// zerar, a Vida não aciona nada — ver handlers em Personagem.jsx/
// Montaria.jsx). O clique direto num círculo (onSelecionarCirculo)
// continua funcionando do jeito antigo, pra ajuste manual/correção.
export default function LinhaCirculosAjustavel({
  max,
  valor,
  onAjustar,
  onSelecionarCirculo,
  editavel,
  variante,
  legenda,
}) {
  return (
    <div className="linha-circulos-ajuste">
      {editavel && (
        <button type="button" className="botao-ajuste" onClick={() => onAjustar(-1)} aria-label="Diminuir">
          −
        </button>
      )}
      <TrilhaCirculos
        max={max}
        valor={valor}
        editavel={editavel}
        variante={variante}
        legenda={legenda}
        onSelecionar={onSelecionarCirculo}
      />
      {editavel && (
        <button type="button" className="botao-ajuste" onClick={() => onAjustar(1)} aria-label="Aumentar">
          +
        </button>
      )}
    </div>
  );
}