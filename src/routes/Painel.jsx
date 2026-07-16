import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  atualizarProfile,
  listarMeusPersonagens,
  listarMinhasCampanhas,
  listarCampanhasQueParticipo,
  listarConvitesPendentes,
  responderConvite,
} from '../lib/dados.js';
import PainelShell from '../components/layout/PainelShell.jsx';
import UploadFoto from '../components/UploadFoto.jsx';
import { mostrarToast } from '../lib/toastBus.js';

// Tela inicial — perfil (foto, nome editável, e-mail com copiar) e o
// resumo (convites/personagens/campanhas) moram juntos aqui. "Sair"
// (Logout) só existe aqui (fora do cabeçalho compartilhado). Acessível
// de qualquer tela pelo item "Perfil" no menu lateral.
//
// 13/07 (4ª rodada): "Convites pendentes" é o único contador clicável —
// abre um popup com a lista de verdade (Aceitar/Recusar). Os outros 3
// (Personagens, Campanhas criadas, Campanhas que participa) continuam
// só números, sem ação — não dá pra "aceitar" um personagem, então não
// fazia sentido abrir nada pra eles, só pros convites.
export default function Painel() {
  const { profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [nome, setNome] = useState(profile?.display_name ?? '');
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [erro, setErro] = useState('');

  const [personagens, setPersonagens] = useState([]);
  const [campanhasCriadas, setCampanhasCriadas] = useState([]);
  const [campanhasParticipo, setCampanhasParticipo] = useState([]);
  const [convites, setConvites] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [convitesAbertos, setConvitesAbertos] = useState(false);

  useEffect(() => {
    carregar();
  }, [profile.id]);

  async function carregar() {
    setCarregando(true);
    const [resPersonagens, resCriadas, resParticipo, resConvites] = await Promise.all([
      listarMeusPersonagens(profile.id),
      listarMinhasCampanhas(profile.id),
      listarCampanhasQueParticipo(profile.id),
      listarConvitesPendentes(profile.id),
    ]);

    setPersonagens(resPersonagens.data ?? []);
    setCampanhasCriadas(resCriadas.data ?? []);

    const vistos = new Set();
    const participo = [];
    for (const row of resParticipo.data ?? []) {
      if (row.campanha && !vistos.has(row.campanha.id)) {
        vistos.add(row.campanha.id);
        participo.push(row.campanha);
      }
    }
    setCampanhasParticipo(participo);
    setConvites(resConvites.data ?? []);
    setCarregando(false);
  }

  async function salvarNome(e) {
    e.preventDefault();
    if (!nome.trim()) return;

    setErro('');
    setSalvandoNome(true);
    const { error } = await atualizarProfile(profile.id, { display_name: nome.trim() });
    setSalvandoNome(false);

    if (error) setErro(error.message);
    else {
      await refreshProfile();
      mostrarToast('Nome salvo.');
    }
  }

  async function salvarFoto(url) {
    setErro('');
    const { error } = await atualizarProfile(profile.id, { foto_url: url });
    if (error) setErro(error.message);
    else await refreshProfile();
  }

  async function copiarEmail() {
    try {
      await navigator.clipboard.writeText(profile.email);
      mostrarToast('E-mail copiado.');
    } catch {
      setErro('Não consegui copiar automaticamente — selecione o e-mail manualmente.');
    }
  }

  async function handleResponderConvite(convId, status, campanhaId) {
    setErro('');
    const { error } = await responderConvite(convId, status);

    if (error) setErro(error.message);
    else if (status === 'aceito') {
      setConvitesAbertos(false);
      navigate(`/campanha/${campanhaId}`);
    } else {
      carregar();
    }
  }

  if (!profile) return null;

  return (
    <PainelShell>
      {erro && <p className="erro">{erro}</p>}

      <div className="painel-perfil">
        <UploadFoto
          caminho={`perfil/${profile.id}/foto`}
          fotoAtual={profile.foto_url}
          editavel
          variante="retrato"
          alt={profile.display_name}
          onSalvar={salvarFoto}
        />
        <div className="painel-perfil-dados">
          <form onSubmit={salvarNome} className="campo-nome-inline">
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
            <button type="submit" disabled={salvandoNome}>
              {salvandoNome ? '...' : 'Salvar'}
            </button>
          </form>
          <div className="campo-email-linha">
            <input value={profile.email ?? ''} readOnly />
            <button type="button" className="botao-secundario" onClick={copiarEmail}>
              Copiar
            </button>
          </div>
        </div>
      </div>

      <ul className="painel-contadores">
        <li>
          <button type="button" className="painel-contador-clicavel" onClick={() => setConvitesAbertos(true)}>
            <span>Convites pendentes</span>
            <strong>{carregando ? '—' : convites.length}</strong>
          </button>
        </li>
        <li>
          <span>Personagens</span>
          <strong>{carregando ? '—' : personagens.length}</strong>
        </li>
        <li>
          <span>Campanhas criadas</span>
          <strong>{carregando ? '—' : campanhasCriadas.length}</strong>
        </li>
        <li>
          <span>Campanhas que participa</span>
          <strong>{carregando ? '—' : campanhasParticipo.length}</strong>
        </li>
      </ul>

      <button type="button" className="botao-logout" onClick={signOut}>
        Logout
      </button>

      {convitesAbertos && (
        <div className="popup-fundo" onClick={() => setConvitesAbertos(false)}>
          <div className="popup-caixa" onClick={(e) => e.stopPropagation()}>
            <h3>Convites pendentes</h3>
            {convites.length === 0 ? (
              <p className="detalhe-secundario">Nenhum convite pendente no momento.</p>
            ) : (
              <ul className="lista-cards">
                {convites.map((c) => (
                  <li key={c.id}>
                    <div>
                      <strong>{c.campanha?.nome}</strong>
                      <p className="detalhe-secundario">Convite de {c.campanha?.dono?.display_name}</p>
                    </div>
                    <span>
                      <button type="button" onClick={() => handleResponderConvite(c.id, 'aceito', c.campanha?.id)}>
                        Aceitar
                      </button>{' '}
                      <button
                        type="button"
                        className="botao-secundario"
                        onClick={() => handleResponderConvite(c.id, 'recusado', c.campanha?.id)}
                      >
                        Recusar
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="botao-secundario" onClick={() => setConvitesAbertos(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </PainelShell>
  );
}