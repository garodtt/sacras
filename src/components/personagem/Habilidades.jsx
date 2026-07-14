import { useEffect, useState } from 'react';
import {
  listarCatalogoHabilidades,
  adicionarHabilidadeCatalogo,
  criarHabilidadeCustomizada,
  removerHabilidadePersonagem,
  trocarOrdemHabilidades,
} from '../../lib/dados.js';

const NOME_CATEGORIA = { combate: 'Combate', profissao: 'Profissão' };

// Habilidades agora vêm de um catálogo compartilhado (do livro) — o
// jogador escolhe da lista, ou cria uma própria (fica marcada como
// "Criada pelo jogador"). Antes (Fase 5) era um textarea de texto livre.
// Catálogo populado em 13/07 com as 30 habilidades do livro (migration
// 0004) — agrupadas aqui por categoria (combate/profissão) no dropdown.
//
// Ordem manual (13/07, migration 0009): `habilidades` já chega ordenada
// por `ordem` (listarHabilidadesPersonagem). Botões de mover pra cima/
// baixo trocam a `ordem` com o vizinho — mais confiável no celular do
// que arrastar.
export default function Habilidades({ personagemId, habilidades, onMudar, editavel }) {
  const [catalogo, setCatalogo] = useState([]);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(true);
  const [selecionado, setSelecionado] = useState('');
  const [nomeNova, setNomeNova] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarCatalogoHabilidades().then(({ data, error }) => {
      if (error) setErro(error.message);
      setCatalogo(data ?? []);
      setCarregandoCatalogo(false);
    });
  }, []);

  const jaTem = new Set(habilidades.map((h) => h.catalogo_id).filter(Boolean));
  const disponiveis = catalogo.filter((c) => !jaTem.has(c.id));
  const porCategoria = { combate: [], profissao: [] };
  for (const c of disponiveis) {
    (porCategoria[c.categoria] ?? (porCategoria[c.categoria] = [])).push(c);
  }
  const previa = catalogo.find((c) => c.id === selecionado);

  function nomeDe(hab) {
    return hab.nome_customizado || hab.habilidades_catalogo?.nome || '(sem nome)';
  }

  function descricaoDe(hab) {
    return hab.habilidades_catalogo?.descricao || null;
  }

  function proximaOrdem() {
    return habilidades.length === 0 ? 0 : Math.max(...habilidades.map((h) => h.ordem ?? 0)) + 1;
  }

  async function adicionarDoCatalogo() {
    if (!selecionado) return;
    setErro('');
    setSalvando(true);
    const { data, error } = await adicionarHabilidadeCatalogo(personagemId, selecionado, proximaOrdem());
    setSalvando(false);
    if (error) setErro(error.message);
    else {
      onMudar([...habilidades, data]);
      setSelecionado('');
    }
  }

  async function criarNova(e) {
    e.preventDefault();
    if (!nomeNova.trim()) return;
    setErro('');
    setSalvando(true);
    const { data, error } = await criarHabilidadeCustomizada(personagemId, nomeNova.trim(), proximaOrdem());
    setSalvando(false);
    if (error) setErro(error.message);
    else {
      onMudar([...habilidades, data]);
      setNomeNova('');
    }
  }

  async function remover(hab) {
    if (!window.confirm(`Remover "${nomeDe(hab)}"?`)) return;
    const { error } = await removerHabilidadePersonagem(hab.id);
    if (error) setErro(error.message);
    else onMudar(habilidades.filter((h) => h.id !== hab.id));
  }

  async function mover(index, direcao) {
    const outroIndex = index + direcao;
    if (outroIndex < 0 || outroIndex >= habilidades.length) return;

    const atual = habilidades[index];
    const outro = habilidades[outroIndex];

    setErro('');
    const [resA, resB] = await trocarOrdemHabilidades(atual.id, atual.ordem, outro.id, outro.ordem);
    const erroTroca = resA.error || resB.error;
    if (erroTroca) {
      setErro(erroTroca.message);
      return;
    }

    const atualizado = habilidades
      .map((h) => {
        if (h.id === atual.id) return { ...h, ordem: outro.ordem };
        if (h.id === outro.id) return { ...h, ordem: atual.ordem };
        return h;
      })
      .sort((a, b) => a.ordem - b.ordem);
    onMudar(atualizado);
  }

  return (
    <div className="bloco-habilidades">
      {erro && <p className="erro">{erro}</p>}

      <ul className="lista-habilidades">
        {habilidades.map((h, index) => (
          <li key={h.id}>
            <div className="habilidade-linha">
              {editavel && (
                <span className="botoes-mover">
                  <button
                    type="button"
                    className="botao-mover"
                    disabled={index === 0}
                    onClick={() => mover(index, -1)}
                    aria-label="Mover pra cima"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="botao-mover"
                    disabled={index === habilidades.length - 1}
                    onClick={() => mover(index, 1)}
                    aria-label="Mover pra baixo"
                  >
                    ▼
                  </button>
                </span>
              )}
              <span>{nomeDe(h)}</span>
              {!h.catalogo_id && <span className="badge-jogador">Criada pelo jogador</span>}
              {editavel && (
                <button type="button" className="botao-remover" onClick={() => remover(h)}>
                  Remover
                </button>
              )}
            </div>
            {descricaoDe(h) && <p className="detalhe-secundario">{descricaoDe(h)}</p>}
          </li>
        ))}
        {habilidades.length === 0 && <li className="detalhe-secundario">Nenhuma habilidade ainda.</li>}
      </ul>

      {editavel && (
        <div className="adicionar-habilidade">
          <div className="form-inline">
            <select
              value={selecionado}
              onChange={(e) => setSelecionado(e.target.value)}
              disabled={carregandoCatalogo}
            >
              <option value="">
                {carregandoCatalogo
                  ? 'Carregando catálogo...'
                  : disponiveis.length === 0
                  ? 'Catálogo vazio (ou tudo já escolhido)'
                  : 'Escolher do catálogo...'}
              </option>
              {['combate', 'profissao'].map(
                (cat) =>
                  porCategoria[cat]?.length > 0 && (
                    <optgroup key={cat} label={NOME_CATEGORIA[cat]}>
                      {porCategoria[cat].map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </optgroup>
                  )
              )}
            </select>
            <button type="button" onClick={adicionarDoCatalogo} disabled={!selecionado || salvando}>
              Adicionar
            </button>
          </div>
          {previa?.descricao && <p className="campo-dica">{previa.descricao}</p>}

          <form onSubmit={criarNova} className="form-inline">
            <input
              placeholder="Criar nova habilidade..."
              value={nomeNova}
              onChange={(e) => setNomeNova(e.target.value)}
            />
            <button type="submit" disabled={!nomeNova.trim() || salvando}>
              Criar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}