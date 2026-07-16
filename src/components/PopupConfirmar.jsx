// Popup de confirmação reutilizável (13/07) — substitui window.confirm()
// em todo o app. O confirm() nativo do navegador é uma caixa cinza de
// sistema que quebra a imersão de uma ficha "envelhecida"; este popup
// usa o mesmo visual do resto do app (.popup-fundo/.popup-caixa).
//
// Como o React não tem como "pausar" a execução esperando um clique
// (diferente do window.confirm(), que é síncrono/bloqueante), cada
// tela que usa isso guarda em estado local QUAL item está pendente de
// confirmação (ex.: `const [confirmando, setConfirmando] = useState(null)`)
// e só executa a ação de verdade dentro de onConfirmar.
export default function PopupConfirmar({ aberto, titulo = 'Confirmar', mensagem, onConfirmar, onCancelar, textoConfirmar = 'Remover' }) {
  if (!aberto) return null;

  return (
    <div className="popup-fundo" onClick={onCancelar}>
      <div className="popup-caixa popup-caixa--menu" onClick={(e) => e.stopPropagation()}>
        <h3>{titulo}</h3>
        <p>{mensagem}</p>
        <div className="popup-acoes">
          <button type="button" className="botao-remover" onClick={onConfirmar}>
            {textoConfirmar}
          </button>
          <button type="button" className="botao-secundario" onClick={onCancelar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}