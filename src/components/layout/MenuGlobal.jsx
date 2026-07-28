import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { criarPersonagem, criarCampanha, listarConvitesPendentes } from '../../lib/dados.js';
import MenuLateral from './MenuLateral.jsx';
import BotaoHamburguer from './BotaoHamburguer.jsx';

// Menu global (13/07) — extraído de PainelShell.jsx pra ser
// reaproveitado em QUALQUER tela (a primeira fora do Painel é a ficha
// do personagem). Sempre os mesmos 5 itens (Perfil/Seus Personagens/
// Criar Personagem/Suas Campanhas/Criar Campanha), independente de
// qual tela está aberta — por pedido explícito, pra não ter mais
// itens de "seção da tela atual" misturados no hambúrguer (isso agora
// vive na barra HUD no PC, ou na bolinha flutuante no celular,
// dependendo da tela).
export default function MenuGlobal() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [menuAberto, setMenuAberto] = useState(false);
  const [temConvitePendente, setTemConvitePendente] = useState(false);
  const [modalPersonagem, setModalPersonagem] = useState(false);
  const [modalCampanha, setModalCampanha] = useState(false);

  const [nomePersonagem, setNomePersonagem] = useState('');
  const [criandoPersonagem, setCriandoPersonagem] = useState(false);
  const [erroPersonagem, setErroPersonagem] = useState('');

  const [nomeCampanha, setNomeCampanha] = useState('');
  const [descricaoCampanha, setDescricaoCampanha] = useState('');
  const [criandoCampanha, setCriandoCampanha] = useState(false);
  const [erroCampanha, setErroCampanha] = useState('');

  useEffect(() => {
    listarConvitesPendentes(profile.id).then(({ data }) => {
      setTemConvitePendente((data ?? []).length > 0);
    });
  }, [profile.id]);

  async function handleCriarPersonagem(e) {
    e.preventDefault();
    if (!nomePersonagem.trim()) return;
    setErroPersonagem('');
    setCriandoPersonagem(true);
    const { data, error } = await criarPersonagem({ userId: profile.id, nome: nomePersonagem.trim() });
    setCriandoPersonagem(false);

    if (error) setErroPersonagem(error.message);
    else {
      setModalPersonagem(false);
      setNomePersonagem('');
      navigate(`/personagem/${data.id}`);
    }
  }

  async function handleCriarCampanha(e) {
    e.preventDefault();
    if (!nomeCampanha.trim()) return;
    setErroCampanha('');
    setCriandoCampanha(true);
    const { data, error } = await criarCampanha({
      nome: nomeCampanha.trim(),
      descricao: descricaoCampanha.trim() || null,
      criadoPor: profile.id,
    });
    setCriandoCampanha(false);

    if (error) setErroCampanha(error.message);
    else {
      setModalCampanha(false);
      setNomeCampanha('');
      setDescricaoCampanha('');
      navigate(`/campanha/${data.id}`);
    }
  }

  const itensMenu = [
    { label: 'Perfil', to: '/painel' },
    { label: 'Seus Personagens', to: '/painel/personagens' },
    { label: '+ Criar Personagem', onClick: () => setModalPersonagem(true) },
    { label: 'Suas Campanhas', to: '/painel/campanhas' },
    { label: '+ Criar Campanha', onClick: () => setModalCampanha(true) },
    ...(profile?.role === 'admin' ? [{ label: 'Visão geral (Admin)', to: '/admin' }] : []),
  ];

  return (
    <>
      <BotaoHamburguer onClick={() => setMenuAberto(true)} badge={temConvitePendente} />
      <MenuLateral aberto={menuAberto} onFechar={() => setMenuAberto(false)} titulo="Menu" itens={itensMenu} />

      {modalPersonagem && (
        <div className="popup-fundo" onClick={() => setModalPersonagem(false)}>
          <div className="popup-caixa" onClick={(e) => e.stopPropagation()}>
            <h3>Criar personagem</h3>
            {erroPersonagem && <p className="erro">{erroPersonagem}</p>}
            <form id="form-criar-personagem-global" onSubmit={handleCriarPersonagem} className="form-inline">
              <label>
                Nome do personagem
                <input
                  value={nomePersonagem}
                  onChange={(e) => setNomePersonagem(e.target.value)}
                  required
                  autoFocus
                />
              </label>
            </form>
            <div className="popup-acoes">
              <button type="submit" form="form-criar-personagem-global" disabled={criandoPersonagem}>
                {criandoPersonagem ? 'Criando...' : 'Criar e abrir ficha'}
              </button>
              <button type="button" className="botao-secundario" onClick={() => setModalPersonagem(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalCampanha && (
        <div className="popup-fundo" onClick={() => setModalCampanha(false)}>
          <div className="popup-caixa" onClick={(e) => e.stopPropagation()}>
            <h3>Criar campanha</h3>
            {erroCampanha && <p className="erro">{erroCampanha}</p>}
            <form id="form-criar-campanha-global" onSubmit={handleCriarCampanha} className="form-inline form-empilhado">
              <label>
                Nome da campanha
                <input value={nomeCampanha} onChange={(e) => setNomeCampanha(e.target.value)} required autoFocus />
              </label>
              <label>
                Descrição (opcional)
                <textarea
                  value={descricaoCampanha}
                  onChange={(e) => setDescricaoCampanha(e.target.value)}
                  rows={2}
                />
              </label>
            </form>
            <div className="popup-acoes">
              <button type="submit" form="form-criar-campanha-global" disabled={criandoCampanha}>
                {criandoCampanha ? 'Criando...' : 'Criar e abrir campanha'}
              </button>
              <button type="button" className="botao-secundario" onClick={() => setModalCampanha(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}