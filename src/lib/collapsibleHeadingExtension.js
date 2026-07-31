import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Título/subtítulo recolhível — v2 (13/07, reconstruído). A primeira
// versão usava um NodeView React que envolvia o <h2>/<h3> num <div>
// wrapper; suspeita forte de que isso quebrou o alinhamento (extensões
// como TextAlign aplicam o estilo no elemento que o Tiptap considera
// "a representação DOM do nó" — com o wrapper no meio, esse estilo
// pode ter caído no <div>, não no <h2>/<h3> de dentro).
//
// Essa versão usa só DECORAÇÕES do ProseMirror — não muda a estrutura
// do nó em nenhum momento:
// - Decoration.widget insere a setinha ▾/▸ ANTES do texto do título,
//   "na mesma linha" (pedido explícito) — é um elemento à parte
//   inserido ao lado, não um wrapper por cima do título.
// - Decoration.node só adiciona uma classe CSS ao conteúdo que deve
//   ficar escondido — nunca precisa envolver nada em elemento novo.
//
// Estado de quais títulos estão recolhidos vive DENTRO do plugin
// (`recolhidos`, um Set de posições), não no documento — não precisa
// de novo atributo no schema do Heading nem mudar como o HTML é salvo.
const pluginKey = new PluginKey('titulosRecolhiveis');

export const TitulosRecolhiveis = Extension.create({
  name: 'titulosRecolhiveis',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,

        state: {
          init() {
            return new Set();
          },
          apply(tr, recolhidosAntigos) {
            const acao = tr.getMeta(pluginKey);
            if (!acao) return recolhidosAntigos;
            const novo = new Set(recolhidosAntigos);
            if (novo.has(acao.pos)) novo.delete(acao.pos);
            else novo.add(acao.pos);
            return novo;
          },
        },

        props: {
          decorations(state) {
            const recolhidos = pluginKey.getState(state);
            const { doc } = state;
            const decoracoes = [];
            let ocultando = false;
            let nivelOcultando = null;

            doc.forEach((node, offset) => {
              const nivel = node.attrs?.level;
              const ehTitulo = node.type.name === 'heading';

              if (ehTitulo) {
                if (ocultando && nivel <= nivelOcultando) {
                  // Título de nível igual ou maior que o que estava
                  // sendo ocultado — encerra a ocultação, uma nova
                  // seção começa aqui.
                  ocultando = false;
                  nivelOcultando = null;
                } else if (ocultando) {
                  // Ainda dentro da faixa oculta (ex.: um Subtítulo
                  // logo depois de um Título recolhido) — esconde
                  // esse título também, não só o conteúdo dele.
                  decoracoes.push(
                    Decoration.node(offset, offset + node.nodeSize, {
                      class: 'conteudo-oculto-por-titulo-recolhido',
                    })
                  );
                }

                const ehRecolhivel = nivel === 2 || nivel === 3;
                if (!ehRecolhivel) return;

                const estaRecolhido = recolhidos.has(offset);

                // Widget = elemento inserido AO LADO do texto, não um
                // wrapper por cima dele — o <h2>/<h3> continua intacto,
                // só ganha um vizinho novo bem no começo da linha.
                decoracoes.push(
                  Decoration.widget(
                    offset + 1,
                    (view) => {
                      const botao = document.createElement('button');
                      botao.type = 'button';
                      botao.className = 'titulo-seta-recolher';
                      botao.contentEditable = 'false';
                      botao.title = estaRecolhido ? 'Expandir' : 'Recolher';
                      botao.textContent = estaRecolhido ? '▸' : '▾';
                      botao.addEventListener('mousedown', (evento) => {
                        // preventDefault: evita que o clique mova o
                        // cursor de texto ou tire o foco do editor.
                        evento.preventDefault();
                        view.dispatch(view.state.tr.setMeta(pluginKey, { pos: offset }));
                      });
                      return botao;
                    },
                    { side: -1 }
                  )
                );

                if (estaRecolhido) {
                  ocultando = true;
                  nivelOcultando = nivel;
                }
                return;
              }

              if (ocultando) {
                decoracoes.push(
                  Decoration.node(offset, offset + node.nodeSize, {
                    class: 'conteudo-oculto-por-titulo-recolhido',
                  })
                );
              }
            });

            return DecorationSet.create(doc, decoracoes);
          },
        },
      }),
    ];
  },
});