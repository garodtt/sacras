import { useState } from 'react';
import { salvarNotasMestre } from '../lib/dados.js';
import { mostrarToast } from '../lib/toastBus.js';

// Bloco de anotações do Mestre (13/07) — rascunho persistente, sempre
// visível (não um popup) — ganchos de sessão, lembretes, o que quiser.
// Privado por RLS de verdade (migration 0019, tabela própria), não só
// escondido na tela. Salva ao sair do campo (onBlur), igual o resto do
// app; sem confirmação nem popup, é só uma nota de rascunho.
export default function NotasMestre({ campanhaId, notasIniciais }) {
  const [notas, setNotas] = useState(notasIniciais ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(texto) {
    if (texto === notasIniciais) return;
    setSalvando(true);
    setErro('');
    const { error } = await salvarNotasMestre(campanhaId, texto);
    setSalvando(false);
    if (error) setErro(error.message);
    else mostrarToast('Notas salvas.');
  }

  return (
    <div className="notas-mestre">
      <h3>Anotações (só você vê)</h3>
      {erro && <p className="erro">{erro}</p>}
      <textarea
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        onBlur={(e) => salvar(e.target.value)}
        placeholder="Ganchos de sessão, NPCs recorrentes, lembretes..."
        rows={6}
      />
      {salvando && <p className="detalhe-secundario">Salvando...</p>}
    </div>
  );
}