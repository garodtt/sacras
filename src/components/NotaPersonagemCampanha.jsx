import { useState } from 'react';
import { salvarNotaPersonagemCampanha } from '../lib/dados.js';
import { mostrarToast } from '../lib/toastBus.js';

// Nota privada do Mestre sobre UM personagem, específica desta
// campanha (13/07) — ganchos de história, segredos. Nunca aparece na
// ficha do jogador (RLS garante isso — migration 0021), nem quando ele
// mesmo é o dono do personagem. Mesmo padrão de salvar de
// NotasMestre.jsx: onBlur, sem confirmação, é rascunho.
export default function NotaPersonagemCampanha({ campanhaPersonagemId, notaInicial }) {
  const [nota, setNota] = useState(notaInicial ?? '');
  const [erro, setErro] = useState('');

  async function salvar(texto) {
    if (texto === (notaInicial ?? '')) return;
    setErro('');
    const { error } = await salvarNotaPersonagemCampanha(campanhaPersonagemId, texto);
    if (error) setErro(error.message);
    else mostrarToast('Nota salva.');
  }

  return (
    <div className="nota-personagem-campanha">
      {erro && <p className="erro">{erro}</p>}
      <label className="detalhe-secundario">
        Nota privada (só você vê)
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onBlur={(e) => salvar(e.target.value)}
          placeholder="Segredos, ganchos de história..."
          rows={2}
        />
      </label>
    </div>
  );
}