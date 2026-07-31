import { useState } from 'react';

// Paleta do site (13/07) — mesmas cores usadas em todo o resto do app
// (ver :root em global.css), pra quem quiser destacar texto com as
// cores que já fazem parte da identidade visual, sem precisar decorar
// nenhum código hexadecimal.
const PALETA_SITE = [
  { nome: 'Tinta', cor: '#221a10' },
  { nome: 'Sangue', cor: '#9c2b1a' },
  { nome: 'Couro', cor: '#7c5330' },
  { nome: 'Poeira', cor: '#b98a3d' },
  { nome: 'Aliado (verde)', cor: '#4a6741' },
  { nome: 'Dourado (tema escuro)', cor: '#b58a5c' },
];

// Toolbar do editor de Anotações (13/07) — negrito/itálico/taxado/
// alinhamento/tamanho de fonte/título/subtítulo/checkbox/tabela.
// `editor` é a instância do Tiptap (useEditor, ver NotasMestre.jsx).
// Cada botão usa `toolbar-botao--ativo` quando o formato já está
// aplicado onde o cursor está — mesmo padrão visual de toolbar de
// qualquer editor de texto (Word, Google Docs).
//
// Botões só-ícone (N, I, taxado, setas, checkbox, inserir tabela)
// levam a classe extra `toolbar-botao--icone` (largura quadrada
// fixa); os de texto (Título, Subtítulo, e os do menu de tabela)
// usam só `toolbar-botao` (largura automática) — misturar os dois
// estilos no mesmo tamanho fixo foi o que causou a sobreposição
// visual relatada (13/07).
export default function EditorToolbar({ editor }) {
  const [corAberta, setCorAberta] = useState(false);

  if (!editor) return null;

  function ativo(nome, atributos) {
    return editor.isActive(nome, atributos) ? 'toolbar-botao--ativo' : '';
  }

  function alinhadoEm(lado) {
    return editor.isActive({ textAlign: lado }) ? 'toolbar-botao--ativo' : '';
  }

  const dentroDeTabela = editor.isActive('table');

  return (
    <div className="editor-toolbar">
      <div className="toolbar-grupo">
        <button
          type="button"
          className={`toolbar-botao toolbar-botao--icone ${ativo('bold')}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrito"
        >
          <strong>N</strong>
        </button>
        <button
          type="button"
          className={`toolbar-botao toolbar-botao--icone ${ativo('italic')}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Itálico"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={`toolbar-botao toolbar-botao--icone ${ativo('strike')}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Taxado"
        >
          <s>T</s>
        </button>
      </div>

      <div className="toolbar-separador" />

      <div className="toolbar-grupo">
        <button
          type="button"
          className={`toolbar-botao toolbar-botao--titulo ${ativo('heading', { level: 2 })}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Título (maior)"
        >
          Título
        </button>
        <button
          type="button"
          className={`toolbar-botao toolbar-botao--subtitulo ${ativo('heading', { level: 3 })}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Subtítulo (menor que Título)"
        >
          Subtítulo
        </button>
      </div>

      <div className="toolbar-separador" />

      <div className="toolbar-grupo">
        <button
          type="button"
          className={`toolbar-botao toolbar-botao--icone ${alinhadoEm('left')}`}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Alinhar à esquerda"
        >
          ⯇
        </button>
        <button
          type="button"
          className={`toolbar-botao toolbar-botao--icone ${alinhadoEm('center')}`}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Centralizar"
        >
          ≡
        </button>
        <button
          type="button"
          className={`toolbar-botao toolbar-botao--icone ${alinhadoEm('right')}`}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Alinhar à direita"
        >
          ⯈
        </button>
        <button
          type="button"
          className={`toolbar-botao toolbar-botao--icone ${alinhadoEm('justify')}`}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          title="Justificar"
        >
          ▤
        </button>
      </div>

      <div className="toolbar-separador" />

      <select
        className="toolbar-select"
        title="Tamanho da fonte"
        defaultValue=""
        onChange={(e) => {
          const valor = e.target.value;
          if (!valor) editor.chain().focus().unsetFontSize().run();
          else editor.chain().focus().setFontSize(valor).run();
          e.target.value = '';
        }}
      >
        <option value="">Tamanho</option>
        <option value="0.8rem">Pequeno</option>
        <option value="1rem">Normal</option>
        <option value="1.3rem">Grande</option>
        <option value="1.8rem">Enorme</option>
      </select>

      <div className="toolbar-separador" />

      <div className="toolbar-cor-container">
        <button
          type="button"
          className="toolbar-botao toolbar-botao--icone"
          onClick={() => setCorAberta((atual) => !atual)}
          title="Cor da fonte"
          style={{ color: editor.getAttributes('textStyle').color || 'var(--cor-tinta)' }}
        >
          A
        </button>
        {corAberta && (
          <div className="popover-cor">
            <div className="popover-cor-paleta">
              {PALETA_SITE.map((item) => (
                <button
                  key={item.cor}
                  type="button"
                  className="popover-cor-swatch"
                  style={{ background: item.cor }}
                  title={item.nome}
                  onClick={() => {
                    editor.chain().focus().setColor(item.cor).run();
                    setCorAberta(false);
                  }}
                />
              ))}
            </div>
            <label className="popover-cor-livre">
              Outra cor
              <input
                type="color"
                defaultValue={editor.getAttributes('textStyle').color || '#221a10'}
                onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              />
            </label>
            <button
              type="button"
              className="botao-secundario popover-cor-remover"
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                setCorAberta(false);
              }}
            >
              Sem cor (padrão)
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-separador" />

      <div className="toolbar-grupo">
        <button
          type="button"
          className={`toolbar-botao toolbar-botao--icone ${ativo('taskList')}`}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="Lista de tarefas (checkbox) — Tab indenta um nível"
        >
          ☑
        </button>
        <button
          type="button"
          className="toolbar-botao toolbar-botao--icone"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          title="Inserir tabela"
        >
          ▦
        </button>
        <button
          type="button"
          className="toolbar-botao"
          onClick={() => editor.chain().focus().inserirGuias().run()}
          title="Inserir bloco de guias (abas) — como no Notion"
        >
          Guias
        </button>
      </div>

      {/* Menu de tabela (13/07) — só aparece com o cursor DENTRO de
          uma tabela existente; controles pra editar a tabela em si
          (linha/coluna/excluir) não fazem sentido fora desse contexto,
          então ficam escondidos até serem relevantes. */}
      {dentroDeTabela && (
        <>
          <div className="toolbar-separador" />
          <div className="toolbar-grupo toolbar-grupo-tabela">
            <button type="button" className="toolbar-botao" onClick={() => editor.chain().focus().addRowBefore().run()} title="Adicionar linha acima">
              + Linha ↑
            </button>
            <button type="button" className="toolbar-botao" onClick={() => editor.chain().focus().addRowAfter().run()} title="Adicionar linha abaixo">
              + Linha ↓
            </button>
            <button type="button" className="toolbar-botao" onClick={() => editor.chain().focus().deleteRow().run()} title="Remover esta linha">
              − Linha
            </button>
            <button type="button" className="toolbar-botao" onClick={() => editor.chain().focus().addColumnBefore().run()} title="Adicionar coluna à esquerda">
              + Coluna ←
            </button>
            <button type="button" className="toolbar-botao" onClick={() => editor.chain().focus().addColumnAfter().run()} title="Adicionar coluna à direita">
              + Coluna →
            </button>
            <button type="button" className="toolbar-botao" onClick={() => editor.chain().focus().deleteColumn().run()} title="Remover esta coluna">
              − Coluna
            </button>
            <button type="button" className="toolbar-botao" onClick={() => editor.chain().focus().toggleHeaderRow().run()} title="Marcar/desmarcar esta linha como cabeçalho">
              Cabeçalho linha
            </button>
            <button type="button" className="toolbar-botao" onClick={() => editor.chain().focus().toggleHeaderColumn().run()} title="Marcar/desmarcar esta coluna como cabeçalho">
              Cabeçalho coluna
            </button>
            <button type="button" className="toolbar-botao toolbar-botao--excluir" onClick={() => editor.chain().focus().deleteTable().run()} title="Excluir tabela inteira">
              Excluir tabela
            </button>
          </div>
        </>
      )}
    </div>
  );
}