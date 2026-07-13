// Shell genérico de popup de referência — fecha ao clicar fora ou no
// "Fechar". Conteúdo (children) fica livre; usado pelas tabelas de
// Iniciativa (cartas + crítico + falha) e de Dor no Rastreador de
// Combate (src/routes/Combate.jsx). Reaproveita o CSS de
// .popup-fundo/.popup-caixa que já existia (EfeitoDorPopup, ficha do
// personagem) — só ganhou a variante --larga pra caber mais tabela.
export default function PopupReferencia({ titulo, aberto, onFechar, children }) {
  if (!aberto) return null;

  return (
    <div className="popup-fundo" onClick={onFechar}>
      <div className="popup-caixa popup-caixa--larga" onClick={(e) => e.stopPropagation()}>
        <h3>{titulo}</h3>
        {children}
        <button type="button" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </div>
  );
}