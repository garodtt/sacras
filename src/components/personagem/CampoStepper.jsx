// Controle +/- (em vez de digitar um número) — pedido pra Máximo de
// Vida e Máximo de Dor (13/07). O valor "base" já vem calculado do
// atributo (ver src/lib/regras.js, calcularStatsDerivados só pra Vida);
// isso aqui é o jeito de dar um empurrão manual pra cima ou pra baixo em
// cima daquele base (ex.: efeito temporário). Atenção: editar o atributo
// de novo recalcula e substitui esse ajuste manual — ver nota em
// docs/ARQUITETURA.md.
export default function CampoStepper({ label, valor, min = 0, onSalvar, editavel = true, dica }) {
  if (!editavel) {
    return (
      <div className="campo-stepper campo-stepper--leitura">
        {label && <span>{label}</span>}
        <strong>{valor}</strong>
      </div>
    );
  }

  function alterar(delta) {
    const novo = Math.max(min, valor + delta);
    if (novo !== valor) onSalvar(novo);
  }

  return (
    <div className="campo-stepper">
      {label && <span>{label}</span>}
      <div className="campo-stepper-controles">
        <button type="button" onClick={() => alterar(-1)} aria-label={`Diminuir ${label || ''}`}>
          −
        </button>
        <strong>{valor}</strong>
        <button type="button" onClick={() => alterar(1)} aria-label={`Aumentar ${label || ''}`}>
          +
        </button>
      </div>
      {dica && <small className="campo-dica">{dica}</small>}
    </div>
  );
}