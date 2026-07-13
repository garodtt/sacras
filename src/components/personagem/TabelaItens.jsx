import { useState } from 'react';
import { atualizarItem, removerItem } from '../../lib/dados.js';

// Tabela de inventário — reaproveitada pro personagem E pra montaria
// (mesma tabela `items` no banco, dono diferente). Quem chama decide
// como criar/excluir-todos (onAdicionar/onExcluirTodos, já vêm prontos
// pra o dono certo) — este componente só lista, edita e valida peso.
//
// Regras de 13/07: peso da linha = peso unitário × quantidade; total não
// pode passar de `limiteEspaco` (trava de verdade, diferente da Fase 5
// que só mostrava um aviso). `permiteCarregador` liga a coluna de
// coldre/bandoleira — só faz sentido no inventário do personagem.
export default function TabelaItens({
  itens,
  onMudar,
  editavel,
  limiteEspaco,
  onAdicionar,
  onExcluirTodos,
  permiteCarregador = true,
}) {
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState('');

  const pesoTotal = (item) => Number(item.espaco ?? 0) * Number(item.quantidade ?? 1);
  const espacoUsado = itens.reduce((soma, i) => soma + pesoTotal(i), 0);

  // Confere se dá pra aplicar uma mudança de peso/quantidade num item
  // sem estourar o limite — soma todo mundo, trocando só a linha em
  // questão pelos valores novos.
  function cabeNoLimite(itemId, pesoNovo, quantidadeNova) {
    const total = itens.reduce((soma, i) => {
      if (i.id === itemId) return soma + pesoNovo * quantidadeNova;
      return soma + pesoTotal(i);
    }, 0);
    return total <= limiteEspaco;
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
      setErro(`Não cabe: passaria de ${limiteEspaco} de carga.`);
      return;
    }
    setErro('');
    salvarCampo(item, 'espaco', novoPeso);
  }

  function salvarQuantidade(item, novaQuantidade) {
    const peso = Number(item.espaco ?? 0);
    if (!cabeNoLimite(item.id, peso, novaQuantidade)) {
      setErro(`Não cabe: passaria de ${limiteEspaco} de carga.`);
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
        <table className="tabela-ficha">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Peso (un.)</th>
              <th>Qtd.</th>
              <th>Total</th>
              {permiteCarregador && <th>Carregador</th>}
              {editavel && <th></th>}
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    defaultValue={item.nome}
                    disabled={!editavel}
                    onBlur={(e) => e.target.value !== item.nome && salvarCampo(item, 'nome', e.target.value)}
                  />
                </td>
                <td>
                  <input
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
                <td>
                  <input
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
                <td className="detalhe-secundario">{pesoTotal(item)}</td>
                {permiteCarregador && (
                  <td>
                    <select
                      defaultValue={item.tipo_carregador || ''}
                      disabled={!editavel}
                      onChange={(e) => salvarCampo(item, 'tipo_carregador', e.target.value || null)}
                    >
                      <option value="">—</option>
                      <option value="coldre">Coldre (+36 leve)</option>
                      <option value="bandoleira">Bandoleira (+24 pesada)</option>
                    </select>
                  </td>
                )}
                {editavel && (
                  <td>
                    <button type="button" className="botao-remover" onClick={() => remover(item)}>
                      Remover
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={editavel ? 6 : 5} className="detalhe-secundario">
                  Nenhum item ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="detalhe-secundario">
        Carga usada: {espacoUsado} / {limiteEspaco}
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