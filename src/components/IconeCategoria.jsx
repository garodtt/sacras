// Ícone de categoria do item (13/07) — forma simples + cor, não emoji.
// Objetivo é só escanear uma lista longa mais rápido (munição, arma
// branca, comida, roupa, remédio, ferramenta), não uma ilustração.
const CATEGORIAS = {
  municao: { forma: 'M4 2h4v10a2 2 0 01-4 0V2z', cor: '#5a4a35', titulo: 'Munição' },
  arma_branca: { forma: 'M6 1l5 11-2 1L3 3z', cor: '#9c2b1a', titulo: 'Arma branca' },
  comida: { forma: null, circulo: true, cor: '#b98a3d', titulo: 'Comida' },
  roupa: { forma: 'M4 2L1 4v2l2-1v7h6V5l2 1V4L8 2H4z', cor: '#7c5330', titulo: 'Roupa' },
  remedio: { forma: 'M5 1h2v4h4v2H7v4H5V7H1V5h4z', cor: '#3a6b4a', titulo: 'Remédio' },
  ferramenta: { forma: 'M2 10l5-5 1 1-5 5-1-1zM7 4l2-2 2 2-2 2z', cor: '#4a4a4a', titulo: 'Ferramenta' },
  outro: { forma: null, circulo: true, cor: '#cbb98e', titulo: 'Outro' },
};

export default function IconeCategoria({ categoria = 'outro' }) {
  const config = CATEGORIAS[categoria] || CATEGORIAS.outro;

  return (
    <svg viewBox="0 0 12 12" className="icone-categoria" title={config.titulo} aria-label={config.titulo}>
      {config.circulo ? (
        <circle cx="6" cy="6" r="4.5" fill={config.cor} />
      ) : (
        <path d={config.forma} fill={config.cor} />
      )}
    </svg>
  );
}

export const OPCOES_CATEGORIA = Object.entries(CATEGORIAS).map(([valor, c]) => ({ valor, titulo: c.titulo }));