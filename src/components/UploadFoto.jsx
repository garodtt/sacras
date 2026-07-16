import { useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import RecortarFoto from './RecortarFoto.jsx';
import PopupConfirmar from './PopupConfirmar.jsx';

// Upload de foto reutilizável (13/07, revisado) — usado pro retrato do
// personagem, foto de item, e foto de perfil. Cada um manda um
// `caminho` diferente (sem extensão — sempre vira .jpg depois do
// recorte), dentro do bucket público "fotos":
//   personagem/{personagemId}/retrato
//   personagem/{personagemId}/item-{itemId}
//   perfil/{userId}/foto
// (RLS do Storage, migration 0009, decide quem pode escrever em cada
// pasta — ver docs/ARQUITETURA.md.)
//
// Revisão de interação: antes tinha um texto "Escolher foto"/"Trocar
// foto" sempre visível do lado do quadro. Agora o quadro/foto em si é
// clicável e abre um menu pequeno (Ver grande / Adicionar ou Trocar /
// Remover) — sem texto ocupando espaço, sobra mais lugar pro quadro em
// si (mais fácil de acertar o dedo no celular também). Escolher um
// arquivo novo abre o recorte estilo Instagram (RecortarFoto.jsx —
// arrastar + zoom) antes de subir, em vez de redimensionar sozinho sem
// o usuário poder ajustar o enquadramento.
export default function UploadFoto({
  caminho,
  fotoAtual,
  onSalvar,
  editavel,
  alt = 'Foto',
  variante = 'quadrada',
  tamanhoMaximoPx = 400,
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [verGrande, setVerGrande] = useState(false);
  const [arquivoParaRecortar, setArquivoParaRecortar] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmandoRemover, setConfirmandoRemover] = useState(false);
  const inputRef = useRef(null);

  function handleCliqueFoto() {
    if (editavel) setMenuAberto(true);
    else if (fotoAtual) setVerGrande(true);
  }

  function abrirSeletorArquivo() {
    setMenuAberto(false);
    inputRef.current?.click();
  }

  function handleArquivoEscolhido(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;

    if (!arquivo.type.startsWith('image/')) {
      setErro('Escolha um arquivo de imagem.');
      return;
    }
    if (arquivo.size > 15 * 1024 * 1024) {
      setErro('Imagem muito grande — máximo 15MB.');
      return;
    }
    setErro('');
    setArquivoParaRecortar(arquivo);
  }

  async function handleRecorteConfirmado(blob) {
    setArquivoParaRecortar(null);
    setEnviando(true);

    const caminhoCompleto = `${caminho}.jpg`;
    const { error: erroUpload } = await supabase.storage
      .from('fotos')
      .upload(caminhoCompleto, blob, { upsert: true, contentType: 'image/jpeg' });

    if (erroUpload) {
      setErro(erroUpload.message);
      setEnviando(false);
      return;
    }

    const { data } = supabase.storage.from('fotos').getPublicUrl(caminhoCompleto);
    await onSalvar(`${data.publicUrl}?t=${Date.now()}`);
    setEnviando(false);
  }

  async function remover() {
    setConfirmandoRemover(false);
    setErro('');
    // Apaga o arquivo de verdade do bucket também — só limpar o campo
    // no banco deixava o arquivo antigo "órfão" ocupando espaço à toa
    // no Storage pra sempre. Falha silenciosa aqui (só loga) porque o
    // mais importante — limpar o campo — não deve travar por causa
    // disso; um arquivo remanescente sem dono não é grave, só feio.
    const extensoes = ['jpg', 'jpeg', 'png', 'webp'];
    await supabase.storage.from('fotos').remove(extensoes.map((ext) => `${caminho}.${ext}`));
    await onSalvar(null);
  }

  return (
    <div className={`upload-foto upload-foto--${variante}`}>
      <button
        type="button"
        className="upload-foto-clicavel"
        onClick={handleCliqueFoto}
        disabled={enviando}
        aria-label={fotoAtual ? `Opções da foto de ${alt}` : `Adicionar foto de ${alt}`}
      >
        {fotoAtual ? (
          <div className="upload-foto-preview" style={{ backgroundImage: `url("${fotoAtual}")` }} role="img" aria-label={alt} />
        ) : (
          <div className="upload-foto-placeholder">{enviando ? '...' : editavel ? '+' : 'Sem foto'}</div>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleArquivoEscolhido} hidden />
      {erro && <p className="erro">{erro}</p>}

      {menuAberto && (
        <div className="popup-fundo" onClick={() => setMenuAberto(false)}>
          <div className="popup-caixa popup-caixa--menu" onClick={(e) => e.stopPropagation()}>
            <h3>Foto</h3>
            <div className="menu-acoes-foto">
              {fotoAtual && (
                <button type="button" onClick={() => { setMenuAberto(false); setVerGrande(true); }}>
                  Ver em tamanho grande
                </button>
              )}
              <button type="button" onClick={abrirSeletorArquivo}>
                {fotoAtual ? 'Trocar foto' : 'Adicionar foto'}
              </button>
              {fotoAtual && (
                <button
                  type="button"
                  className="botao-remover"
                  onClick={() => {
                    setMenuAberto(false);
                    setConfirmandoRemover(true);
                  }}
                >
                  Remover foto
                </button>
              )}
            </div>
            <button type="button" className="botao-secundario" onClick={() => setMenuAberto(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {verGrande && fotoAtual && (
        <div className="popup-fundo" onClick={() => setVerGrande(false)}>
          <img src={fotoAtual} alt={alt} className="upload-foto-visualizacao-grande" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {arquivoParaRecortar && (
        <RecortarFoto
          arquivo={arquivoParaRecortar}
          tamanhoSaida={tamanhoMaximoPx}
          onCancelar={() => setArquivoParaRecortar(null)}
          onConfirmar={handleRecorteConfirmado}
        />
      )}

      <PopupConfirmar
        aberto={confirmandoRemover}
        mensagem="Remover esta foto?"
        onConfirmar={remover}
        onCancelar={() => setConfirmandoRemover(false)}
      />
    </div>
  );
}