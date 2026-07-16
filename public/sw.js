// Service worker (13/07) — "PWA/offline básico" pedido. Importante
// entender o alcance real disso: só o ESQUELETO do app (HTML/CSS/JS,
// pra abrir instalado e a tela aparecer mesmo sem internet) é
// cacheado — os DADOS (fichas, campanhas, combate) vêm sempre do
// Supabase ao vivo, nunca ficam em cache. Um jogo de mesa em grupo não
// pode arriscar mostrar Vida/Dor desatualizados por causa de cache;
// por isso a estratégia é deliberadamente conservadora: cache-first só
// pros arquivos estáticos, network-only pra tudo que é API/dado.
//
// Isso NÃO é "editar a ficha sem internet e sincronizar depois" — isso
// exigiria fila de sincronização, resolução de conflito, etc., um
// projeto bem maior. Aqui é só "o app abre e mostra a tela mesmo numa
// mesa sem wi-fi", que já é o problema mais comum citado.
const CACHE_NOME = 'sacramento-rpg-v1';

const ARQUIVOS_ESSENCIAIS = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.addAll(ARQUIVOS_ESSENCIAIS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE_NOME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca cachear chamadas de API (Supabase e qualquer domínio externo)
  // nem métodos que não sejam GET — dado de jogo é sempre ao vivo.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Arquivos estáticos do próprio app (JS/CSS/fontes/ícones/HTML):
  // cache-first, com atualização em segundo plano (stale-while-
  // revalidate) — abre rápido e ainda pega versão nova na próxima vez.
  event.respondWith(
    caches.match(event.request).then((resposta) => {
      const buscaRede = fetch(event.request)
        .then((respostaRede) => {
          if (respostaRede && respostaRede.status === 200) {
            const clone = respostaRede.clone();
            caches.open(CACHE_NOME).then((cache) => cache.put(event.request, clone));
          }
          return respostaRede;
        })
        .catch(() => resposta); // sem rede: usa o que tiver em cache

      return resposta || buscaRede;
    })
  );
});