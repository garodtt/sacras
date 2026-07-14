import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { atualizarProfile } from '../lib/dados.js';
import PainelShell from '../components/layout/PainelShell.jsx';
import UploadFoto from '../components/UploadFoto.jsx';

// Editar Perfil (13/07) — nome de exibição e foto. RLS
// (profiles_update_own_or_admin) já permitia o usuário editar a própria
// linha desde a Fase 1; só faltava a tela. `refreshProfile` (novo em
// AuthContext.jsx) atualiza o profile em uso no resto do app (ex.:
// "Bem-vindo, X" no Painel) sem precisar de F5.
export default function EditarPerfil() {
  const { profile, refreshProfile } = useAuth();
  const [nome, setNome] = useState(profile?.display_name ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);

  async function salvarNome(e) {
    e.preventDefault();
    if (!nome.trim()) return;

    setErro('');
    setSalvando(true);
    const { error } = await atualizarProfile(profile.id, { display_name: nome.trim() });
    setSalvando(false);

    if (error) setErro(error.message);
    else {
      await refreshProfile();
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    }
  }

  async function salvarFoto(url) {
    setErro('');
    const { error } = await atualizarProfile(profile.id, { foto_url: url });
    if (error) setErro(error.message);
    else await refreshProfile();
  }

  if (!profile) return null;

  return (
    <PainelShell>
      <h2>Editar perfil</h2>
      {erro && <p className="erro">{erro}</p>}
      {salvo && <p className="detalhe-secundario">Nome salvo.</p>}

      <UploadFoto
        caminho={`perfil/${profile.id}/foto`}
        fotoAtual={profile.foto_url}
        editavel
        variante="retrato"
        alt={profile.display_name}
        onSalvar={salvarFoto}
      />

      <form onSubmit={salvarNome} className="form-inline">
        <label>
          Nome de exibição
          <input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </label>
        <button type="submit" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar nome'}
        </button>
      </form>
    </PainelShell>
  );
}