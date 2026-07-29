import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { FontSize } from '../lib/fontSizeExtension.js';
import EditorToolbar from './EditorToolbar.jsx';
import { salvarNotasMestre } from '../lib/dados.js';
import { mostrarToast } from '../lib/toastBus.js';

// Bloco de anotações do Mestre (13/07, editor rico) — antes era um
// <textarea> puro, salvando só ao sair do campo. Agora é um editor de
// texto de verdade (Tiptap — negrito/itálico/taxado/alinhamento/
// tamanho de fonte/título/subtítulo/checkbox/tabela), com salvamento
// automático enquanto digita (debounce de 1.5s depois da última
// tecla, não só ao sair do campo).
//
// Guarda como HTML na MESMA coluna `text` que já existia
// (campanha_notas_mestre.notas) — sem migration nova. Nota antiga
// (texto puro, de antes do editor rico) continua abrindo normal: o
// Tiptap trata uma string sem tags como um parágrafo só.
const ATRASO_AUTOSAVE_MS = 1500;

export default function NotasMestre({ campanhaId, notasIniciais, onSalvo }) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const timeoutRef = useRef(null);
  const ultimoSalvoRef = useRef(notasIniciais ?? '');

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontSize,
      Color.configure({ types: ['textStyle'] }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: notasIniciais || '',
    onUpdate: ({ editor }) => {
      agendarAutosave(editor.getHTML());
    },
  });

  // Antes só cancelava um autosave pendente ao trocar de aba — se o
  // usuário tivesse digitado algo e trocado de aba ANTES dos 1.5s de
  // atraso completarem, essa última digitação nunca era salva (o
  // timer era só descartado, não executado). Agora força o
  // salvamento imediatamente nesse caso, em vez de simplesmente
  // cancelar — sem isso, mesmo com o callback onSalvo, dava pra
  // perder o texto mais recente numa troca de aba rápida.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        if (editor) {
          const htmlAtual = editor.getHTML();
          if (htmlAtual !== ultimoSalvoRef.current) {
            salvarNotasMestre(campanhaId, htmlAtual).then(({ error }) => {
              if (!error) onSalvo?.(htmlAtual);
            });
          }
        }
      }
    };
  }, [editor]);

  function agendarAutosave(html) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => salvar(html), ATRASO_AUTOSAVE_MS);
  }

  async function salvar(html) {
    if (html === ultimoSalvoRef.current) return;
    setSalvando(true);
    setErro('');
    const { error } = await salvarNotasMestre(campanhaId, html);
    setSalvando(false);
    if (error) setErro(error.message);
    else {
      ultimoSalvoRef.current = html;
      onSalvo?.(html);
      mostrarToast('Notas salvas.');
    }
  }

  return (
    <div className="notas-mestre">
      <div className="notas-mestre-cabecalho">
        <h2>Anotações</h2>
        <span className="selo-privado">Só você vê</span>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <EditorToolbar editor={editor} />
      <div className="editor-conteudo-caixa">
        <EditorContent editor={editor} className="editor-conteudo" />
      </div>
      {salvando && <p className="detalhe-secundario">Salvando...</p>}
    </div>
  );
}