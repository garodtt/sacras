// Munição de RESERVA (leve = coldre, pesada = bandoleira). A capacidade
// de cada pool vem dos itens (calcularCapacidadeMunicao, src/lib/regras.js)
// — o "atual" é editável (o jogador ajusta conforme compra/gasta balas),
// sempre travado entre 0 e a capacidade daquele pool.
export default function MunicaoPool({ capacidade, atualLeve, atualPesada, onSalvar, editavel }) {
  return (
    <div className="grid-campos municao-pool">
      <label className="campo-editavel">
        <span>Munição leve — reserva ({capacidade.leve} máx.)</span>
        <input
          type="number"
          min="0"
          max={capacidade.leve}
          defaultValue={atualLeve}
          disabled={!editavel}
          onBlur={(e) => {
            const novo = Math.max(0, Math.min(capacidade.leve, Number(e.target.value) || 0));
            if (novo !== atualLeve) onSalvar('municao_leve_atual', novo);
          }}
        />
        <small className="campo-dica">Coldres na aba Itens definem a capacidade.</small>
      </label>
      <label className="campo-editavel">
        <span>Munição pesada — reserva ({capacidade.pesada} máx.)</span>
        <input
          type="number"
          min="0"
          max={capacidade.pesada}
          defaultValue={atualPesada}
          disabled={!editavel}
          onBlur={(e) => {
            const novo = Math.max(0, Math.min(capacidade.pesada, Number(e.target.value) || 0));
            if (novo !== atualPesada) onSalvar('municao_pesada_atual', novo);
          }}
        />
        <small className="campo-dica">Bandoleiras na aba Itens definem a capacidade.</small>
      </label>
    </div>
  );
}