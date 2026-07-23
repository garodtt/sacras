import { useState } from 'react';
import { CATALOGO_COMPRAS, CATEGORIAS_COMPRAS, precoMedio } from '../../lib/catalogoCompras.js';
import {
  calcularCapacidadeMunicaoDeArmas,
  calcularPesoMunicaoExcedente,
  validarMeioTransporte,
} from '../../lib/regras.js';
import { criarArma, criarItem, criarItemMontaria, atualizarItem, atualizarPersonagem } from '../../lib/dados.js';
import { mostrarToast } from '../../lib/toastBus.js';

// Aba Compras (13/07) — catálogo completo do livro (Grande Catálogo de
// Equipamento) com carrinho, desconto e conclusão de compra que:
//  1. desconta o dinheiro do personagem;
//  2. arma que couber num coldre/bandoleira/bainha livre vira arma de
//     verdade JÁ EQUIPADA; se não couber, vira item comum na mochila
//     (mesma regra que já existia pra editar arma na aba Combate);
//  3. munição entra direto no pool (municao_leve_atual/pesada_atual),
//     não como item;
//  4. tudo mais vira item comum;
//  5. se estourar o peso da mochila, avisa quanto estourou e oferece
//     colocar os itens novos na montaria (se houver) em vez de bloquear
//     — dinheiro insuficiente, por outro lado, bloqueia mesmo (não tem
//     "colocar a dívida no cavalo").
//
// Não mexe em RLS/schema novo — só reaproveita criarArma/criarItem/
// atualizarPersonagem que já existem.
// Mapeia a categoria do catálogo de compras pra categoria de item da
// ficha (usada só pro ícone na tabela de Itens — migration 0018). Nem
// toda categoria do catálogo tem um ícone equivalente (acessório,
// proteção) — essas caem em "outro" de propósito.
const CATEGORIA_ITEM_POR_CATEGORIA_CATALOGO = {
  arma_fogo: 'arma_branca',
  arma_branca: 'arma_branca',
  comida: 'comida',
  roupa: 'roupa',
  ferramenta: 'ferramenta',
  protecao: 'outro',
  acessorio: 'outro',
};

function categoriaItemPara(catalogoItem) {
  return CATEGORIA_ITEM_POR_CATEGORIA_CATALOGO[catalogoItem.categoria] ?? 'outro';
}

// Peso fixo (13/07) de uma arma que NÃO coube no slot — não é o
// "espaço de catálogo" da arma, é o peso padrão do tipo de guarnição
// que ela ocuparia: bandoleira pesa 1, coldre e bainha pesam 0,5.
// Arma sem meioTransporte natural (zarabatana, machado de lenha etc.)
// usa o próprio espaço do catálogo, já que nunca tentaria ser
// equipada de qualquer forma.
const PESO_ARMA_SEM_SLOT = { coldre: 0.5, bandoleira: 1, bainha: 0.5 };

function simularDestinos(carrinho, armasExistentes) {
  const armasVirtuais = armasExistentes.map((a) => ({ id: a.id, meio_transporte: a.meio_transporte }));
  const itensPorChave = new Map(); // consolida por nome+peso — evita criar 2 linhas quando o mesmo item aparece mais de uma vez (ex.: 3 revólveres, 2 cabem e 1 estoura)
  const armasParaCriar = [];
  const municaoParaAdicionar = { leve: 0, pesada: 0 };
  let pesoNovosItens = 0;
  let contadorVirtual = 0;

  function empilharItem(item, quantidade, espacoFinal) {
    const chave = `${item.nome}|${espacoFinal}`;
    const existente = itensPorChave.get(chave);
    if (existente) existente.quantidade += quantidade;
    else itensPorChave.set(chave, { item, quantidade, espacoFinal });
  }

  for (const entrada of carrinho) {
    const { item, quantidade } = entrada;

    if (item.categoria === 'municao') {
      municaoParaAdicionar[item.poolAlvo] += (item.quantidadePorCompra ?? 1) * quantidade;
      continue;
    }

    if (item.categoria === 'arma_fogo' || item.categoria === 'arma_branca') {
      for (let i = 0; i < quantidade; i++) {
        let coube = false;
        if (item.meioTransporte) {
          const idVirtual = `virtual-${contadorVirtual++}`;
          const erro = validarMeioTransporte(armasVirtuais, idVirtual, item.meioTransporte);
          if (!erro) {
            armasVirtuais.push({ id: idVirtual, meio_transporte: item.meioTransporte });
            armasParaCriar.push({ item, meioTransporteFinal: item.meioTransporte });
            coube = true;
          }
        }
        if (!coube) {
          const espacoOverflow = item.meioTransporte ? (PESO_ARMA_SEM_SLOT[item.meioTransporte] ?? item.espaco) : item.espaco;
          empilharItem(item, 1, espacoOverflow);
          pesoNovosItens += espacoOverflow;
        }
      }
      continue;
    }

    empilharItem(item, quantidade, item.espaco);
    pesoNovosItens += item.espaco * quantidade;
  }

  return { itensParaCriar: [...itensPorChave.values()], armasParaCriar, municaoParaAdicionar, pesoNovosItens };
}

// Impacto completo da compra (13/07) — usado tanto pelo indicador ao
// vivo no carrinho quanto pela checagem final antes de gravar, pra
// nunca ter os dois cálculos divergindo entre si.
function calcularImpactoCompra(carrinho, personagem, itens, armas) {
  const resultado = simularDestinos(carrinho, armas);
  const armasApos = [...armas, ...resultado.armasParaCriar.map((a) => ({ meio_transporte: a.meioTransporteFinal }))];
  const capacidadeApos = calcularCapacidadeMunicaoDeArmas(armasApos);
  const pesoMunicaoExcedenteApos = calcularPesoMunicaoExcedente({
    municaoLeveAtual: Number(personagem.municao_leve_atual ?? 0) + resultado.municaoParaAdicionar.leve,
    capacidadeLeve: capacidadeApos.leve,
    municaoPesadaAtual: Number(personagem.municao_pesada_atual ?? 0) + resultado.municaoParaAdicionar.pesada,
    capacidadePesada: capacidadeApos.pesada,
  });

  const pesoItensAtual = itens.reduce((s, i) => s + Number(i.espaco ?? 0) * Number(i.quantidade ?? 1), 0);
  const pesoTotalApos = pesoItensAtual + resultado.pesoNovosItens + pesoMunicaoExcedenteApos;
  const espacoMax = Number(personagem.espaco_max ?? 0);

  return {
    ...resultado,
    pesoItensAtual,
    pesoMunicaoExcedenteApos,
    pesoTotalApos,
    espacoMax,
    excedente: pesoTotalApos - espacoMax,
  };
}

export default function Compras({ personagem, itens, armas, montaria, editavel, onCompraConcluida, itensLoja = [] }) {
  // Adapta o formato da Loja da Campanha (preco único, campos de arma
  // opcionais) pro mesmo formato do Catálogo de Equipamento — assim o
  // carrinho/simulação/compra tratam os dois de forma idêntica, sem
  // duplicar lógica. `precoMin = precoMax = preco` (preço fixo do
  // Mestre, sem faixa de negociação como o catálogo do livro).
  const itensLojaAdaptados = itensLoja.map((item) => ({
    id: `loja-${item.id}`,
    catalogoId: item.catalogo_id ?? null,
    nome: item.nome,
    categoria: item.categoria,
    precoMin: Number(item.preco),
    precoMax: Number(item.preco),
    espaco: Number(item.espaco ?? 0),
    descricao: item.descricao || '',
    balas: item.balas ?? null,
    recarga: null,
    dano: item.dano ?? null,
    tipoDano: null,
    meioTransporte: item.meio_transporte ?? null,
    origemLoja: item.campanha?.nome ?? 'Loja da Campanha',
  }));

  // Personalização (13/07) — item da loja com catalogoId SUBSTITUI o
  // item padrão do catálogo especificamente nesta ficha (não aparece
  // duplicado); só o que NÃO tem catalogoId (100% novo, exclusivo da
  // campanha) aparece na seção separada "Loja: X".
  const personalizacoesPorCatalogoId = new Map(
    itensLojaAdaptados.filter((i) => i.catalogoId).map((i) => [i.catalogoId, i])
  );
  const itensLojaSoNovos = itensLojaAdaptados.filter((i) => !i.catalogoId);
  const catalogoComPersonalizacoes = CATALOGO_COMPRAS.map((item) => personalizacoesPorCatalogoId.get(item.id) ?? item);

  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  const [descontoAberto, setDescontoAberto] = useState(false);
  const [tipoDesconto, setTipoDesconto] = useState('valor');
  const [valorDesconto, setValorDesconto] = useState('');
  const [desconto, setDesconto] = useState(null);
  const [avisoPeso, setAvisoPeso] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  if (!editavel) {
    return <p className="detalhe-secundario">Só o dono da ficha (ou o Mestre) pode fazer compras.</p>;
  }

  const termo = busca.trim().toLowerCase();
  const itensFiltrados = termo ? catalogoComPersonalizacoes.filter((i) => i.nome.toLowerCase().includes(termo)) : catalogoComPersonalizacoes;
  const itensLojaFiltrados = termo ? itensLojaSoNovos.filter((i) => i.nome.toLowerCase().includes(termo)) : itensLojaSoNovos;

  function adicionarAoCarrinho(item) {
    setCarrinho((atual) => {
      const existente = atual.find((e) => e.item.id === item.id);
      if (existente) {
        return atual.map((e) => (e.item.id === item.id ? { ...e, quantidade: e.quantidade + 1 } : e));
      }
      return [...atual, { item, quantidade: 1 }];
    });
  }

  function ajustarQuantidade(itemId, delta) {
    setCarrinho((atual) =>
      atual
        .map((e) => (e.item.id === itemId ? { ...e, quantidade: e.quantidade + delta } : e))
        .filter((e) => e.quantidade > 0)
    );
  }

  function removerDoCarrinho(itemId) {
    setCarrinho((atual) => atual.filter((e) => e.item.id !== itemId));
  }

  const subtotal = carrinho.reduce((soma, e) => {
    const preco = precoMedio(e.item);
    return soma + (preco ?? 0) * e.quantidade;
  }, 0);

  const totalFinal = desconto ? (desconto.tipo === 'presente' ? 0 : desconto.valor) : subtotal;

  // Indicador de peso ao vivo (13/07) — mesma função usada na hora de
  // concluir a compra, só que recalculada a cada render pra refletir o
  // carrinho atual, sem precisar clicar em "Concluir compra" pra saber
  // se vai estourar.
  const impactoAoVivo = calcularImpactoCompra(carrinho, personagem, itens, armas);

  function aplicarDesconto(e) {
    e.preventDefault();
    if (tipoDesconto === 'presente') {
      setDesconto({ tipo: 'presente' });
    } else {
      const valor = Number(valorDesconto);
      if (Number.isNaN(valor) || valor < 0) return;
      setDesconto({ tipo: 'valor', valor });
    }
    setDescontoAberto(false);
  }

  function removerDesconto() {
    setDesconto(null);
    setValorDesconto('');
  }

  // Passo 1: confere dinheiro e simula a compra pra saber se estoura o
  // peso ANTES de mexer em qualquer coisa no banco.
  function tentarConcluirCompra() {
    setErro('');
    if (carrinho.length === 0) return;

    if (totalFinal > Number(personagem.dinheiro ?? 0)) {
      setErro(`Dinheiro insuficiente — faltam $${(totalFinal - Number(personagem.dinheiro ?? 0)).toFixed(2)}.`);
      return;
    }

    const impacto = calcularImpactoCompra(carrinho, personagem, itens, armas);

    if (impacto.excedente > 0) {
      setAvisoPeso(impacto);
      return;
    }

    finalizarCompra({ ...impacto, colocarNaMontaria: false });
  }

  async function finalizarCompra({ itensParaCriar, armasParaCriar, municaoParaAdicionar, colocarNaMontaria }) {
    setProcessando(true);
    setErro('');
    setAvisoPeso(null);

    try {
      let ordemArma = armas.length;
      for (const { item, meioTransporteFinal } of armasParaCriar) {
        const { error } = await criarArma(personagem.id, ordemArma++, {
          nome: item.nome,
          espaco: item.espaco,
          dano: item.dano ?? '',
          tipo_dano: item.tipoDano,
          municao_atual: item.balas ?? null,
          municao_max: item.balas ?? null,
          meio_transporte: meioTransporteFinal,
        });
        if (error) throw error;
      }

      let ordemItem = itens.length;
      for (const { item, quantidade, espacoFinal } of itensParaCriar) {
        // Vai pra montaria de verdade (mount_id, não personagem_id) —
        // sem isso, o item continuava contando contra a mochila do
        // PERSONAGEM mesmo escolhendo "colocar na montaria", já que
        // `items_dono_unico` exige um dos dois, nunca os dois juntos
        // com uma tag solta.
        if (colocarNaMontaria && montaria) {
          const { error } = await criarItemMontaria(montaria.id, 0, 'bolsa', {
            nome: item.nome,
            espaco: espacoFinal,
            quantidade,
            categoria: categoriaItemPara(item),
            ...(item.categoria === 'protecao'
              ? { reducao_dano: item.reducaoDano ?? 0, limite_dano_max: item.limiteDano ?? 0, limite_dano_atual: item.limiteDano ?? 0 }
              : {}),
          });
          if (error) throw error;
          continue;
        }

        // Já tem uma linha igual (mesmo nome e peso) no inventário?
        // Soma nela em vez de criar uma linha nova — sem isso, comprar
        // mais de algo que você já tem parecia "não fazer nada" (a
        // linha existente continuava com o número antigo, e a nova
        // linha ficava escondida lá embaixo da lista).
        const existente = itens.find((i) => i.nome === item.nome && Number(i.espaco) === espacoFinal);
        if (existente) {
          const { error } = await atualizarItem(existente.id, {
            quantidade: Number(existente.quantidade ?? 1) + quantidade,
          });
          if (error) throw error;
          continue;
        }

        const { error } = await criarItem(personagem.id, ordemItem++, {
          nome: item.nome,
          espaco: espacoFinal,
          quantidade,
          categoria: categoriaItemPara(item),
          ...(item.categoria === 'protecao'
            ? { reducao_dano: item.reducaoDano ?? 0, limite_dano_max: item.limiteDano ?? 0, limite_dano_atual: item.limiteDano ?? 0 }
            : {}),
        });
        if (error) throw error;
      }

      const { error: erroPersonagem } = await atualizarPersonagem(personagem.id, {
        dinheiro: Number(personagem.dinheiro ?? 0) - totalFinal,
        municao_leve_atual: Number(personagem.municao_leve_atual ?? 0) + municaoParaAdicionar.leve,
        municao_pesada_atual: Number(personagem.municao_pesada_atual ?? 0) + municaoParaAdicionar.pesada,
      });
      if (erroPersonagem) throw erroPersonagem;

      mostrarToast('Compra concluída!');
      setCarrinho([]);
      setDesconto(null);
      onCompraConcluida();
    } catch (e) {
      setErro(e.message ?? 'Erro ao concluir a compra.');
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="aba-compras">
      {erro && <p className="erro">{erro}</p>}

      <div className="compras-layout">
        <div className="compras-catalogo">
          <input
            type="search"
            className="campo-busca-itens"
            placeholder="Buscar item pelo nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          {itensLojaFiltrados.length > 0 &&
            Object.entries(
              itensLojaFiltrados.reduce((porLoja, item) => {
                (porLoja[item.origemLoja] ??= []).push(item);
                return porLoja;
              }, {})
            ).map(([nomeLoja, itensDaLoja]) => (
              <details key={nomeLoja} className="compras-categoria compras-categoria--loja" open>
                <summary>
                  <h3>Loja: {nomeLoja} ({itensDaLoja.length})</h3>
                </summary>
                <ul className="compras-lista-itens">
                  {itensDaLoja.map((item) => (
                    <li key={item.id} className="compras-item">
                      <div className="compras-item-info">
                        <strong>{item.nome}</strong>
                        <p className="detalhe-secundario">
                          ${precoMedio(item).toFixed(2)}
                          {' · '}
                          {item.espaco > 0 ? `${item.espaco} espaço` : 'Não ocupa espaço'}
                          {item.balas != null && ` · ${item.balas} balas`}
                          {item.dano && ` · Dano: ${item.dano}`}
                        </p>
                        {item.descricao && <p className="campo-dica">{item.descricao}</p>}
                      </div>
                      <button type="button" onClick={() => adicionarAoCarrinho(item)}>
                        + Carrinho
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            ))}

          {CATEGORIAS_COMPRAS.map((cat) => {
            const itensDaCategoria = itensFiltrados.filter((i) => i.categoria === cat.id);
            if (itensDaCategoria.length === 0) return null;
            return (
              <details key={cat.id} className="compras-categoria" open={Boolean(termo)}>
                <summary>
                  <h3>{cat.label} ({itensDaCategoria.length})</h3>
                </summary>
                <ul className="compras-lista-itens">
                  {itensDaCategoria.map((item) => (
                    <li key={item.id} className="compras-item">
                      <div className="compras-item-info">
                        <strong>{item.nome}</strong>
                        {item.catalogoId && <span className="selo-personalizado"> · preço/detalhes desta campanha</span>}
                        <p className="detalhe-secundario">
                          {item.precoMin != null ? `$${precoMedio(item).toFixed(2)} (média)` : 'Não se vende'}
                          {' · '}
                          {item.espaco > 0 ? `${item.espaco} espaço` : 'Não ocupa espaço'}
                          {item.balas != null && ` · ${item.balas} balas · Recarga: ${item.recarga}`}
                          {item.dano && ` · Dano: ${item.dano}`}
                        </p>
                        {item.descricao && <p className="campo-dica">{item.descricao}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => adicionarAoCarrinho(item)}
                        disabled={item.precoMin == null}
                      >
                        + Carrinho
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>

        <div className="compras-carrinho">
          <h3>Carrinho</h3>
          {carrinho.length === 0 && <p className="detalhe-secundario">Nada no carrinho ainda.</p>}
          {carrinho.length > 0 && (
            <ul className="compras-carrinho-lista">
              {carrinho.map((e) => (
                <li key={e.item.id}>
                  <span>{e.item.nome}</span>
                  <span className="compras-carrinho-qtd">
                    <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarQuantidade(e.item.id, -1)}>−</button>
                    {e.quantidade}
                    <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarQuantidade(e.item.id, 1)}>+</button>
                  </span>
                  <span>${((precoMedio(e.item) ?? 0) * e.quantidade).toFixed(2)}</span>
                  <button type="button" className="botao-remover" onClick={() => removerDoCarrinho(e.item.id)}>✕</button>
                </li>
              ))}
            </ul>
          )}

          <div className="compras-total">
            <p>Subtotal: ${subtotal.toFixed(2)}</p>
            {desconto && (
              <p className="compras-desconto-ativo">
                {desconto.tipo === 'presente' ? 'Presente (grátis)' : `Desconto aplicado: $${desconto.valor.toFixed(2)}`}
                {' '}
                <button type="button" className="botao-secundario" onClick={removerDesconto}>Remover</button>
              </p>
            )}
            <p className="compras-total-final"><strong>Total: ${totalFinal.toFixed(2)}</strong></p>
            <p className="detalhe-secundario">Dinheiro disponível: ${Number(personagem.dinheiro ?? 0).toFixed(2)}</p>
          </div>

          <div className={`compras-peso-indicador ${impactoAoVivo.excedente > 0 ? 'compras-peso-indicador--estourado' : ''}`}>
            <p>
              Peso atual: {impactoAoVivo.pesoItensAtual.toFixed(2)} / {impactoAoVivo.espacoMax}
            </p>
            {carrinho.length > 0 && (
              <>
                <p>Carrinho adiciona: +{(impactoAoVivo.pesoTotalApos - impactoAoVivo.pesoItensAtual).toFixed(2)}</p>
                <p>
                  <strong>
                    Depois da compra: {impactoAoVivo.pesoTotalApos.toFixed(2)} / {impactoAoVivo.espacoMax}
                    {impactoAoVivo.excedente > 0 && ` — estoura em ${impactoAoVivo.excedente.toFixed(2)}`}
                  </strong>
                </p>
              </>
            )}
          </div>

          {!descontoAberto && (
            <button type="button" className="botao-secundario" onClick={() => setDescontoAberto(true)}>
              Aplicar desconto
            </button>
          )}
          {descontoAberto && (
            <form onSubmit={aplicarDesconto} className="compras-form-desconto">
              <label>
                <input type="radio" checked={tipoDesconto === 'valor'} onChange={() => setTipoDesconto('valor')} />
                Definir valor final
              </label>
              {tipoDesconto === 'valor' && (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorDesconto}
                  onChange={(e) => setValorDesconto(e.target.value)}
                  placeholder="Novo total"
                />
              )}
              <label>
                <input type="radio" checked={tipoDesconto === 'presente'} onChange={() => setTipoDesconto('presente')} />
                Presente / achou o item (grátis)
              </label>
              <div className="popup-acoes">
                <button type="submit">Aplicar</button>
                <button type="button" className="botao-secundario" onClick={() => setDescontoAberto(false)}>Cancelar</button>
              </div>
            </form>
          )}

          <button
            type="button"
            className="botao-comprar"
            onClick={tentarConcluirCompra}
            disabled={carrinho.length === 0 || processando}
          >
            {processando ? 'Processando...' : 'Concluir compra'}
          </button>
        </div>
      </div>

      {avisoPeso && (
        <div className="popup-fundo" onClick={() => setAvisoPeso(null)}>
          <div className="popup-caixa" onClick={(e) => e.stopPropagation()}>
            <h3>Peso excedido</h3>
            <p>
              Essa compra passa <strong>{avisoPeso.excedente.toFixed(2)} espaços</strong> do limite da mochila.
            </p>
            {montaria ? (
              <p className="detalhe-secundario">
                Dá pra colocar os itens novos na montaria (bolsa) em vez da mochila, ou voltar e ajustar o carrinho.
              </p>
            ) : (
              <p className="detalhe-secundario">
                Sem montaria cadastrada — a opção é voltar e ajustar o carrinho (tirar algo, ou reduzir quantidade).
              </p>
            )}
            <div className="popup-acoes">
              {montaria && (
                <button type="button" onClick={() => finalizarCompra({ ...avisoPeso, colocarNaMontaria: true })}>
                  Colocar excedente na montaria
                </button>
              )}
              <button type="button" className="botao-secundario" onClick={() => setAvisoPeso(null)}>
                Voltar e ajustar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}