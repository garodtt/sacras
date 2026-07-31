import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import TabsBlockView from '../components/TabsBlockView.jsx';

// Guias dentro do documento (13/07) — bloco estilo Notion com várias
// "guias" (abas), cada uma com o próprio conteúdo editável
// independente. Dois tipos de nó:
//
// - `tabsBlock`: o CONTAINER — guarda qual guia está ativa
//   (`abaAtiva`, um índice) e contém uma ou mais `tabPane` como
//   filhos diretos.
// - `tabPane`: uma guia individual — guarda o próprio nome
//   (`titulo`) e pode conter qualquer bloco normal dentro (parágrafo,
//   lista, tabela, título...).
//
// A parte visual (mostrar só a guia ativa, botões de +/renomear/
// excluir, arrastar pra reordenar, recolher ao parar de digitar) fica
// toda em TabsBlockView.jsx — esse arquivo só define a ESTRUTURA de
// dados que o documento salva.

export const TabPane = Node.create({
  name: 'tabPane',
  content: 'block+',

  addAttributes() {
    return {
      titulo: {
        default: 'Guia',
        parseHTML: (element) => element.getAttribute('data-titulo') || 'Guia',
        renderHTML: (attributes) => ({ 'data-titulo': attributes.titulo }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="tab-pane"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'tab-pane' }), 0];
  },
});

export const TabsBlock = Node.create({
  name: 'tabsBlock',
  group: 'block',
  content: 'tabPane+',
  isolating: true,

  addAttributes() {
    return {
      abaAtiva: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute('data-aba-ativa')) || 0,
        renderHTML: (attributes) => ({ 'data-aba-ativa': attributes.abaAtiva }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="tabs-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'tabs-block' }), 0];
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
            attrs: { abaAtiva: 0 },
            content: [
              { type: 'tabPane', attrs: { titulo: 'Guia 1' }, content: [{ type: 'paragraph' }] },
              { type: 'tabPane', attrs: { titulo: 'Guia 2' }, content: [{ type: 'paragraph' }] },
            ],
          });
        },
    };
  },
});