import { Extension } from '@tiptap/core';

// Tiptap não vem com tamanho de fonte pronto (13/07) — é um padrão bem
// documentado da comunidade: estende a marca `textStyle` (do pacote
// @tiptap/extension-text-style) com um atributo `fontSize`, que vira
// um `style="font-size: ..."` no HTML salvo. Precisa de `textStyle`
// como extensão irmã (ver EditorAnotacoes.jsx) — sem ela, não tem em
// que atributo pendurar o tamanho.
export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return { types: ['textStyle'] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});