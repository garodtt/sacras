import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import TabsBlockView from '../components/TabsBlockView.jsx';

// Guias dentro do documento (13/07, v2 — reescrito do zero) — bloco
// estilo Notion com várias "guias", cada uma com o próprio conteúdo.
//
// A v1 tentava fazer isso com `tabPane` sendo um filho de verdade do
// ProseMirror (`content: 'tabPane+'`), todos vivendo no MESMO
// documento/schema do editor principal, escondendo os inativos via
// CSS ou JS. Mesmo depois de trocar por CSS puro, o conteúdo
// continuou "vazando" entre guias — sinal de que o problema não era
// só de VISIBILIDADE, e sim de ter várias guias competindo pelo MESMO
// documento ProseMirror por baixo.
//
// v2 elimina essa categoria de bug inteira: o `tabsBlock` agora é um
// nó ATÔMICO (`atom: true`) — pro editor PRINCIPAL, ele não tem
// conteúdo nenhum navegável, é uma "caixa preta". Tudo que ele guarda
// é DADO puro no atributo `guias` (array de `{ titulo, conteudo }`,
// `conteudo` sendo HTML). A parte visual (TabsBlockView.jsx) cria um
// MINI-EDITOR TIPTAP TOTALMENTE SEPARADO pra guia ativa — cada troca
// de guia desmonta um editor e monta outro do zero (isolamento total,
// impossível vazar conteúdo entre eles, já que não são a MESMA
// instância de editor nem compartilham NENHUM estado). Como bônus,
// "guias dentro de guias" deixa de precisar de uma verificação em
// tempo de execução — o mini-editor de cada guia nem SABE que a
// extensão de Guias existe, então inserir uma dentro seria
// literalmente impossível de qualquer forma.
export const TabsBlock = Node.create({
  name: 'tabsBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      guias: {
        default: [
          { titulo: 'Guia 1', conteudo: '<p></p>' },
          { titulo: 'Guia 2', conteudo: '<p></p>' },
        ],
        parseHTML: (element) => {
          try {
            const bruto = element.getAttribute('data-guias');
            const analisado = bruto ? JSON.parse(bruto) : [];
            return Array.isArray(analisado) && analisado.length > 0
              ? analisado
              : [{ titulo: 'Guia 1', conteudo: '<p></p>' }];
          } catch {
            return [{ titulo: 'Guia 1', conteudo: '<p></p>' }];
          }
        },
        renderHTML: (attributes) => ({ 'data-guias': JSON.stringify(attributes.guias ?? []) }),
      },
      abaAtiva: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute('data-aba-ativa')) || 0,
        renderHTML: (attributes) => ({ 'data-aba-ativa': attributes.abaAtiva ?? 0 }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="tabs-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'tabs-block' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TabsBlockView);
  },

  addCommands() {
    return {
      inserirGuias:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              abaAtiva: 0,
              guias: [
                { titulo: 'Guia 1', conteudo: '<p></p>' },
                { titulo: 'Guia 2', conteudo: '<p></p>' },
              ],
            },
          });
        },
    };
  },
});