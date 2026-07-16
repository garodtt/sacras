import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import PopupConfirmar from '../components/PopupConfirmar.jsx';
import {
  buscarCampanha,
  listarCombateEntradas,
  criarCombateEntrada,
  atualizarCombateEntrada,
  removerCombateEntrada,
  removerTodasCombateEntradas,
  listarPersonagensDaCampanha,
  listarArmas,
  atualizarPersonagem,
} from '../lib/dados.js';
import { aplicarDano, ajustarValorSimples } from '../lib/regras.js';
import CampoEditavel from '../components/personagem/CampoEditavel.jsx';
import { EFEITOS_DOR } from '../components/personagem/EfeitoDorPopup.jsx';
import PopupReferencia from '../components/combate/PopupReferencia.jsx';

const TIPO_LABEL = { npc: 'NPC', jogador: 'Jogador' };

// Bônus por carta na Iniciativa — texto vem direto do livro. O ícone da
// carta J é a caveira (Vida), igual às outras habilidades do catálogo.
const CARTAS_INICIATIVA = [
  { carta: 'A', bonus: '+1 para Testes de Violência' },
  { carta: 'K', bonus: '+1 Ação de Combate' },
  { carta: 'Q', bonus: '+1 Movimento' },
  { carta: 'J', bonus: '+1 de Vida' },
];

// "Mortal" (linha 1) é a única com ícone no livro — dano crítico
// (punho = Dor), não ganho de Vida pro atacante. Assumido a partir do
// contexto (é a tabela de ACERTO crítico); se estiver errado, é só
// avisar.
const ACERTOS_CRITICOS = [
  { n: 1, nome: 'Mortal', efeito: '+2 de Dor no ataque.' },
  { n: 2, nome: 'Dança Maluca', efeito: 'O inimigo perde seu próximo turno no combate.' },
  { n: 3, nome: 'Desarmar', efeito: 'O inimigo não pode mais atirar com aquela arma.' },
  { n: 4, nome: 'Vantagem Moral', efeito: '+1 para seus Testes de Violência até o fim do combate.' },
  { n: 5, nome: 'Vantagem Tática', efeito: '+1 Movimento no seu turno até o fim do combate.' },
  { n: 6, nome: 'Marca da Vingança', efeito: 'O inimigo foge, mas jura vingança contra você.' },
];

const FALHAS_CRITICAS = [
  { n: 1, efeito: 'Seu ataque acerta um aliado ou uma pessoa inocente.' },
  { n: 2, efeito: 'Sua arma quebra ou, em caso de porrada, o dano é anulado.' },
  { n: 3, efeito: 'Guarda aberta: +1 em testes dos inimigos contra você até o fim do combate.' },
  { n: 4, efeito: 'Pressão: -1 no ataque contra os inimigos até o fim do combate.' },
  { n: 5, efeito: 'Você está abatido e perde seu próximo turno para se recompor.' },
  { n: 6, efeito: 'Você cai... igual bosta. E perde duas ações de qualquer tipo para levantar.' },
];

// Rastreador de combate do Mestre (13/07, revisado). NPCs continuam
// sendo um "bloco de stats" digitado na hora (sem referenciar
// personagens.id, como sempre foi). Jogadores agora podem ser
// IMPORTADOS da campanha (botão "Importar jogadores") — nesse caso a
// entrada guarda `personagem_id` (migration 0013) e Vida/Dor deixam de
// ter cópia própria: leem e escrevem DIRETO na tabela `personagens`
// (mesma linha que a ficha do jogador usa). Não existe sincronização
// de verdade acontecendo — é a MESMA linha do banco vista de dois
// lugares, então não tem como "dessincronizar". Se o jogador muda a
// Vida na própria ficha, aparece aqui na próxima vez que os dados forem
// buscados (o React não empurra updates sozinho entre abas/pessoas —
// dá F5/reentra na tela pra ver a mudança de outra sessão, mas nunca
// mostra um valor requentado).
//
// Armas/munição do jogador importado aparecem como referência (nome +
// munição atual/máx. de cada arma) — só leitura aqui; editar arma
// continua sendo na ficha do próprio personagem, não no rastreador.
//
// Só o dono da campanha (ou Admin) vê essa tela; RLS já bloqueia o
// resto no banco, mas mostramos um aviso claro em vez de uma lista
// vazia sem explicação.
export default function Combate() {
  const { id } = useParams();
  const { profile } = useAuth();

  const [campanha, setCampanha] = useState(null);
  const [entradas, setEntradas] = useState([]);
  const [armasPorPersonagem, setArmasPorPersonagem] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [entradaParaRemover, setEntradaParaRemover] = useState(null);
  const [confirmandoEncerrar, setConfirmandoEncerrar] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [importando, setImportando] = useState(false);

  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('npc');
  const [iniciativa, setIniciativa] = useState('');
  const [vidaMax, setVidaMax] = useState(6);
  const [dorMax, setDorMax] = useState(6);
  const [balasMax, setBalasMax] = useState(0);
  const [mostrarTabelaIniciativa, setMostrarTabelaIniciativa] = useState(false);
  const [mostrarTabelaDor, setMostrarTabelaDor] = useState(false);

  useEffect(() => {
    carregar();
  }, [id]);

  async function carregar() {
    setCarregando(true);
    setErro('');
    const [resCampanha, resEntradas] = await Promise.all([buscarCampanha(id), listarCombateEntradas(id)]);
    if (resCampanha.error || resEntradas.error) setErro((resCampanha.error || resEntradas.error).message);
    setCampanha(resCampanha.data ?? null);
    const listaEntradas = resEntradas.data ?? [];
    setEntradas(listaEntradas);
    await carregarArmasLigadas(listaEntradas);
    setCarregando(false);
  }

  // Busca as armas de cada personagem LIGADO (uma vez por personagem,
  // não por entrada — se dois jogadores raros tivessem o mesmo id isso
  // nem seria possível, mas evita repetir busca à toa de qualquer jeito).
  async function carregarArmasLigadas(listaEntradas) {
    const ids = [...new Set(listaEntradas.map((e) => e.personagem_id).filter(Boolean))];
    if (ids.length === 0) {
      setArmasPorPersonagem({});
      return;
    }
    const resultados = await Promise.all(ids.map((pid) => listarArmas(pid)));
    const mapa = {};
    ids.forEach((pid, i) => {
      mapa[pid] = resultados[i].data ?? [];
    });
    setArmasPorPersonagem(mapa);
  }

  const souCriador = campanha?.criado_por === profile.id;
  const ehAdmin = profile.role === 'admin';
  const podeGerenciar = souCriador || ehAdmin;

  // Mantém a lista sempre ordenada por Iniciativa (maior primeiro),
  // igual o gerenciador antigo — sem precisar buscar tudo de novo a
  // cada ajuste de Vida/Dor/Balas.
  function reordenar(lista) {
    return [...lista].sort((a, b) => b.iniciativa - a.iniciativa || a.created_at.localeCompare(b.created_at));
  }

  function atualizarLocal(entradaAtualizada) {
    setEntradas((atual) => reordenar(atual.map((e) => (e.id === entradaAtualizada.id ? entradaAtualizada : e))));
  }

  async function persistir(entrada, campos) {
    const { data, error } = await atualizarCombateEntrada(entrada.id, campos);
    if (error) setErro(error.message);
    else atualizarLocal(data);
  }

  async function adicionar(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setErro('');
    setAdicionando(true);
    const { data, error } = await criarCombateEntrada(id, {
      nome: nome.trim(),
      tipo,
      iniciativa: Number(iniciativa) || 0,
      vida_max: Math.max(1, Number(vidaMax) || 1),
      vida_atual: Math.max(1, Number(vidaMax) || 1),
      dor_max: Math.max(1, Number(dorMax) || 1),
      dor_atual: Math.max(1, Number(dorMax) || 1),
      balas_max: Math.max(0, Number(balasMax) || 0),
      balas_atual: Math.max(0, Number(balasMax) || 0),
    });
    setAdicionando(false);
    if (error) setErro(error.message);
    else {
      setEntradas((atual) => reordenar([...atual, data]));
      setNome('');
      setIniciativa('');
    }
  }

  async function remover() {
    const entrada = entradaParaRemover;
    setEntradaParaRemover(null);
    const { error } = await removerCombateEntrada(entrada.id);
    if (error) setErro(error.message);
    else setEntradas((atual) => atual.filter((e) => e.id !== entrada.id));
  }

  async function encerrarCombate() {
    setConfirmandoEncerrar(false);
    const { error } = await removerTodasCombateEntradas(id);
    if (error) setErro(error.message);
    else setEntradas([]);
  }

  // Importar jogadores (13/07) — pega todo personagem vinculado à
  // campanha que AINDA não está na lista de combate, e cria uma
  // entrada ligada (personagem_id) pra cada um. Vida/Dor não são
  // copiadas — a entrada só referencia o personagem; o valor mostrado
  // sempre vem direto da tabela `personagens` (ver `vidaAtualDe`/
  // `dorAtualDe` abaixo), então já entra com o que estiver valendo
  // agora mesmo, sem precisar de nenhuma lógica extra de "atualizar".
  async function importarJogadores() {
    setErro('');
    setImportando(true);

    const { data: vinculos, error: erroVinculos } = await listarPersonagensDaCampanha(id);
    if (erroVinculos) {
      setErro(erroVinculos.message);
      setImportando(false);
      return;
    }

    const jaNaLista = new Set(entradas.map((e) => e.personagem_id).filter(Boolean));
    const paraImportar = (vinculos ?? [])
      .map((v) => v.personagem)
      .filter((p) => p && !jaNaLista.has(p.id));

    if (paraImportar.length === 0) {
      setErro('Todos os personagens da campanha já estão na lista (ou a campanha não tem nenhum vinculado).');
      setImportando(false);
      return;
    }

    const resultados = await Promise.all(
      paraImportar.map((p) =>
        criarCombateEntrada(id, {
          personagem_id: p.id,
          nome: p.nome, // cópia só de segurança (se o personagem for excluído, a entrada não fica sem nome)
          tipo: 'jogador',
          iniciativa: 0,
        })
      )
    );

    const comErro = resultados.find((r) => r.error);
    if (comErro) {
      setErro(comErro.error.message);
      setImportando(false);
      return;
    }

    const novasEntradas = resultados.map((r) => r.data);
    const listaCompleta = reordenar([...entradas, ...novasEntradas]);
    setEntradas(listaCompleta);
    await carregarArmasLigadas(listaCompleta);
    setImportando(false);
  }

  // Valor de Vida/Dor "de verdade" pra uma entrada — se for ligada a um
  // personagem, vem do personagem (ao vivo); senão, vem da própria
  // entrada (NPC digitado na hora).
  function vidaAtualDe(entrada) {
    return entrada.personagem ? entrada.personagem.circulos_vida_atual : entrada.vida_atual;
  }
  function vidaMaxDe(entrada) {
    return entrada.personagem ? entrada.personagem.circulos_vida_max : entrada.vida_max;
  }
  function dorAtualDe(entrada) {
    return entrada.personagem ? entrada.personagem.circulos_dor_atual : entrada.dor_atual;
  }
  function dorMaxDe(entrada) {
    return entrada.personagem ? entrada.personagem.circulos_dor_max : entrada.dor_max;
  }
  function nomeDe(entrada) {
    return entrada.personagem?.nome || entrada.nome;
  }

  // Atualiza o `.personagem` embutido de uma entrada específica, sem
  // precisar reordenar (Vida/Dor não mexem em Iniciativa).
  function atualizarPersonagemLocal(entradaId, personagemAtualizado) {
    setEntradas((atual) =>
      atual.map((e) => (e.id === entradaId ? { ...e, personagem: personagemAtualizado } : e))
    );
  }

  async function persistirPersonagem(entrada, campos) {
    const { data, error } = await atualizarPersonagem(entrada.personagem_id, campos);
    if (error) setErro(error.message);
    else atualizarPersonagemLocal(entrada.id, data);
  }

  // Vida: ferimento direto, não passa pela Dor (mesma regra da ficha).
  // Ramifica: entrada ligada a um personagem escreve DIRETO na ficha de
  // verdade (`personagens`); NPC continua só na própria entrada.
  function ajustarVida(entrada, delta) {
    const atual = vidaAtualDe(entrada);
    const max = vidaMaxDe(entrada);
    const nova = ajustarValorSimples({ atual, max, delta });
    if (nova === atual) return;

    if (entrada.personagem_id) persistirPersonagem(entrada, { circulos_vida_atual: nova });
    else persistir(entrada, { vida_atual: nova });
  }

  // Dor: subir é simples; descer aciona a quebra de resistência (mesma
  // função de src/lib/regras.js usada na ficha do personagem).
  function ajustarDor(entrada, delta) {
    const vidaAtual = vidaAtualDe(entrada);
    const vidaMax = vidaMaxDe(entrada);
    const dorAtual = dorAtualDe(entrada);
    const dorMax = dorMaxDe(entrada);

    if (delta > 0) {
      const nova = ajustarValorSimples({ atual: dorAtual, max: dorMax, delta });
      if (nova === dorAtual) return;
      if (entrada.personagem_id) persistirPersonagem(entrada, { circulos_dor_atual: nova });
      else persistir(entrada, { dor_atual: nova });
      return;
    }

    const resultado = aplicarDano({ vidaAtual, vidaMax, dorAtual, dorMax, dano: 1 });
    if (entrada.personagem_id) {
      persistirPersonagem(entrada, {
        circulos_vida_atual: resultado.vidaAtual,
        circulos_dor_atual: resultado.dorAtual,
      });
    } else {
      persistir(entrada, { vida_atual: resultado.vidaAtual, dor_atual: resultado.dorAtual });
    }
  }

  function ajustarBalas(entrada, delta) {
    const nova = Math.max(0, Math.min(entrada.balas_max, entrada.balas_atual + delta));
    if (nova !== entrada.balas_atual) persistir(entrada, { balas_atual: nova });
  }

  function recarregar(entrada) {
    persistir(entrada, { balas_atual: entrada.balas_max });
  }

  if (carregando) return <p style={{ padding: '2rem' }}>Carregando...</p>;
  if (!campanha) return <p style={{ padding: '2rem' }}>Campanha não encontrada (ou sem acesso).</p>;
  if (!podeGerenciar) {
    return (
      <main className="painel">
        <p><Link to={`/campanha/${id}`}>&larr; Voltar</Link></p>
        <p className="aviso-somente-leitura">
          O rastreador de combate é uma ferramenta do Mestre — só quem criou a campanha (ou o Admin) usa esta tela.
        </p>
      </main>
    );
  }

  return (
    <main className="painel">
      <p><Link to={`/campanha/${id}`}>&larr; Voltar pra {campanha.nome}</Link></p>
      <h1>⚔ Rastreador de Combate</h1>
      {erro && <p className="erro">{erro}</p>}

      <section>
        <h2>Adicionar combatente</h2>
        <form onSubmit={adicionar} className="form-inline">
          <label>
            Nome
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </label>
          <label>
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="npc">NPC</option>
              <option value="jogador">Jogador</option>
            </select>
          </label>
          <label>
            Iniciativa
            <input type="number" value={iniciativa} onChange={(e) => setIniciativa(e.target.value)} />
          </label>
          <label>
            Vida máx.
            <input type="number" min="1" value={vidaMax} onChange={(e) => setVidaMax(e.target.value)} />
          </label>
          <label>
            Dor máx.
            <input type="number" min="1" value={dorMax} onChange={(e) => setDorMax(e.target.value)} />
          </label>
          <label>
            Balas máx.
            <input type="number" min="0" value={balasMax} onChange={(e) => setBalasMax(e.target.value)} />
          </label>
          <button type="submit" disabled={adicionando}>
            {adicionando ? 'Adicionando...' : '+ Adicionar'}
          </button>
        </form>
      </section>

      <section>
        <div className="painel-header">
          <h2>Ordem de iniciativa ({entradas.length})</h2>
          <span>
            <button type="button" onClick={importarJogadores} disabled={importando}>
              {importando ? 'Importando...' : 'Importar jogadores da campanha'}
            </button>{' '}
            {entradas.length > 0 && (
              <button type="button" className="botao-remover" onClick={() => setConfirmandoEncerrar(true)}>
                Encerrar combate
              </button>
            )}
          </span>
        </div>
        <p className="detalhe-secundario">
          "Importar jogadores" traz Vida/Dor sempre ao vivo da ficha de cada personagem vinculado à campanha — mudou
          na ficha, mudou aqui também, porque é a mesma linha do banco.
        </p>

        {entradas.length === 0 && <p className="detalhe-secundario">Nenhum combatente ainda — adicione acima.</p>}

        <ul className="lista-combate">
          {entradas.map((entrada) => {
            const ligado = Boolean(entrada.personagem_id);
            const vidaAtual = vidaAtualDe(entrada);
            const vidaMax = vidaMaxDe(entrada);
            const dorAtual = dorAtualDe(entrada);
            const dorMax = dorMaxDe(entrada);
            const caido = vidaAtual <= 0;
            const armasDoPersonagem = ligado ? armasPorPersonagem[entrada.personagem_id] ?? [] : [];

            return (
              <li key={entrada.id} className={caido ? 'combatente-caido' : ''}>
                <div className="combatente-cabecalho">
                  <span className={`badge-tipo badge-tipo--${entrada.tipo}`}>{TIPO_LABEL[entrada.tipo]}</span>
                  <strong>{nomeDe(entrada)}</strong>
                  {caido && <span className="badge-caido">Caído</span>}
                  <button
                    type="button"
                    className="link-referencia detalhe-secundario"
                    onClick={() => setMostrarTabelaIniciativa(true)}
                  >
                    Iniciativa {entrada.iniciativa}
                  </button>
                  <button type="button" className="botao-remover" onClick={() => setEntradaParaRemover(entrada)}>
                    Remover
                  </button>
                </div>

                <div className="combatente-status">
                  <div className="status-linha">
                    <span>Vida</span>
                    <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarVida(entrada, -1)}>
                      −1
                    </button>
                    <strong className="status-valor">
                      {vidaAtual} / {vidaMax}
                    </strong>
                    <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarVida(entrada, 1)}>
                      +1
                    </button>
                  </div>

                  <div className="status-linha">
                    <button
                      type="button"
                      className="link-referencia"
                      onClick={() => setMostrarTabelaDor(true)}
                    >
                      Dor
                    </button>
                    <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarDor(entrada, -1)}>
                      −1
                    </button>
                    <strong className="status-valor">
                      {dorAtual} / {dorMax}
                    </strong>
                    <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarDor(entrada, 1)}>
                      +1
                    </button>
                  </div>

                  {!ligado && entrada.balas_max > 0 && (
                    <div className="status-linha">
                      <span>Balas</span>
                      {entrada.balas_atual > 0 ? (
                        <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarBalas(entrada, -1)}>
                          −1
                        </button>
                      ) : (
                        <button type="button" onClick={() => recarregar(entrada)}>
                          Recarregar
                        </button>
                      )}
                      <strong className="status-valor">
                        {entrada.balas_atual} / {entrada.balas_max}
                      </strong>
                    </div>
                  )}

                  {ligado && armasDoPersonagem.length > 0 && (
                    <div className="armas-referencia">
                      <span className="detalhe-secundario">Armas (editar na ficha):</span>
                      <ul>
                        {armasDoPersonagem.map((arma) => (
                          <li key={arma.id}>
                            {arma.nome || '(sem nome)'}
                            {arma.municao_max > 0 && (
                              <span className="detalhe-secundario">
                                {' '}
                                — {arma.municao_atual ?? 0}/{arma.municao_max}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <details className="ajuste-maximos">
                  <summary>Ajustar máximos</summary>
                  <div className="grid-campos">
                    {ligado ? (
                      <p className="detalhe-secundario">
                        Vida/Dor máximos deste personagem vêm dos Atributos — ajuste na própria ficha, não aqui.
                      </p>
                    ) : (
                      <>
                        <CampoEditavel
                          label="Vida máx."
                          valor={entrada.vida_max}
                          min={1}
                          onSalvar={(v) => {
                            const nova = ajustarValorSimples({ atual: entrada.vida_atual, max: v, delta: v - entrada.vida_max });
                            persistir(entrada, { vida_max: v, vida_atual: nova });
                          }}
                        />
                        <CampoEditavel
                          label="Dor máx."
                          valor={entrada.dor_max}
                          min={1}
                          onSalvar={(v) => {
                            const nova = ajustarValorSimples({ atual: entrada.dor_atual, max: v, delta: v - entrada.dor_max });
                            persistir(entrada, { dor_max: v, dor_atual: nova });
                          }}
                        />
                        <CampoEditavel
                          label="Balas máx."
                          valor={entrada.balas_max}
                          min={0}
                          onSalvar={(v) => persistir(entrada, { balas_max: v, balas_atual: Math.min(v, entrada.balas_atual) })}
                        />
                      </>
                    )}
                    <CampoEditavel
                      label="Iniciativa"
                      valor={entrada.iniciativa}
                      onSalvar={(v) => persistir(entrada, { iniciativa: v })}
                    />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      <PopupReferencia
        titulo="Iniciativa"
        aberto={mostrarTabelaIniciativa}
        onFechar={() => setMostrarTabelaIniciativa(false)}
      >
        <table className="tabela-efeitos-dor tabela-responsiva">
          <thead>
            <tr>
              <th>Carta</th>
              <th>Bônus</th>
            </tr>
          </thead>
          <tbody>
            {CARTAS_INICIATIVA.map((c) => (
              <tr key={c.carta}>
                <td data-label="Carta" className="celula-numero">{c.carta}</td>
                <td data-label="Bônus">{c.bonus}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>1d6 — Acerto crítico</h4>
        <table className="tabela-efeitos-dor tabela-responsiva">
          <thead>
            <tr>
              <th>#</th>
              <th>Efeito</th>
            </tr>
          </thead>
          <tbody>
            {ACERTOS_CRITICOS.map((e) => (
              <tr key={e.n}>
                <td data-label="#" className="celula-numero">{e.n}</td>
                <td data-label="Efeito">
                  <strong>{e.nome}:</strong> {e.efeito}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>1d6 — Falha crítica</h4>
        <table className="tabela-efeitos-dor tabela-responsiva">
          <thead>
            <tr>
              <th>#</th>
              <th>Efeito</th>
            </tr>
          </thead>
          <tbody>
            {FALHAS_CRITICAS.map((e) => (
              <tr key={e.n}>
                <td data-label="#" className="celula-numero">{e.n}</td>
                <td data-label="Efeito">{e.efeito}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PopupReferencia>

      <PopupReferencia titulo="Efeitos de Dor" aberto={mostrarTabelaDor} onFechar={() => setMostrarTabelaDor(false)}>
        <p className="detalhe-secundario">Efeito de acordo com os Círculos de Dor já marcados.</p>
        <table className="tabela-efeitos-dor tabela-responsiva">
          <thead>
            <tr>
              <th>#</th>
              <th>Efeito</th>
              <th>Consequência</th>
            </tr>
          </thead>
          <tbody>
            {EFEITOS_DOR.map((e) => (
              <tr key={e.n}>
                <td data-label="#" className="celula-numero">{e.n}</td>
                <td data-label="Efeito">{e.nome}</td>
                <td data-label="Consequência">{e.efeito}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PopupReferencia>

      <PopupConfirmar
        aberto={Boolean(entradaParaRemover)}
        mensagem={`Remover "${entradaParaRemover?.nome}" do combate?`}
        onConfirmar={remover}
        onCancelar={() => setEntradaParaRemover(null)}
      />
      <PopupConfirmar
        aberto={confirmandoEncerrar}
        mensagem="Encerrar o combate e remover todos os combatentes da lista?"
        textoConfirmar="Encerrar combate"
        onConfirmar={encerrarCombate}
        onCancelar={() => setConfirmandoEncerrar(false)}
      />
    </main>
  );
}