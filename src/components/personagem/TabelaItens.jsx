import { Fragment, useState } from 'react';
import {
  atualizarItem,
  removerItem,
  removerItensEmLote,
  moverItensParaMontaria,
  transferirItensParaPersonagem,
  buscarPersonagem,
  listarItens,
  buscarMontaria,
} from '../../lib/dados.js';
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
  montaria,
  outrosPersonagens,
}) {
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState('');
  const [tentativas, setTentativas] = useState({});
  const [itemParaRemover, setItemParaRemover] = useState(null);
  const [confirmandoExcluirTodos, setConfirmandoExcluirTodos] = useState(false);
  const [busca, setBusca] = useState('');
  const [protecaoExpandida, setProtecaoExpandida] = useState(() => new Set());

  const [selecionados, setSelecionados] = useState(() => new Set());
  const [confirmandoExcluirLote, setConfirmandoExcluirLote] = useState(false);
  const [montariaAberta, setMontariaAberta] = useState(false);
  const [localEscolhido, setLocalEscolhido] = useState('bolsa');
  const [jogadorAberto, setJogadorAberto] = useState(false);
  const [personagemDestino, setPersonagemDestino] = useState('');
  const [avisoTransferencia, setAvisoTransferencia] = useState(null);
  const [processandoLote, setProcessandoLote] = useState(false);

  function alternarSelecionado(itemId) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(itemId)) novo.delete(itemId);
      else novo.add(itemId);
      return novo;
    });
  }

  function alternarSelecionarTodos() {
    setSelecionados((atual) => (atual.size === itensExibidos.length ? new Set() : new Set(itensExibidos.map((i) => i.id))));
  }

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

  // Ações em lote (13/07) — mesmo padrão do "Dano em área"/remoção em
  // lote de vínculos: seleciona vários, aplica uma vez.
  async function excluirLote() {
    setConfirmandoExcluirLote(false);
    setProcessandoLote(true);
    const ids = [...selecionados];
    const { error } = await removerItensEmLote(ids);
    setProcessandoLote(false);
    if (error) setErro(error.message);
    else {
      onMudar(itens.filter((i) => !selecionados.has(i.id)));
      setSelecionados(new Set());
    }
  }

  async function transferirParaMontaria() {
    if (!montaria) return;
    setProcessandoLote(true);
    const ids = [...selecionados];
    const { error } = await moverItensParaMontaria(ids, montaria.id, localEscolhido);
    setProcessandoLote(false);
    if (error) setErro(error.message);
    else {
      // Saem da mochila do personagem (mudaram de dono) — some da
      // lista atual, igual "excluir" pra essa tela específica.
      onMudar(itens.filter((i) => !selecionados.has(i.id)));
      setSelecionados(new Set());
      setMontariaAberta(false);
    }
  }

  // Transferir pra outro personagem (13/07) — confere o peso do
  // DESTINATÁRIO antes de mover (mesmo espírito do aviso de peso da
  // aba Compras): se estourar a mochila dele, oferece colocar na
  // montaria DELE em vez de bloquear, ou cancelar.
  async function tentarTransferirParaJogador() {
    if (!personagemDestino) return;
    setErro('');
    setProcessandoLote(true);

    const [resPersonagem, resItensDestino, resMontariaDestino] = await Promise.all([
      buscarPersonagem(personagemDestino),
      listarItens(personagemDestino),
      buscarMontaria(personagemDestino),
    ]);
    setProcessandoLote(false);

    if (resPersonagem.error) {
      setErro(resPersonagem.error.message);
      return;
    }

    const itensSelecionados = itens.filter((i) => selecionados.has(i.id));
    const pesoTransferido = itensSelecionados.reduce((s, i) => s + Number(i.espaco ?? 0) * Number(i.quantidade ?? 1), 0);
    const pesoDestinoAtual = (resItensDestino.data ?? []).reduce((s, i) => s + Number(i.espaco ?? 0) * Number(i.quantidade ?? 1), 0);
    const excedente = pesoDestinoAtual + pesoTransferido - Number(resPersonagem.data?.espaco_max ?? 0);

    if (excedente > 0) {
      setAvisoTransferencia({
        excedente,
        nomeDestino: resPersonagem.data?.nome || '(sem nome)',
        montariaDestino: resMontariaDestino.data ?? null,
      });
      return;
    }

    finalizarTransferenciaJogador(false);
  }

  async function finalizarTransferenciaJogador(paraMontariaDestino) {
    setProcessandoLote(true);
    setAvisoTransferencia(null);
    const ids = [...selecionados];

    let error;
    if (paraMontariaDestino && avisoTransferencia?.montariaDestino) {
      ({ error } = await moverItensParaMontaria(ids, avisoTransferencia.montariaDestino.id, 'bolsa'));
    } else {
      ({ error } = await transferirItensParaPersonagem(ids, personagemDestino));
    }

    setProcessandoLote(false);
    if (error) setErro(error.message);
    else {
      onMudar(itens.filter((i) => !selecionados.has(i.id)));
      setSelecionados(new Set());
      setJogadorAberto(false);
      setPersonagemDestino('');
    }
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
      {selecionados.size > 0 && (
        <div className="barra-acoes-lote">
          <span><strong>{selecionados.size}</strong> selecionado(s)</span>
          <button type="button" className="botao-remover" onClick={() => setConfirmandoExcluirLote(true)}>
            Excluir
          </button>
          {montaria && (
            <button type="button" onClick={() => setMontariaAberta(true)}>
              Transferir pra montaria
            </button>
          )}
          {outrosPersonagens && outrosPersonagens.length > 0 && (
            <button type="button" onClick={() => setJogadorAberto(true)}>
              Transferir pra outro jogador
            </button>
          )}
          <button type="button" className="botao-secundario" onClick={() => setSelecionados(new Set())}>
            Cancelar seleção
          </button>
        </div>
      )}
      <div className="tabela-scroll">
        <table className="tabela-ficha tabela-responsiva">
          <thead>
            <tr>
              {editavel && (
                <th>
                  <input
                    type="checkbox"
                    checked={itensExibidos.length > 0 && selecionados.size === itensExibidos.length}
                    onChange={alternarSelecionarTodos}
                    aria-label="Selecionar todos"
                  />
                </th>
              )}
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
                    {editavel && (
                      <td data-label="">
                        <input
                          type="checkbox"
                          checked={selecionados.has(item.id)}
                          onChange={() => alternarSelecionado(item.id)}
                          aria-label={`Selecionar ${item.nome}`}
                        />
                      </td>
                    )}
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
                      <td colSpan={(personagemId ? 1 : 0) + (editavel ? 7 : 5)} data-label="">
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
                <td colSpan={(personagemId ? 1 : 0) + (editavel ? 7 : 5)} className="detalhe-secundario">
                  Nenhum item ainda.
                </td>
              </tr>
            )}
            {itens.length > 0 && itensExibidos.length === 0 && (
              <tr>
                <td colSpan={(personagemId ? 1 : 0) + (editavel ? 7 : 5)} className="detalhe-secundario">
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
      <PopupConfirmar
        aberto={confirmandoExcluirLote}
        mensagem={`Excluir ${selecionados.size} item(ns) selecionado(s)?`}
        textoConfirmar={processandoLote ? 'Excluindo...' : 'Excluir'}
        onConfirmar={excluirLote}
        onCancelar={() => setConfirmandoExcluirLote(false)}
      />

      {montariaAberta && (
        <div className="popup-fundo" onClick={() => setMontariaAberta(false)}>
          <div className="popup-caixa" onClick={(e) => e.stopPropagation()}>
            <h3>Transferir pra montaria</h3>
            <label className="campo-editavel-rotulo">
              Guardar em
              <select value={localEscolhido} onChange={(e) => setLocalEscolhido(e.target.value)}>
                <option value="cavalo">Cavalo</option>
                <option value="bolsa">Bolsa de Montaria</option>
                <option value="carro">Carro</option>
                <option value="carroca">Carroça</option>
              </select>
            </label>
            <div className="popup-acoes">
              <button type="button" onClick={transferirParaMontaria} disabled={processandoLote}>
                {processandoLote ? 'Transferindo...' : `Transferir ${selecionados.size}`}
              </button>
              <button type="button" className="botao-secundario" onClick={() => setMontariaAberta(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {jogadorAberto && (
        <div className="popup-fundo" onClick={() => setJogadorAberto(false)}>
          <div className="popup-caixa" onClick={(e) => e.stopPropagation()}>
            <h3>Transferir pra outro jogador</h3>
            <label className="campo-editavel-rotulo">
              Personagem de destino
              <select value={personagemDestino} onChange={(e) => setPersonagemDestino(e.target.value)}>
                <option value="">Selecione...</option>
                {(outrosPersonagens ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.nome || '(sem nome)'}</option>
                ))}
              </select>
            </label>
            <div className="popup-acoes">
              <button type="button" onClick={tentarTransferirParaJogador} disabled={!personagemDestino || processandoLote}>
                {processandoLote ? 'Verificando...' : `Transferir ${selecionados.size}`}
              </button>
              <button type="button" className="botao-secundario" onClick={() => setJogadorAberto(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {avisoTransferencia && (
        <div className="popup-fundo" onClick={() => setAvisoTransferencia(null)}>
          <div className="popup-caixa" onClick={(e) => e.stopPropagation()}>
            <h3>Peso excedido</h3>
            <p>
              Essa transferência passa <strong>{avisoTransferencia.excedente.toFixed(2)} espaços</strong> do limite
              da mochila de {avisoTransferencia.nomeDestino}.
            </p>
            {avisoTransferencia.montariaDestino ? (
              <p className="detalhe-secundario">
                Dá pra colocar na montaria de {avisoTransferencia.nomeDestino} em vez da mochila dele(a), ou cancelar.
              </p>
            ) : (
              <p className="detalhe-secundario">
                {avisoTransferencia.nomeDestino} não tem montaria cadastrada — a opção é cancelar e escolher menos
                itens.
              </p>
            )}
            <div className="popup-acoes">
              {avisoTransferencia.montariaDestino && (
                <button type="button" onClick={() => finalizarTransferenciaJogador(true)} disabled={processandoLote}>
                  Colocar na montaria dele(a)
                </button>
              )}
              <button type="button" className="botao-secundario" onClick={() => setAvisoTransferencia(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}