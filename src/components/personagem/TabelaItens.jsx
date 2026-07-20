import { Fragment, useState } from 'react';
import { atualizarItem, removerItem } from '../../lib/dados.js';
import UploadFoto from '../UploadFoto.jsx';
import PopupConfirmar from '../PopupConfirmar.jsx';
import IconeCategoria, { OPCOES_CATEGORIA } from '../IconeCategoria.jsx';

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
//
// Foto por item (13/07, opcional): só aparece quando `personagemId` é
// passado — ou seja, só nos itens do PRÓPRIO personagem. Itens da
// montaria (chamados sem essa prop, ver Montaria.jsx) não têm coluna de
// foto — o Storage (migration 0009) só sabe validar dono por
// personagem, não por montaria, e não parecia valer a complexidade
// extra pra foto de item de cavalo.
export default function TabelaItens({
  itens,
  onMudar,
  editavel,
  limiteEspaco,
  pesoAdicional = 0,
  onAdicionar,
  onExcluirTodos,
  personagemId,
}) {
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState('');
  const [tentativas, setTentativas] = useState({});
  const [itemParaRemover, setItemParaRemover] = useState(null);
  const [confirmandoExcluirTodos, setConfirmandoExcluirTodos] = useState(false);
  const [busca, setBusca] = useState('');
  const [protecaoExpandida, setProtecaoExpandida] = useState(() => new Set());

  function alternarProtecao(itemId) {
    setProtecaoExpandida((atual) => {
      const novo = new Set(atual);
      if (novo.has(itemId)) novo.delete(itemId);
      else novo.add(itemId);
      return novo;
    });
  }

  // Filtra só pra EXIBIÇÃO — carga usada e limite continuam somando
  // TODOS os itens (filtrar a lista visível não pode mudar o peso
  // usado, senão a busca "faz sumir" carga real da conta).
  const itensExibidos = busca.trim()
    ? itens.filter((i) => (i.nome || '').toLowerCase().includes(busca.trim().toLowerCase()))
    : itens;

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
    setConfirmandoExcluirTodos(false);
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

  async function remover() {
    const item = itemParaRemover;
    setItemParaRemover(null);
    const { error } = await removerItem(item.id);
    if (error) setErro(error.message);
    else onMudar(itens.filter((i) => i.id !== item.id));
  }

  // Proteção (13/07) — cada uso reduzindo dano custa 1 do limite (não
  // do valor de redução); ao chegar em 0, quebra e para de reduzir até
  // ser "consertada" (ajustar o limite atual de volta pra cima
  // manualmente, já que o app não modela conserto como uma ação à
  // parte).
  function usarProtecao(item) {
    const novo = Math.max(0, Number(item.limite_dano_atual ?? 0) - 1);
    salvarCampo(item, 'limite_dano_atual', novo);
  }

  return (
    <div className="bloco-tabela">
      {erro && <p className="erro">{erro}</p>}
      {itens.length > 3 && (
        <input
          type="search"
          className="campo-busca-itens"
          placeholder="Buscar item..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      )}
      <div className="tabela-scroll">
        <table className="tabela-ficha tabela-responsiva">
          <thead>
            <tr>
              {personagemId && <th>Foto</th>}
              <th>Nome</th>
              <th>Peso (un.)</th>
              <th>Qtd.</th>
              <th>Total</th>
              <th></th>
              {editavel && <th></th>}
            </tr>
          </thead>
          <tbody>
            {itensExibidos.map((item) => {
              const temProtecao = Number(item.limite_dano_max ?? 0) > 0;
              const quebrada = temProtecao && Number(item.limite_dano_atual ?? 0) <= 0;
              return (
                <Fragment key={item.id}>
                  <tr>
                    {personagemId && (
                      <td data-label="Foto">
                        <UploadFoto
                          caminho={`personagem/${personagemId}/item-${item.id}`}
                          fotoAtual={item.foto_url}
                          editavel={editavel}
                          variante="pequena"
                          alt={item.nome || 'Item'}
                          onSalvar={(url) => salvarCampo(item, 'foto_url', url)}
                        />
                      </td>
                    )}
                    <td data-label="Nome">
                      <div className="nome-com-categoria">
                        <IconeCategoria categoria={item.categoria} />
                        {editavel && (
                          <select
                            className="seletor-categoria"
                            value={item.categoria || 'outro'}
                            onChange={(e) => salvarCampo(item, 'categoria', e.target.value)}
                            aria-label="Categoria do item"
                          >
                            {OPCOES_CATEGORIA.map((o) => (
                              <option key={o.valor} value={o.valor}>
                                {o.titulo}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          defaultValue={item.nome}
                          disabled={!editavel}
                          onBlur={(e) => e.target.value !== item.nome && salvarCampo(item, 'nome', e.target.value)}
                        />
                      </div>
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
                    <td data-label="">
                      <button
                        type="button"
                        className="botao-detalhes-toggle"
                        onClick={() => alternarProtecao(item.id)}
                        aria-expanded={protecaoExpandida.has(item.id)}
                      >
                        {temProtecao ? (quebrada ? 'Proteção (quebrada)' : `Proteção ▾`) : 'Proteção ▾'}
                      </button>
                    </td>
                    {editavel && (
                      <td data-label="">
                        <button type="button" className="botao-remover" onClick={() => setItemParaRemover(item)}>
                          Remover
                        </button>
                      </td>
                    )}
                  </tr>
                  {protecaoExpandida.has(item.id) && (
                    <tr className="linha-detalhes-arma">
                      <td colSpan={(personagemId ? 1 : 0) + (editavel ? 6 : 5)} data-label="">
                        <div className="detalhes-arma-grade">
                          <label>
                            Redução de dano
                            <input
                              type="number"
                              min="0"
                              defaultValue={item.reducao_dano ?? 0}
                              disabled={!editavel}
                              onBlur={(e) => {
                                const novo = Math.max(0, Number(e.target.value) || 0);
                                if (novo !== Number(item.reducao_dano ?? 0)) salvarCampo(item, 'reducao_dano', novo);
                              }}
                            />
                          </label>
                          <label>
                            Limite máx.
                            <input
                              type="number"
                              min="0"
                              defaultValue={item.limite_dano_max ?? 0}
                              disabled={!editavel}
                              onBlur={(e) => {
                                const novo = Math.max(0, Number(e.target.value) || 0);
                                if (novo !== Number(item.limite_dano_max ?? 0)) {
                                  salvarCampo(item, 'limite_dano_max', novo);
                                  if (Number(item.limite_dano_atual ?? 0) > novo) salvarCampo(item, 'limite_dano_atual', novo);
                                }
                              }}
                            />
                          </label>
                          {temProtecao && (
                            <div className="protecao-limite-atual">
                              <span>
                                Limite atual: <strong>{item.limite_dano_atual ?? 0}</strong>/{item.limite_dano_max}
                                {quebrada && <span className="badge-caido"> Quebrada</span>}
                              </span>
                              {editavel && (
                                <span>
                                  <button
                                    type="button"
                                    className="botao-ajuste-pequeno"
                                    disabled={Number(item.limite_dano_atual ?? 0) <= 0}
                                    onClick={() => usarProtecao(item)}
                                    title="Usou a proteção pra reduzir um golpe — gasta 1 do limite"
                                  >
                                    −1
                                  </button>
                                  <button
                                    type="button"
                                    className="botao-secundario"
                                    onClick={() => salvarCampo(item, 'limite_dano_atual', item.limite_dano_max)}
                                  >
                                    Consertar (encher)
                                  </button>
                                </span>
                              )}
                            </div>
                          )}
                          <p className="detalhe-secundario">
                            Reduz o dano recebido em {item.reducao_dano ?? 0}, mas não aumenta a Defesa. Cada uso gasta
                            1 do limite (não do valor de redução); ao zerar, quebra até ser consertada.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {itens.length === 0 && (
              <tr>
                <td colSpan={(personagemId ? 1 : 0) + (editavel ? 6 : 5)} className="detalhe-secundario">
                  Nenhum item ainda.
                </td>
              </tr>
            )}
            {itens.length > 0 && itensExibidos.length === 0 && (
              <tr>
                <td colSpan={(personagemId ? 1 : 0) + (editavel ? 6 : 5)} className="detalhe-secundario">
                  Nenhum item bate com "{busca}".
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
            <button type="button" className="botao-remover" onClick={() => setConfirmandoExcluirTodos(true)}>
              Excluir todos
            </button>
          )}
        </div>
      )}

      <PopupConfirmar
        aberto={Boolean(itemParaRemover)}
        mensagem={`Remover "${itemParaRemover?.nome || 'este item'}"?`}
        onConfirmar={remover}
        onCancelar={() => setItemParaRemover(null)}
      />
      <PopupConfirmar
        aberto={confirmandoExcluirTodos}
        mensagem={`Excluir todos os ${itens.length} itens?`}
        textoConfirmar="Excluir todos"
        onConfirmar={excluirTodos}
        onCancelar={() => setConfirmandoExcluirTodos(false)}
      />
    </div>
  );
}