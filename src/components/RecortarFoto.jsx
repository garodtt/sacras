import { useEffect, useRef, useState } from 'react';

// Recorte de foto estilo Instagram (13/07) — arrasta pra posicionar,
// range de zoom pra aproximar. Sempre um quadro quadrado (o formato
// usado em todo canto do app: retrato, item, perfil). Confirmar desenha
// só a região visível no quadro num <canvas> de saída (`tamanhoSaida`
// px) e devolve um Blob JPEG — quem chamou (UploadFoto.jsx) cuida do
// upload.
//
// Zoom "1" = a imagem cobre o quadro inteiro pelo lado mais curto (nem
// sobra nem falta) — igual o "cover" de CSS, só que ajustável. O
// arraste é travado (`clamp`) pra nunca deixar espaço vazio aparecer
// dentro do quadro.
const QUADRO_PX = 260;

export default function RecortarFoto({ arquivo, tamanhoSaida = 400, onCancelar, onConfirmar }) {
  const [imgUrl, setImgUrl] = useState('');
  const [imgNatural, setImgNatural] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const inicioRef = useRef({ x: 0, y: 0 });
  const imgRef = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(arquivo);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  const escalaBase = imgNatural.width && imgNatural.height ? QUADRO_PX / Math.min(imgNatural.width, imgNatural.height) : 1;
  const escalaFinal = escalaBase * zoom;

  function limitarPos(novoPos, escala) {
    const largura = imgNatural.width * escala;
    const altura = imgNatural.height * escala;
    const maxX = Math.max(0, (largura - QUADRO_PX) / 2);
    const maxY = Math.max(0, (altura - QUADRO_PX) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, novoPos.x)),
      y: Math.min(maxY, Math.max(-maxY, novoPos.y)),
    };
  }

  function handleImgLoad(e) {
    setImgNatural({ width: e.target.naturalWidth, height: e.target.naturalHeight });
  }

  function handleZoom(novoZoom) {
    setZoom(novoZoom);
    setPos((atual) => limitarPos(atual, escalaBase * novoZoom));
  }

  function iniciarArraste(clientX, clientY) {
    setArrastando(true);
    inicioRef.current = { x: clientX - pos.x, y: clientY - pos.y };
  }

  function moverArraste(clientX, clientY) {
    if (!arrastando) return;
    const novo = { x: clientX - inicioRef.current.x, y: clientY - inicioRef.current.y };
    setPos(limitarPos(novo, escalaFinal));
  }

  function pararArraste() {
    setArrastando(false);
  }

  async function confirmar() {
    setEnviando(true);
    const canvas = document.createElement('canvas');
    canvas.width = tamanhoSaida;
    canvas.height = tamanhoSaida;
    const ctx = canvas.getContext('2d');

    const fator = tamanhoSaida / QUADRO_PX;
    const larguraDesenhada = imgNatural.width * escalaFinal * fator;
    const alturaDesenhada = imgNatural.height * escalaFinal * fator;
    const offsetX = tamanhoSaida / 2 + pos.x * fator - larguraDesenhada / 2;
    const offsetY = tamanhoSaida / 2 + pos.y * fator - alturaDesenhada / 2;

    ctx.drawImage(imgRef.current, offsetX, offsetY, larguraDesenhada, alturaDesenhada);
    canvas.toBlob(
      (blob) => {
        setEnviando(false);
        if (blob) onConfirmar(blob);
      },
      'image/jpeg',
      0.9
    );
  }

  return (
    <div className="popup-fundo" onClick={onCancelar}>
      <div className="popup-caixa recorte-caixa" onClick={(e) => e.stopPropagation()}>
        <h3>Ajustar foto</h3>
        <p className="detalhe-secundario">Arraste pra posicionar, use o zoom pra aproximar.</p>

        <div
          className="recorte-quadro"
          style={{ width: QUADRO_PX, height: QUADRO_PX }}
          onMouseDown={(e) => iniciarArraste(e.clientX, e.clientY)}
          onMouseMove={(e) => moverArraste(e.clientX, e.clientY)}
          onMouseUp={pararArraste}
          onMouseLeave={pararArraste}
          onTouchStart={(e) => iniciarArraste(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={(e) => {
            e.preventDefault();
            moverArraste(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onTouchEnd={pararArraste}
        >
          {imgUrl && (
            <img
              ref={imgRef}
              src={imgUrl}
              alt=""
              onLoad={handleImgLoad}
              className="recorte-imagem"
              style={{ transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${escalaFinal})` }}
              draggable={false}
            />
          )}
        </div>

        <label className="recorte-zoom">
          Zoom
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => handleZoom(Number(e.target.value))}
          />
        </label>

        <div className="popup-acoes">
          <button type="button" onClick={confirmar} disabled={enviando || !imgUrl}>
            {enviando ? 'Enviando...' : 'Confirmar'}
          </button>
          <button type="button" className="botao-secundario" onClick={onCancelar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}