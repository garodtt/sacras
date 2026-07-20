// Esqueleto de carregamento (13/07) — bloco cinza pulsando, no lugar
// de "Carregando..." solto em texto. `largura`/`altura` aceitam
// qualquer valor de CSS (px, rem, %, etc).
export function Esqueleto({ largura = '100%', altura = '1rem', arredondado = false }) {
  return (
    <span
      className="esqueleto"
      style={{ width: largura, height: altura, borderRadius: arredondado ? '50%' : 'var(--radio-padrao)' }}
    />
  );
}

// Layout composto parecido com o topo da ficha (retrato + nome) —
// usado enquanto Personagem.jsx busca os dados. Não precisa ser um
// espelho perfeito da tela real; só dar uma pista visual do que está
// vindo, em vez de uma tela em branco com um texto solto.
export function EsqueletoFicha() {
  return (
    <div className="esqueleto-ficha" aria-hidden="true">
      <div className="esqueleto-ficha-topo">
        <Esqueleto largura="4.5rem" altura="4.5rem" arredondado />
        <Esqueleto largura="60%" altura="2rem" />
      </div>
      <Esqueleto largura="30%" altura="1.4rem" />
      <div className="esqueleto-ficha-grade">
        <Esqueleto altura="3.5rem" />
        <Esqueleto altura="3.5rem" />
        <Esqueleto altura="3.5rem" />
        <Esqueleto altura="3.5rem" />
      </div>
      <Esqueleto largura="25%" altura="1.4rem" />
      <Esqueleto altura="5rem" />
    </div>
  );
}