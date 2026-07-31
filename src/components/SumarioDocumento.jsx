import { useEffect, useState } from 'react';

// Sumário automático (13/07, v3 — painel de verdade, sem hover) —
// antes expandia ao passar o mouse; trocado por um botão explícito de
// abrir/fechar (pedido: "com a opção de recolher esse popup"), sem
// depender de hover (que estava gerando inconsistência de clique).
// Título (h2) vira grupo, Subtítulo (h3) aninha embaixo do Título mais
// próximo ANTES dele. Cada grupo tem sua própria seta de recolher
// DENTRO do sumário (independente de recolher o título de verdade no
// documento — aqui é só sobre esconder a lista de subtítulos na hora
// de navegar, não afeta o texto).
function construirHierarquia(doc) {
  const grupos = [];
  let grupoAtual = null;

  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return;
    const texto = node.textContent || '(sem texto)';

    if (node.attrs.level === 2) {
      grupoAtual = { pos, texto, subtitulos: [] };
      grupos.push(grupoAtual);
    } else if (node.attrs.level === 3) {
      const subtitulo = { pos, texto };
      if (grupoAtual) grupoAtual.subtitulos.push(subtitulo);
      // Subtítulo antes de qualquer Título — caso raro; entra como
      // grupo próprio sem subtítulos embaixo, pra não sumir do sumário.
      else grupos.push({ pos, texto, subtitulos: [], semTitulo: true });
    }
  });

  return grupos;
}

export default function SumarioDocumento({ editor }) {
  const [grupos, setGrupos] = useState([]);
  const [recolhidos, setRecolhidos] = useState(() => new Set());
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!editor) return;

    function atualizarSumario() {
      setGrupos(construirHierarquia(editor.state.doc));
    }

    atualizarSumario();
    editor.on('update', atualizarSumario);
    return () => editor.off('update', atualizarSumario);
  }, [editor]);

  function irPara(pos) {
    if (!editor) return;
    // domAtPos numa posição exatamente no INÍCIO de um nó costuma
    // devolver o elemento PAI (com um offset indicando "antes do
    // filho N"), não o título em si. nodeDOM(pos) é a API certa pra
    // esse caso: pos precisa ser a posição de INÍCIO do nó (é isso
    // que grupo.pos já é, veio de doc.descendants).
    let elemento = editor.view.nodeDOM(pos);
    if (!(elemento instanceof HTMLElement)) {
      const { node } = editor.view.domAtPos(pos);
      elemento = node.nodeType === 3 ? node.parentElement : node;
    }
    elemento?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    editor.commands.focus(pos + 1);
  }

  function alternarRecolhido(pos) {
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(pos)) novo.delete(pos);
      else novo.add(pos);
      return novo;
    });
  }

  if (grupos.length === 0) return null;

  if (!aberto) {
    return (
      <button type="button" className="sumario-botao-abrir" onClick={() => setAberto(true)} title="Abrir sumário">
        ▤ Sumário
      </button>
    );
  }

  return (
    <div className="sumario-painel">
      <div className="sumario-painel-cabecalho">
        <h4>Sumário</h4>
        <button type="button" className="sumario-botao-fechar" onClick={() => setAberto(false)} title="Recolher sumário">
          ✕
        </button>
      </div>
      <nav className="sumario-lista" aria-label="Sumário do documento">
        {grupos.map((grupo) => {
          const recolhido = recolhidos.has(grupo.pos);
          const temSubtitulos = grupo.subtitulos.length > 0;
          return (
            <div key={grupo.pos} className="sumario-grupo">
              <div className="sumario-grupo-linha">
                {temSubtitulos && (
                  <button
                    type="button"
                    className="sumario-seta"
                    onClick={() => alternarRecolhido(grupo.pos)}
                    title={recolhido ? 'Expandir subtítulos' : 'Recolher subtítulos'}
                  >
                    {recolhido ? '▸' : '▾'}
                  </button>
                )}
                <button
                  type="button"
                  className={`sumario-titulo-botao ${grupo.semTitulo ? 'sumario-titulo-botao--sub' : ''}`}
                  onClick={() => irPara(grupo.pos)}
                >
                  {grupo.texto}
                </button>
              </div>
              {temSubtitulos && !recolhido && (
                <div className="sumario-sublista">
                  {grupo.subtitulos.map((sub) => (
                    <button
                      key={sub.pos}
                      type="button"
                      className="sumario-subtitulo-botao"
                      onClick={() => irPara(sub.pos)}
                    >
                      {sub.texto}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}