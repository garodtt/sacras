import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA (13/07) — registra o service worker (public/sw.js) depois da
// página carregar, pra não competir por rede com o carregamento
// inicial. Só cacheia o esqueleto do app (ver sw.js) — dado de jogo
// nunca fica em cache.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Falha silenciosa de propósito — sem service worker o app
      // continua funcionando normalmente, só sem o benefício de abrir
      // instalado/offline.
    });
  });
}