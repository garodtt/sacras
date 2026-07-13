import { useState } from 'react';

// Campo + botão pra aplicar dano contra a Dor, disparando a "quebra de
// resistência" automaticamente quando necessário. A conta em si é feita
// em src/lib/regras.js (aplicarDano); este componente só coleta o número
// e mostra o resultado. `onAplicar` deve ser uma função async que
// calcula e persiste, devolvendo { quebras, caido } (ou null se deu
// erro, caso em que não mostramos mensagem).
export default function SofrerDano({ onAplicar, editavel }) {
  const [pontos, setPontos] = useState(1);
  const [aplicando, setAplicando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  if (!editavel) return null;

  async function aplicar() {
    setMensagem('');
    setAplicando(true);
    const resultado = await onAplicar(Number(pontos) || 0);
    setAplicando(false);

    if (!resultado) return; // erro já é mostrado pelo componente pai

    if (resultado.quebras > 0) {
      setMensagem(
        resultado.caido
          ? `Quebra de resistência (${resultado.quebras}x) — vida chegou a 0.`
          : `Quebra de resistência! Dor volta ao máximo, Vida −${resultado.quebras}.`
      );
    } else {
      setMensagem('Dor reduzida.');
    }
  }

  return (
    <div className="sofrer-dano">
      <label>
        Sofrer dano
        <input
          type="number"
          min="0"
          value={pontos}
          onChange={(e) => setPontos(e.target.value)}
        />
      </label>
      <button type="button" onClick={aplicar} disabled={aplicando}>
        {aplicando ? 'Aplicando...' : 'Aplicar'}
      </button>
      {mensagem && <small className="campo-dica">{mensagem}</small>}
    </div>
  );
}