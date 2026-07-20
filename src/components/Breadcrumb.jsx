import { Link } from 'react-router-dom';

// Breadcrumb (13/07) — trilha de navegação no topo, pra voltar sem
// depender do botão "voltar" do navegador (que em telas com popup
// aberto ou aba trocada às vezes volta pro lugar errado). `itens` é
// uma lista de { label, to } — o ÚLTIMO item NÃO deveria ter `to`
// (é "onde você está", não clicável); os demais viram link.
export default function Breadcrumb({ itens }) {
  return (
    <nav className="breadcrumb" aria-label="Trilha de navegação">
      {itens.map((item, i) => (
        <span key={i} className="breadcrumb-item">
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span className="breadcrumb-atual">{item.label}</span>}
          {i < itens.length - 1 && <span className="breadcrumb-separador">/</span>}
        </span>
      ))}
    </nav>
  );
}