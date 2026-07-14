import { useState } from 'react';
import { criarArma, atualizarArma, removerArma } from '../../lib/dados.js';
import { validarMeioTransporte, LIMITE_BANDOLEIRA, LIMITE_COLDRE_MAIS_BANDOLEIRA } from '../../lib/regras.js';

// Tabela de Armas (13/07 — revisado 3x). `meio_transporte` (coldre/
// bandoleira/bainha) decide de qual pool a arma recarrega — limites em
// src/lib/regras.js (validarMeioTransporte). O <select> de transporte é
// controlado (`value`), não `defaultValue`: se a escolha for rejeitada
// (cheio), ele volta sozinho pro valor de antes em vez de "ficar preso"
// mostrando a opção que não foi salva.
//
// Munição: `−1` (consome, não mexe no pool — bala já estava na arma,
// foi usada), `+1` (puxa 1 bala do pool certo pra arma, sem precisar
// encher tudo) e "Recarregar" (enche até o máximo) ficam sempre
// visíveis lado a lado — só desabilitam quando não fazem sentido (arma
// já cheia, ou pool sem bala). Antes o layout trocava entre "só −1" e
// "só Recarregar" dependendo do estado, o que deixava a linha
// desalinhada (mudava de tamanho); agora é sempre o mesmo conjunto de
// botões, só ativo/inativo.
export default function TabelaArmas({ personagemId, armas, onMudar, editavel, onRecarregar, poolLeve, poolPesada }) {
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

  function salvarMeioTransporte(arma, novoMeio) {
    const problema = validarMeioTransporte(armas, arma.id, novoMeio);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro('');
    salvarCampo(arma, 'meio_transporte', novoMeio || null);
  }

  function decrementarMunicao(arma) {
    const novo = Math.max(0, (arma.municao_atual ?? 0) - 1);
    if (novo !== arma.municao_atual) salvarCampo(arma, 'municao_atual', novo);
  }

  // Usado tanto pelo "+1" (quantidade=1) quanto pelo "Recarregar"
  // (quantidade omitida = enche até o máximo). Os dois puxam do mesmo
  // pool (leve/pesada, conforme meio_transporte) via onRecarregar
  // (Personagem.jsx), que persiste a arma E o pool numa tacada.
  async function executarRecarga(arma, quantidade) {
    setErro('');
    setRecarregando(arma.id);
    const resultado = await onRecarregar(arma, quantidade);
    setRecarregando(null);
    if (!resultado) return;
    onMudar(armas.map((a) => (a.id === arma.id ? { ...a, municao_atual: resultado.municaoAtual } : a)));
  }

  async function remover(arma) {
    if (!window.confirm(`Remover "${arma.nome || 'esta arma'}"?`)) return;
    const { error } = await removerArma(arma.id);
    if (error) setErro(error.message);
    else onMudar(armas.filter((a) => a.id !== arma.id));
  }

  return (
    <div className="bloco-tabela">
      {erro && <p className="erro">{erro}</p>}
      <div className="tabela-scroll">
        <table className="tabela-ficha tabela-armas">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Peso</th>
              <th>Dano</th>
              <th>Tipo</th>
              <th>Transporte</th>
              <th>Mun. máx.</th>
              <th>Mun. atual</th>
              {editavel && <th></th>}
            </tr>
          </thead>
          <tbody>
            {armas.map((arma) => {
              const temMunicao = arma.meio_transporte === 'coldre' || arma.meio_transporte === 'bandoleira';
              const pool = arma.meio_transporte === 'coldre' ? poolLeve : poolPesada;
              const atual = arma.municao_atual ?? 0;
              const max = arma.municao_max ?? 0;
              const armaCheia = atual >= max;
              const semMunicaoPraTirar = atual <= 0;
              const semMunicaoPraPor = armaCheia || (pool ?? 0) <= 0;

              return (
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
                      value={arma.tipo_dano || ''}
                      disabled={!editavel}
                      onChange={(e) => salvarCampo(arma, 'tipo_dano', e.target.value || null)}
                    >
                      <option value="">—</option>
                      <option value="dor">Dor</option>
                      <option value="vida">Vida</option>
                    </select>
                  </td>
                  <td>
                    <select
                      value={arma.meio_transporte || ''}
                      disabled={!editavel}
                      onChange={(e) => salvarMeioTransporte(arma, e.target.value)}
                    >
                      <option value="">—</option>
                      <option value="coldre">Coldre (leve)</option>
                      <option value="bandoleira">Bandoleira (pesada)</option>
                      <option value="bainha">Bainha</option>
                    </select>
                  </td>
                  <td>
                    {temMunicao ? (
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
                    ) : (
                      <span className="detalhe-secundario">—</span>
                    )}
                  </td>
                  <td className="municao-celula">
                    {temMunicao ? (
                      <>
                        <button
                          type="button"
                          className="botao-ajuste-pequeno"
                          disabled={!editavel || semMunicaoPraTirar}
                          onClick={() => decrementarMunicao(arma)}
                          title="Usar 1 bala (não devolve pro pool)"
                        >
                          −1
                        </button>
                        <strong className="status-valor">
                          {atual}/{max}
                        </strong>
                        <button
                          type="button"
                          className="botao-ajuste-pequeno"
                          disabled={!editavel || semMunicaoPraPor || recarregando === arma.id}
                          onClick={() => executarRecarga(arma, 1)}
                          title="Pôr 1 bala do pool na arma"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          className="botao-recarregar"
                          disabled={!editavel || semMunicaoPraPor || recarregando === arma.id}
                          onClick={() => executarRecarga(arma, undefined)}
                          title="Encher até o máximo com o pool disponível"
                        >
                          {recarregando === arma.id ? '...' : 'Recarregar'}
                        </button>
                      </>
                    ) : (
                      <span className="detalhe-secundario">—</span>
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
              );
            })}
            {armas.length === 0 && (
              <tr>
                <td colSpan={editavel ? 8 : 7} className="detalhe-secundario">
                  Nenhuma arma ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="detalhe-secundario">
        Transporte: até {LIMITE_COLDRE_MAIS_BANDOLEIRA} armas somando Coldre + Bandoleira (Bandoleira até{' '}
        {LIMITE_BANDOLEIRA}), e 1 na Bainha. "−1" consome (não devolve ao pool); "+1" e "Recarregar" puxam do pool
        certo (leve/pesada).
      </p>
      {editavel && (
        <button type="button" onClick={adicionar} disabled={adicionando}>
          {adicionando ? 'Adicionando...' : '+ Adicionar arma'}
        </button>
      )}
    </div>
  );
}