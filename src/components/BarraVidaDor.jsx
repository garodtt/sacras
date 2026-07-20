// Barra de Vida/Dor (13/07) — visual, não só o número "3/6". Usada nos
// cartões de personagem da visão do Mestre (CampanhaDetalhe.jsx) e no
// Rastreador de Combate, pra dar uma leitura rápida de "como esse
// personagem está" sem precisar ler dois números e fazer conta de
// cabeça. Cada Círculo preenchido é um segmento da barra — mantém a
// linguagem visual "Círculos" do sistema, só que em barra em vez de
// bolinhas (bolinha individual não cabe bem num cartão pequeno).
export default function BarraVidaDor({ vidaAtual, vidaMax, dorAtual, dorMax, compacta = false }) {
  const percentVida = vidaMax > 0 ? Math.max(0, Math.min(100, (vidaAtual / vidaMax) * 100)) : 0;
  const percentDor = dorMax > 0 ? Math.max(0, Math.min(100, (dorAtual / dorMax) * 100)) : 0;

  return (
    <div className={`barra-vida-dor ${compacta ? 'barra-vida-dor--compacta' : ''}`}>
      <div className="barra-vida-dor-linha">
        {!compacta && <span>Vida</span>}
        <div className="barra-vida-dor-trilho">
          <div className="barra-vida-dor-preenchimento barra-vida-dor-preenchimento--vida" style={{ width: `${percentVida}%` }} />
        </div>
        <span className="barra-vida-dor-numero">{vidaAtual}/{vidaMax}</span>
      </div>
      <div className="barra-vida-dor-linha">
        {!compacta && <span>Dor</span>}
        <div className="barra-vida-dor-trilho">
          <div className="barra-vida-dor-preenchimento barra-vida-dor-preenchimento--dor" style={{ width: `${percentDor}%` }} />
        </div>
        <span className="barra-vida-dor-numero">{dorAtual}/{dorMax}</span>
      </div>
    </div>
  );
}