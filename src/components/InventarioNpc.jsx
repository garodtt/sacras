import { useEffect, useState } from 'react';
import { listarItensNpc, criarItemNpc, removerItemNpc } from '../lib/dados.js';

// Inventário de NPC (13/07) — bem mais simples que o do personagem:
// sem peso/espaço/mochila, só "o que ele tem" (chave, carta
// comprometedora, pertence notável). Busca só quando o card expande
// (a maioria dos NPCs talvez nunca precise disso).
export default function InventarioNpc({ npcId }) {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregar();
  }, [npcId]);

  async function carregar() {
    setCarregando(true);
    const { data, error } = await listarItensNpc(npcId);
    if (error) setErro(error.message);
    else setItens(data ?? []);
    setCarregando(false);
  }

  async function adicionar(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setAdicionando(true);
    const { data, error } = await criarItemNpc(npcId, { nome: nome.trim() });
    setAdicionando(false);
    if (error) setErro(error.message);
    else {
      setItens((atual) => [...atual, data]);
      setNome('');
    }
  }

  async function remover(itemId) {
    const { error } = await removerItemNpc(itemId);
    if (error) setErro(error.message);
    else setItens((atual) => atual.filter((i) => i.id !== itemId));
  }

  if (carregando) return <p className="detalhe-secundario">Carregando inventário...</p>;

  return (
    <div className="inventario-npc">
      {erro && <p className="erro">{erro}</p>}
      {itens.length === 0 && <p className="detalhe-secundario">Nada no inventário ainda.</p>}
      {itens.length > 0 && (
        <ul>
          {itens.map((item) => (
            <li key={item.id}>
              <span>
                {item.nome}
                {item.quantidade > 1 && ` (${item.quantidade})`}
              </span>
              <button type="button" className="botao-remover" onClick={() => remover(item.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={adicionar} className="form-inline">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Novo item (chave, carta...)"
        />
        <button type="submit" disabled={adicionando}>+</button>
      </form>
    </div>
  );
}