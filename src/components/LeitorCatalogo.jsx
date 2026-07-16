import { useEffect, useState } from 'react';

// Leitor do Catálogo de Equipamento (13/07) — em vez de renderizar o
// PDF no navegador (frágil: depende de um "worker" do pdf.js, CORS,
// e não dá pra testar de verdade num navegador de dentro do sandbox),
// as 14 páginas do livro foram convertidas pra imagem uma vez só
// (public/catalogo/pagina-XX.jpg) e ficam servidas como arquivo
// estático — simples e garantido de funcionar. O visualizador é só
// isso: uma imagem por vez, Anterior/Próxima, com uma transição de
// "virar página".
const TOTAL_PAGINAS = 14;

export default function LeitorCatalogo({ aberto, onFechar }) {
  const [pagina, setPagina] = useState(1);
  const [direcao, setDirecao] = useState('frente');

  useEffect(() => {
    if (!aberto) return;
    setPagina(1);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function handleTecla(e) {
      if (e.key === 'ArrowRight') irPara(pagina + 1);
      else if (e.key === 'ArrowLeft') irPara(pagina - 1);
      else if (e.key === 'Escape') onFechar();
    }
    window.addEventListener('keydown', handleTecla);
    return () => window.removeEventListener('keydown', handleTecla);
  }, [aberto, pagina]);

  if (!aberto) return null;

  function irPara(novaPagina) {
    if (novaPagina < 1 || novaPagina > TOTAL_PAGINAS) return;
    setDirecao(novaPagina > pagina ? 'frente' : 'volta');
    setPagina(novaPagina);
  }

  const numeroArquivo = String(pagina).padStart(2, '0');

  return (
    <div className="popup-fundo" onClick={onFechar}>
      <div className="leitor-catalogo" onClick={(e) => e.stopPropagation()}>
        <div className="leitor-catalogo-topo">
          <span>Grande Catálogo de Equipamento</span>
          <button type="button" className="botao-secundario" onClick={onFechar}>
            Fechar
          </button>
        </div>

        <div className="leitor-catalogo-pagina">
          <img key={pagina} src={`/catalogo/pagina-${numeroArquivo}.jpg`} alt={`Página ${pagina} do catálogo`} className={`leitor-catalogo-imagem leitor-catalogo-imagem--${direcao}`} />
        </div>

        <div className="leitor-catalogo-nav">
          <button type="button" onClick={() => irPara(pagina - 1)} disabled={pagina === 1}>
            ← Anterior
          </button>
          <span>
            Página {pagina} de {TOTAL_PAGINAS}
          </span>
          <button type="button" onClick={() => irPara(pagina + 1)} disabled={pagina === TOTAL_PAGINAS}>
            Próxima →
          </button>
        </div>
      </div>
    </div>
  );
}