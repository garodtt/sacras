import { useRef, useState } from 'react';
import { NodeViewWrapper, useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { FontSize } from '../lib/fontSizeExtension.js';

const ATRASO_RECOLHER_MS = 3000;

// Mini-editor isolado de UMA guia (13/07, v2) — instância TOTALMENTE
// separada do Tiptap, sem NENHUM estado compartilhado com o editor
// principal nem com as outras guias. `key={abaAtiva}` no componente
// pai (mais abaixo) força o React a desmontar esse editor e montar um
// NOVO do zero toda vez que a guia ativa muda — garantia estrutural
// de isolamento, não depende de nenhuma lógica de esconder/mostrar.
function GuiaEditor({ conteudoInicial, onMudar }) {
  const editor = useEditor({
    extensions: [StarterKit, TextStyle, FontSize, Color.configure({ types: ['textStyle'] }), TextAlign.configure({ types: ['heading', 'paragraph'] }), TaskList, TaskItem.configure({ nested: true })],
    content: conteudoInicial || '<p></p>',
    onUpdate: ({ editor }) => onMudar(editor.getHTML()),
  });

  return <EditorContent editor={editor} className="tabs-block-mini-editor" />;
}

// Visual do bloco de Guias (13/07, v2) — a v1 guardava cada guia como
// um nó FILHO de verdade do ProseMirror, todas vivendo no MESMO
// documento/schema do editor principal; o conteúdo continuou
// "vazando" entre guias mesmo depois de trocar a visibilidade pra CSS
// puro, sinal de que o problema não era só de qual painel aparecia.
//
// v2: o `tabsBlock` é atômico (ver tabsExtension.js) — não tem
// conteúdo ProseMirror aninhado nenhum, só um atributo `guias` (array
// de `{ titulo, conteudo }`, puro dado). Cada guia vira um mini-editor
// TIPTAP TOTALMENTE ISOLADO (GuiaEditor acima) — impossível vazar
// conteúdo entre guias, já que não compartilham NENHUMA instância de
// editor nem documento.
export default function TabsBlockView({ node, updateAttributes, selected, getPos, editor }) {
  const [renomeando, setRenomeando] = useState(null);
  const [recolhido, setRecolhido] = useState(false);
  const [arrastando, setArrastando] = useState(null);
  const timeoutRecolherRef = useRef(null);

  const guias = node.attrs.guias || [];
  const abaAtiva = Math.max(0, Math.min(node.attrs.abaAtiva ?? 0, guias.length - 1));

  function reagendarRecolhimento() {
    setRecolhido(false);
    if (timeoutRecolherRef.current) clearTimeout(timeoutRecolherRef.current);
    timeoutRecolherRef.current = setTimeout(() => setRecolhido(true), ATRASO_RECOLHER_MS);
  }

  function trocarAba(indice) {
    updateAttributes({ abaAtiva: indice });
    setRecolhido(false);
  }

  function atualizarConteudoDaAtiva(novoHtml) {
    const novasGuias = guias.map((g, i) => (i === abaAtiva ? { ...g, conteudo: novoHtml } : g));
    updateAttributes({ guias: novasGuias });
    reagendarRecolhimento();
  }

  function adicionarGuia() {
    const novasGuias = [...guias, { titulo: `Guia ${guias.length + 1}`, conteudo: '<p></p>' }];
    updateAttributes({ guias: novasGuias, abaAtiva: novasGuias.length - 1 });
    setRecolhido(false);
  }

  function excluirGuia(indice, evento) {
    evento.stopPropagation();
    if (guias.length <= 1) return; // sempre precisa sobrar ao menos 1 guia
    const novasGuias = guias.filter((_, i) => i !== indice);
    const novaAtiva = Math.max(0, Math.min(abaAtiva, novasGuias.length - 1));
    updateAttributes({ guias: novasGuias, abaAtiva: novaAtiva });
  }

  function iniciarRenomear(indice, evento) {
    evento.stopPropagation();
    setRenomeando(indice);
  }

  function confirmarRenomear(indice, novoTitulo) {
    setRenomeando(null);
    if (!novoTitulo.trim()) return;
    const novasGuias = guias.map((g, i) => (i === indice ? { ...g, titulo: novoTitulo.trim() } : g));
    updateAttributes({ guias: novasGuias });
  }

  function moverGuia(deIndice, paraIndice) {
    if (deIndice === paraIndice) return;
    const novasGuias = [...guias];
    const [movido] = novasGuias.splice(deIndice, 1);
    novasGuias.splice(paraIndice, 0, movido);

    let novaAtiva = abaAtiva;
    if (novaAtiva === deIndice) novaAtiva = paraIndice;
    else if (deIndice < novaAtiva && paraIndice >= novaAtiva) novaAtiva -= 1;
    else if (deIndice > novaAtiva && paraIndice <= novaAtiva) novaAtiva += 1;

    updateAttributes({ guias: novasGuias, abaAtiva: novaAtiva });
  }

  // Excluir o BLOCO inteiro — diferente de excluir uma guia (que
  // sempre deixa pelo menos 1 sobrando), isso remove a funcionalidade
  // de guias inteira daquele ponto do documento, com o conteúdo de
  // todas as guias junto. Confirmação nativa do navegador (ação
  // destrutiva). Nó atômico tem `nodeSize` 1 — é só apagar essa
  // posição única do documento principal.
  function excluirBlocoInteiro() {
    const confirmado = window.confirm('Excluir o bloco de guias inteiro? Isso apaga o conteúdo de TODAS as guias dentro dele.');
    if (!confirmado) return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
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
            title="Clique pra abrir · arraste pra reordenar"
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
            <span className="tabs-block-aba-renomear" onClick={(e) => iniciarRenomear(indice, e)} title="Renomear guia">
              ✎
            </span>
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
        <button
          type="button"
          className="tabs-block-excluir-bloco"
          onClick={excluirBlocoInteiro}
          title="Excluir o bloco de guias inteiro"
        >
          Excluir bloco
        </button>
      </div>

      <div className={`tabs-block-conteudo-caixa ${recolhido ? 'tabs-block-conteudo-caixa--recolhida' : ''}`}>
        <GuiaEditor key={abaAtiva} conteudoInicial={guias[abaAtiva]?.conteudo} onMudar={atualizarConteudoDaAtiva} />
      </div>
    </NodeViewWrapper>
  );
}