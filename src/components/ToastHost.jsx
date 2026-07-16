import { useEffect, useState } from 'react';
import { ouvirToasts } from '../lib/toastBus.js';

// Host do sistema de toast (13/07) — montado uma vez em App.jsx, fora
// das rotas, pra funcionar em qualquer tela. Cada toast some sozinho
// depois de ~2.5s. `tipo`: 'sucesso' (padrão) ou 'erro' (cor
// diferente, fica um pouco mais).
export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return ouvirToasts((toast) => {
      setToasts((atual) => [...atual, toast]);
      const duracao = toast.tipo === 'erro' ? 4000 : 2500;
      setTimeout(() => {
        setToasts((atual) => atual.filter((t) => t.id !== toast.id));
      }, duracao);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tipo}`}>
          {t.mensagem}
        </div>
      ))}
    </div>
  );
}