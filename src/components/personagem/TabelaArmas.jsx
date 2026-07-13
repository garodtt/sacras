import { useState } from 'react';
import { criarArma, atualizarArma, removerArma } from '../../lib/dados.js';

// Tabela de Armas. `categoria` (leve/pesada) decide de qual pool a arma
// recarrega — leve puxa do coldre, pesada da bandoleira (13/07). A
// conta de recarga em si mora em src/lib/regras.js (aplicarRecarga);
// aqui só chamamos `onRecarregar`, que o componente pai (Personagem.jsx)
// implementa — ele que sabe o pool atual e como persistir os dois lados
// (a arma e o personagem) numa tacada.
export default function TabelaArmas({ personagemId, armas, onMudar, editavel, onRecarregar }) {
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState('');
  const [recarregando, setRecarregando] = useState(null);

  async function adicionar() {
    setErro('');
    setAdicionando(true);
    const { data, error } = await criarArma(personagemId, armas.length);
    setAdicionando(false);

    if (error) setErro(error.message);
    else onMudar([...armas, data]);
  }

  async function salvarCampo(arma, campo, valor) {
    const { data, error } = await atualizarArma(arma.id, { [campo]: valor });
    if (error) setErro(error.message);
    else onMudar(armas.map((a) => (a.id === arma.id ? data : a)));
  }

  async function remover(arma) {
    if (!window.confirm(`Remover "${arma.nome || 'esta arma'}"?`)) return;
    const { error } = await removerArma(arma.id);
    if (error) setErro(error.message);
    else onMudar(armas.filter((a) => a.id !== arma.id));
  }

  async function recarregar(arma) {
    if (!arma.categoria) {
      setErro(`Defina a categoria (leve/pesada) de "${arma.nome || 'arma'}" antes de recarregar.`);
      return;
    }
    setErro('');
    setRecarregando(arma.id);
    const resultado = await onRecarregar(arma);
    setRecarregando(null);
    if (!resultado) return;
    onMudar(armas.map((a) => (a.id === arma.id ? { ...a, municao_atual: resultado.municaoAtual } : a)));
  }

  return (
    <div className="bloco-tabela">
      {erro && <p className="erro">{erro}</p>}
      <div className="tabela-scroll">
        <table className="tabela-ficha">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Peso</th>
              <th>Dano</th>
              <th>Categoria</th>
              <th>Munição</th>
              {editavel && <th></th>}
            </tr>
          </thead>
          <tbody>
            {armas.map((arma) => (
              <tr key={arma.id}>
                <td>
                  <input
                    defaultValue={arma.nome}
                    disabled={!editavel}
                    onBlur={(e) => e.target.value !== arma.nome && salvarCampo(arma, 'nome', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    defaultValue={arma.espaco}
                    disabled={!editavel}
                    onBlur={(e) => {
                      const novo = Number(e.target.value) || 0;
                      if (novo !== Number(arma.espaco)) salvarCampo(arma, 'espaco', novo);
                    }}
                  />
                </td>
                <td>
                  <input
                    defaultValue={arma.dano}
                    placeholder="ex.: 1d6+2"
                    disabled={!editavel}
                    onBlur={(e) => e.target.value !== arma.dano && salvarCampo(arma, 'dano', e.target.value)}
                  />
                </td>
                <td>
                  <select
                    defaultValue={arma.categoria || ''}
                    disabled={!editavel}
                    onChange={(e) => salvarCampo(arma, 'categoria', e.target.value || null)}
                  >
                    <option value="">—</option>
                    <option value="leve">Leve (coldre)</option>
                    <option value="pesada">Pesada (bandoleira)</option>
                  </select>
                </td>
                <td className="municao-celula">
                  <input
                    type="number"
                    min="0"
                    className="municao-atual"
                    defaultValue={arma.municao_atual ?? 0}
                    disabled={!editavel}
                    onBlur={(e) => {
                      const novo = Math.max(0, Number(e.target.value) || 0);
                      if (novo !== Number(arma.municao_atual ?? 0)) salvarCampo(arma, 'municao_atual', novo);
                    }}
                  />
                  <span>/</span>
                  <input
                    type="number"
                    min="0"
                    className="municao-max"
                    defaultValue={arma.municao_max ?? 0}
                    disabled={!editavel}
                    onBlur={(e) => {
                      const novo = Math.max(0, Number(e.target.value) || 0);
                      if (novo !== Number(arma.municao_max ?? 0)) salvarCampo(arma, 'municao_max', novo);
                    }}
                  />
                  {editavel && (
                    <button
                      type="button"
                      onClick={() => recarregar(arma)}
                      disabled={recarregando === arma.id}
                    >
                      {recarregando === arma.id ? '...' : 'Recarregar'}
                    </button>
                  )}
                </td>
                {editavel && (
                  <td>
                    <button type="button" className="botao-remover" onClick={() => remover(arma)}>
                      Remover
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {armas.length === 0 && (
              <tr>
                <td colSpan={editavel ? 6 : 5} className="detalhe-secundario">
                  Nenhuma arma ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editavel && (
        <button type="button" onClick={adicionar} disabled={adicionando}>
          {adicionando ? 'Adicionando...' : '+ Adicionar arma'}
        </button>
      )}
    </div>
  );
}