import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  buscarCampanha,
  listarCombateEntradas,
  criarCombateEntrada,
  atualizarCombateEntrada,
  removerCombateEntrada,
  removerTodasCombateEntradas,
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

// Rastreador de combate do Mestre (13/07) — porta a lógica do
// gerenciador antigo (HTML/JS solto) pra dentro do app: NPCs e
// jogadores numa lista só, ordenada por Iniciativa (maior primeiro),
// com Vida/Dor (mesma regra de quebra de resistência da ficha,
// reaproveitada de src/lib/regras.js) e Balas com recarregar simples
// (reseta pro máximo — sem pool de reserva, diferente do coldre/
// bandoleira do personagem; aqui é só uma munição solta por NPC).
//
// Vida e Dor têm +1 e −1 (não só −1, como o código de referência tinha)
// — dá pra recuperar pontos de um jeito ou de outro (poção, cura de
// habilidade, etc.). "Caído" é derivado (`vida_atual <= 0`), então subir
// a Vida de novo já tira sozinho desse estado, sem lógica extra.
//
// Cada entrada é um bloco de stats digitado na hora, sem referenciar
// personagens.id — o Mestre controla isso à parte da ficha de verdade.
// Só o dono da campanha (ou Admin) vê essa tela; RLS já bloqueia o
// resto no banco, mas mostramos um aviso claro em vez de uma lista
// vazia sem explicação.
export default function Combate() {
  const { id } = useParams();
  const { profile } = useAuth();

  const [campanha, setCampanha] = useState(null);
  const [entradas, setEntradas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [adicionando, setAdicionando] = useState(false);

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
    setEntradas(resEntradas.data ?? []);
    setCarregando(false);
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

  async function remover(entrada) {
    if (!window.confirm(`Remover "${entrada.nome}" do combate?`)) return;
    const { error } = await removerCombateEntrada(entrada.id);
    if (error) setErro(error.message);
    else setEntradas((atual) => atual.filter((e) => e.id !== entrada.id));
  }

  async function encerrarCombate() {
    if (entradas.length === 0) return;
    if (!window.confirm('Encerrar o combate e remover todos os combatentes da lista?')) return;
    const { error } = await removerTodasCombateEntradas(id);
    if (error) setErro(error.message);
    else setEntradas([]);
  }

  // Vida: ferimento direto, não passa pela Dor (mesma regra da ficha).
  function ajustarVida(entrada, delta) {
    const nova = ajustarValorSimples({ atual: entrada.vida_atual, max: entrada.vida_max, delta });
    if (nova !== entrada.vida_atual) persistir(entrada, { vida_atual: nova });
  }

  // Dor: subir é simples; descer aciona a quebra de resistência.
  function ajustarDor(entrada, delta) {
    if (delta > 0) {
      const nova = ajustarValorSimples({ atual: entrada.dor_atual, max: entrada.dor_max, delta });
      if (nova !== entrada.dor_atual) persistir(entrada, { dor_atual: nova });
      return;
    }
    const resultado = aplicarDano({
      vidaAtual: entrada.vida_atual,
      vidaMax: entrada.vida_max,
      dorAtual: entrada.dor_atual,
      dorMax: entrada.dor_max,
      dano: 1,
    });
    persistir(entrada, { vida_atual: resultado.vidaAtual, dor_atual: resultado.dorAtual });
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
          {entradas.length > 0 && (
            <button type="button" className="botao-remover" onClick={encerrarCombate}>
              Encerrar combate
            </button>
          )}
        </div>

        {entradas.length === 0 && <p className="detalhe-secundario">Nenhum combatente ainda — adicione acima.</p>}

        <ul className="lista-combate">
          {entradas.map((entrada) => {
            const caido = entrada.vida_atual <= 0;
            return (
              <li key={entrada.id} className={caido ? 'combatente-caido' : ''}>
                <div className="combatente-cabecalho">
                  <span className={`badge-tipo badge-tipo--${entrada.tipo}`}>{TIPO_LABEL[entrada.tipo]}</span>
                  <strong>{entrada.nome}</strong>
                  {caido && <span className="badge-caido">Caído</span>}
                  <button
                    type="button"
                    className="link-referencia detalhe-secundario"
                    onClick={() => setMostrarTabelaIniciativa(true)}
                  >
                    Iniciativa {entrada.iniciativa}
                  </button>
                  <button type="button" className="botao-remover" onClick={() => remover(entrada)}>
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
                      {entrada.vida_atual} / {entrada.vida_max}
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
                      {entrada.dor_atual} / {entrada.dor_max}
                    </strong>
                    <button type="button" className="botao-ajuste-pequeno" onClick={() => ajustarDor(entrada, 1)}>
                      +1
                    </button>
                  </div>

                  {entrada.balas_max > 0 && (
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
                </div>

                <details className="ajuste-maximos">
                  <summary>Ajustar máximos</summary>
                  <div className="grid-campos">
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
    </main>
  );
}