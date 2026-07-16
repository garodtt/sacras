import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { criarPersonagem, criarCampanha, listarConvitesPendentes } from '../../lib/dados.js';
import MenuLateral from './MenuLateral.jsx';
import BotaoHamburguer from './BotaoHamburguer.jsx';
import EstrelaXerife from '../EstrelaXerife.jsx';

// Casca comum das 3 telas do Painel (Painel.jsx "tela inicial",
// PainelPersonagens.jsx, PainelCampanhas.jsx) — 13/07, reestruturação
// pro celular: em vez de tudo numa página só rolando, cada área vira
// sua própria tela, navegável pelo menu lateral. "Criar Personagem"
// e "Criar Campanha" viram popups em vez de formulário sempre visível
// — depois de criar, já navega pra ficha/campanha nova, igual antes.
//
// 13/07 (2ª rodada): "Sair" saiu do cabeçalho — só aparece na tela
// inicial (Painel.jsx) agora, junto com foto/nome/e-mail, por pedido.
//
// 13/07 (3ª rodada, correção): tirar "Editar Perfil" do menu quebrou o
// acesso a essa informação de qualquer tela que não fosse a inicial —
// "Perfil" voltou ao menu (aponta pra /painel, mesma rota da tela
// inicial) especificamente por causa disso.
export default function PainelShell({ children }) {
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

  // Badge de convite pendente no ícone do menu (13/07) — sem isso, só
  // dava pra descobrir que chegou convite entrando no Painel. Busca só
  // a contagem (não a lista — quem quer agir vai no Painel mesmo).
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
    <div className="painel-shell">
      <header className="painel-shell-header">
        <BotaoHamburguer onClick={() => setMenuAberto(true)} badge={temConvitePendente} />
        <h1>
          <EstrelaXerife />
          Sacramento RPG
        </h1>
      </header>

      <MenuLateral aberto={menuAberto} onFechar={() => setMenuAberto(false)} titulo="Menu" itens={itensMenu} />

      <div className="painel-shell-conteudo">{children}</div>
      <p className="marca-sacramento">Sacramento</p>

      {modalPersonagem && (
        <div className="popup-fundo" onClick={() => setModalPersonagem(false)}>
          <div className="popup-caixa" onClick={(e) => e.stopPropagation()}>
            <h3>Criar personagem</h3>
            {erroPersonagem && <p className="erro">{erroPersonagem}</p>}
            <form id="form-criar-personagem" onSubmit={handleCriarPersonagem} className="form-inline">
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
              <button type="submit" form="form-criar-personagem" disabled={criandoPersonagem}>
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
            <form id="form-criar-campanha" onSubmit={handleCriarCampanha} className="form-inline form-empilhado">
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
              <button type="submit" form="form-criar-campanha" disabled={criandoCampanha}>
                {criandoCampanha ? 'Criando...' : 'Criar e abrir campanha'}
              </button>
              <button type="button" className="botao-secundario" onClick={() => setModalCampanha(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}