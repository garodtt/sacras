// Trilha de círculos clicável — a mesma peça visual serve pra Vida, Dor
// (do personagem e da montaria) e Antecedentes (0 a 5). Clicar no
// círculo N define o valor como N; clicar de novo no último círculo já
// preenchido reduz em 1 — forma padrão de marcar/desmarcar uma trilha
// assim sem precisar digitar número.
export default function TrilhaCirculos({
  max,
  valor,
  onSelecionar,
  editavel = true,
  variante = 'neutro', // 'vida' | 'dor' | 'neutro' — só muda a cor de preenchido
  legenda,
}) {
  const pips = Array.from({ length: Math.max(0, max) }, (_, i) => i);

  function clicar(i) {
    if (!editavel) return;
    const novoValor = valor === i + 1 ? i : i + 1;
    onSelecionar(novoValor);
  }

  return (
    <div className="trilha-circulos">
      <div className={`trilha-pips trilha-pips--${variante}`}>
        {pips.map((i) => (
          <button
            key={i}
            type="button"
            className={`pip ${i < valor ? 'pip--cheio' : ''}`}
            onClick={() => clicar(i)}
            disabled={!editavel}
            aria-pressed={i < valor}
            aria-label={`${i + 1} de ${max}`}
            title={`${i + 1} de ${max}`}
          />
        ))}
      </div>
      {legenda && <span className="trilha-legenda">{legenda}</span>}
    </div>
  );
}