import { useState } from 'react';
import { atualizarItem, removerItem } from '../../lib/dados.js';

// Tabela de inventário — reaproveitada pro personagem E pra montaria
// (mesma tabela `items` no banco, dono diferente). Quem chama decide
// como criar/excluir-todos (onAdicionar/onExcluirTodos, já vêm prontos
// pra o dono/sub-local certo) — este componente só lista, edita e
// valida peso.
//
// 13/07: `pesoAdicional` é peso de OUTRA fonte que soma no "usado" sem
// ser um item de verdade (ex.: munição excedente, no personagem) —
// antes isso diminuía o limiteEspaco (deixava confuso, tipo "0/9.92");
// agora limiteEspaco é sempre o máximo de verdade, e o "usado" já vem
// somado com esse peso extra (0.08/10, por exemplo).
//
// Também corrige um bug de UX: quando uma mudança de peso/quantidade é
// rejeitada (passaria do limite), o <input> ficava mostrando o valor
// digitado mesmo sem ter salvado nada — parecia que só apareceu um
// aviso, mas na real tinha travado. `tentativas` força o input a
// remontar (voltar pro valor de verdade) toda vez que uma tentativa é
// rejeitada, mesmo se o valor salvo não mudou.
export default function TabelaItens({ itens, onMudar, editavel, limiteEspaco, pesoAdicional = 0, onAdicionar, onExcluirTodos }) {
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState('');
  const [tentativas, setTentativas] = useState({});

  const pesoTotal = (item) => Number(item.espaco ?? 0) * Number(item.quantidade ?? 1);
  const pesoItens = itens.reduce((soma, i) => soma + pesoTotal(i), 0);
  const espacoUsado = pesoItens + pesoAdicional;

  function rejeitar(item, mensagem) {
    setErro(mensagem);
    setTentativas((t) => ({ ...t, [item.id]: (t[item.id] || 0) + 1 }));
  }

  // Confere se dá pra aplicar uma mudança de peso/quantidade num item
  // sem estourar o limite — soma todo mundo (+ pesoAdicional), trocando
  // só a linha em questão pelos valores novos.
  function cabeNoLimite(itemId, pesoNovo, quantidadeNova) {
    const totalItens = itens.reduce((soma, i) => {
      if (i.id === itemId) return soma + pesoNovo * quantidadeNova;
      return soma + pesoTotal(i);
    }, 0);
    return totalItens + pesoAdicional <= limiteEspaco;
  }

  async function adicionar() {
    setErro('');
    setAdicionando(true);
    const { data, error } = await onAdicionar();
    setAdicionando(false);

    if (error) setErro(error.message);
    else onMudar([...itens, data]);
  }

  async function excluirTodos() {
    if (itens.length === 0) return;
    if (!window.confirm(`Excluir todos os ${itens.length} itens?`)) return;
    const { error } = await onExcluirTodos();
    if (error) setErro(error.message);
    else onMudar([]);
  }

  async function salvarCampo(item, campo, valor) {
    const { data, error } = await atualizarItem(item.id, { [campo]: valor });
    if (error) setErro(error.message);
    else onMudar(itens.map((i) => (i.id === item.id ? data : i)));
  }

  function salvarPeso(item, novoPeso) {
    const quantidade = Number(item.quantidade ?? 1);
    if (!cabeNoLimite(item.id, novoPeso, quantidade)) {
      rejeitar(item, `Não cabe: "${item.nome || 'item'}" passaria de ${limiteEspaco} de carga. Cheio.`);
      return;
    }
    setErro('');
    salvarCampo(item, 'espaco', novoPeso);
  }

  function salvarQuantidade(item, novaQuantidade) {
    const peso = Number(item.espaco ?? 0);
    if (!cabeNoLimite(item.id, peso, novaQuantidade)) {
      rejeitar(item, `Não cabe: "${item.nome || 'item'}" passaria de ${limiteEspaco} de carga. Cheio.`);
      return;
    }
    setErro('');
    salvarCampo(item, 'quantidade', novaQuantidade);
  }

  async function remover(item) {
    if (!window.confirm(`Remover "${item.nome || 'este item'}"?`)) return;
    const { error } = await removerItem(item.id);
    if (error) setErro(error.message);
    else onMudar(itens.filter((i) => i.id !== item.id));
  }

  return (
    <div className="bloco-tabela">
      {erro && <p className="erro">{erro}</p>}
      <div className="tabela-scroll">
        <table className="tabela-ficha tabela-responsiva">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Peso (un.)</th>
              <th>Qtd.</th>
              <th>Total</th>
              {editavel && <th></th>}
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id}>
                <td data-label="Nome">
                  <input
                    defaultValue={item.nome}
                    disabled={!editavel}
                    onBlur={(e) => e.target.value !== item.nome && salvarCampo(item, 'nome', e.target.value)}
                  />
                </td>
                <td data-label="Peso (un.)">
                  <input
                    key={`peso-${item.id}-${item.espaco}-${tentativas[item.id] || 0}`}
                    type="number"
                    min="0"
                    step="0.5"
                    defaultValue={item.espaco}
                    disabled={!editavel}
                    onBlur={(e) => {
                      const novo = Number(e.target.value) || 0;
                      if (novo !== Number(item.espaco)) salvarPeso(item, novo);
                    }}
                  />
                </td>
                <td data-label="Qtd.">
                  <input
                    key={`qtd-${item.id}-${item.quantidade}-${tentativas[item.id] || 0}`}
                    type="number"
                    min="1"
                    step="1"
                    defaultValue={item.quantidade ?? 1}
                    disabled={!editavel}
                    onBlur={(e) => {
                      const novo = Math.max(1, Math.round(Number(e.target.value) || 1));
                      if (novo !== Number(item.quantidade ?? 1)) salvarQuantidade(item, novo);
                    }}
                  />
                </td>
                <td data-label="Total" className="detalhe-secundario">{pesoTotal(item)}</td>
                {editavel && (
                  <td data-label="">
                    <button type="button" className="botao-remover" onClick={() => remover(item)}>
                      Remover
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={editavel ? 5 : 4} className="detalhe-secundario">
                  Nenhum item ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="detalhe-secundario">
        Carga usada: {espacoUsado.toFixed(2).replace(/\.00$/, '')} / {limiteEspaco}
      </p>
      {editavel && (
        <div className="acoes-tabela">
          <button type="button" onClick={adicionar} disabled={adicionando}>
            {adicionando ? 'Adicionando...' : '+ Adicionar item'}
          </button>
          {itens.length > 0 && (
            <button type="button" className="botao-remover" onClick={excluirTodos}>
              Excluir todos
            </button>
          )}
        </div>
      )}
    </div>
  );
}