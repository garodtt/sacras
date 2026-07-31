import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';

// Visual do bloco de Guias (13/07) — a parte React/interativa da
// extensão definida em tabsExtension.js. Cada guia (`tabPane`) é um
// nó de verdade do documento, com conteúdo editável próprio; esse
// componente só decide QUAL delas mostrar (`node.attrs.abaAtiva`) e
// oferece os controles (trocar, renomear, adicionar, excluir,
// arrastar pra reordenar, recolher ao parar de digitar).
//
// `NodeViewContent` renderiza TODOS os filhos (o ProseMirror não tem
// como "pular" um filho na renderização) — a troca de guia visível é
// feita imperativamente aqui (useEffect + querySelector), escondendo
// via `display:none` todo `tabPane` que não seja o índice ativo. Já
// que os filhos ficam sempre no DOM (só escondidos), o conteúdo de
// cada guia continua "vivo" — trocar de guia e voltar não perde nada.
const ATRASO_RECOLHER_MS = 3000;

export default function TabsBlockView({ node, updateAttributes, editor, getPos, selected }) {
  const conteudoRef = useRef(null);
  const [renomeando, setRenomeando] = useState(null);
  const [recolhido, setRecolhido] = useState(false);
  const [arrastando, setArrastando] = useState(null);
  const timeoutRecolherRef = useRef(null);

  const guias = [];
  for (let i = 0; i < node.childCount; i++) {
    guias.push({ titulo: node.child(i).attrs.titulo || `Guia ${i + 1}` });
  }
  const abaAtiva = Math.min(node.attrs.abaAtiva ?? 0, guias.length - 1);

  // Mostra só o painel da guia ativa — os outros continuam no DOM
  // (o ProseMirror precisa deles renderizados pra funcionar), só
  // ficam com display:none.
  useEffect(() => {
    if (!conteudoRef.current) return;
    const paineis = conteudoRef.current.querySelectorAll(':scope > [data-type="tab-pane"]');
    paineis.forEach((painel, indice) => {
      painel.style.display = indice === abaAtiva ? '' : 'none';
    });
  });

  // Recolher automático (13/07) — "quando eu parar de digitar quero
  // recolher a guia": reseta o timer a cada mudança no documento OU
  // na seleção enquanto o cursor estiver dentro DESTE bloco
  // especificamente (não de qualquer digitação no documento inteiro).
  useEffect(() => {
    function estaDentroDesteBloco() {
      const pos = getPos();
      if (typeof pos !== 'number') return false;
      const { from } = editor.state.selection;
      return from >= pos && from <= pos + node.nodeSize;
    }

    function reagendarRecolhimento() {
      if (!estaDentroDesteBloco()) return;
      setRecolhido(false);
      if (timeoutRecolherRef.current) clearTimeout(timeoutRecolherRef.current);
      timeoutRecolherRef.current = setTimeout(() => setRecolhido(true), ATRASO_RECOLHER_MS);
    }

    editor.on('update', reagendarRecolhimento);
    editor.on('selectionUpdate', reagendarRecolhimento);
    return () => {
      editor.off('update', reagendarRecolhimento);
      editor.off('selectionUpdate', reagendarRecolhimento);
      if (timeoutRecolherRef.current) clearTimeout(timeoutRecolherRef.current);
    };
  }, [editor, getPos, node]);

  function trocarAba(indice) {
    updateAttributes({ abaAtiva: indice });
    setRecolhido(false);
  }

  function adicionarGuia() {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const numGuias = node.childCount;
    const posFimConteudo = pos + node.nodeSize - 1;
    editor
      .chain()
      .focus()
      .insertContentAt(posFimConteudo, {
        type: 'tabPane',
        attrs: { titulo: `Guia ${numGuias + 1}` },
        content: [{ type: 'paragraph' }],
      })
      .run();
    updateAttributes({ abaAtiva: numGuias });
    setRecolhido(false);
  }

  function excluirGuia(indice, evento) {
    evento.stopPropagation();
    if (node.childCount <= 1) return; // sempre precisa sobrar ao menos 1 guia
    const pos = getPos();
    if (typeof pos !== 'number') return;
    let posFilho = pos + 1;
    for (let i = 0; i < indice; i++) posFilho += node.child(i).nodeSize;
    const tamanho = node.child(indice).nodeSize;

    editor
      .chain()
      .focus()
      .deleteRange({ from: posFilho, to: posFilho + tamanho })
      .run();

    const novoTotal = node.childCount - 1;
    const novaAtiva = Math.max(0, Math.min(node.attrs.abaAtiva, novoTotal - 1));
    updateAttributes({ abaAtiva: novaAtiva });
  }

  function iniciarRenomear(indice, evento) {
    evento.stopPropagation();
    setRenomeando(indice);
  }

  function confirmarRenomear(indice, novoTitulo) {
    setRenomeando(null);
    if (!novoTitulo.trim()) return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    let posFilho = pos + 1;
    for (let i = 0; i < indice; i++) posFilho += node.child(i).nodeSize;
    const filho = node.child(indice);
    editor
      .chain()
      .command(({ tr }) => {
        tr.setNodeMarkup(posFilho, undefined, { ...filho.attrs, titulo: novoTitulo.trim() });
        return true;
      })
      .run();
  }

  function moverGuia(deIndice, paraIndice) {
    if (deIndice === paraIndice) return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const filhos = [];
    for (let i = 0; i < node.childCount; i++) filhos.push(node.child(i).toJSON());
    const [movido] = filhos.splice(deIndice, 1);
    filhos.splice(paraIndice, 0, movido);

    const from = pos + 1;
    const to = pos + node.nodeSize - 1;
    editor.chain().focus().insertContentAt({ from, to }, filhos).run();

    let novaAtiva = node.attrs.abaAtiva;
    if (novaAtiva === deIndice) novaAtiva = paraIndice;
    else if (deIndice < novaAtiva && paraIndice >= novaAtiva) novaAtiva -= 1;
    else if (deIndice > novaAtiva && paraIndice <= novaAtiva) novaAtiva += 1;
    updateAttributes({ abaAtiva: novaAtiva });
  }

  return (
    <NodeViewWrapper className={`tabs-block ${selected ? 'tabs-block--selecionado' : ''}`}>
      <div className="tabs-block-cabecalho" contentEditable={false}>
        {guias.map((guia, indice) => (
          <button
            key={indice}
            type="button"
            className={`tabs-block-aba ${indice === abaAtiva ? 'tabs-block-aba--ativa' : ''} ${arrastando === indice ? 'tabs-block-aba--arrastando' : ''}`}
            draggable
            onDragStart={() => setArrastando(indice)}
            onDragEnd={() => setArrastando(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (arrastando !== null) moverGuia(arrastando, indice);
              setArrastando(null);
            }}
            onClick={() => trocarAba(indice)}
            onDoubleClick={(e) => iniciarRenomear(indice, e)}
            title="Clique pra abrir · duplo clique pra renomear · arraste pra reordenar"
          >
            {renomeando === indice ? (
              <input
                type="text"
                className="tabs-block-renomear-input"
                defaultValue={guia.titulo}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => confirmarRenomear(indice, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.target.blur();
                  if (e.key === 'Escape') setRenomeando(null);
                }}
              />
            ) : (
              <span>{guia.titulo}</span>
            )}
            {guias.length > 1 && (
              <span className="tabs-block-aba-excluir" onClick={(e) => excluirGuia(indice, e)} title="Excluir guia">
                ✕
              </span>
            )}
          </button>
        ))}
        <button type="button" className="tabs-block-adicionar" onClick={adicionarGuia} title="Adicionar guia">
          +
        </button>
      </div>

      <div
        ref={conteudoRef}
        className={`tabs-block-conteudo-caixa ${recolhido ? 'tabs-block-conteudo-caixa--recolhida' : ''}`}
      >
        <NodeViewContent className="tabs-block-conteudo" />
      </div>
    </NodeViewWrapper>
  );
}