import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import RotasAnimadas from './components/RotasAnimadas.jsx';
import ToastHost from './components/ToastHost.jsx';
import { TemaProvider } from './contexts/TemaContext.jsx';

// v2 (13/07): não existe mais separação Mestre/Jogador nem rota
// "roteadora" por papel (PainelRedirect saiu) — todo usuário autenticado
// cai no mesmo /painel. Só o Admin tem uma rota extra (/admin).
//
// 13/07 (2ª rodada): a definição das rotas em si saiu daqui e virou
// RotasAnimadas.jsx — precisa estar DENTRO do BrowserRouter pra poder
// usar useLocation() (base da transição de tela estilo cortina).

export default function App() {

  // 13/07 — corrige "tela presa" ao voltar no celular: o Safari/Chrome
  // mobile às vezes restaura uma "foto" congelada da página anterior em
  // vez de deixar o React renderizar de novo (bfcache — back/forward
  // cache do navegador). `pageshow` com `event.persisted = true` avisa
  // exatamente isso; a saída mais confiável é recarregar de verdade.
  // Sem isso, o sintoma é: voltar de uma ficha mostra conteúdo antigo,
  // só corrige na segunda tentativa (a segunda navegação não usa o
  // cache congelado).
  useEffect(() => {
    function handlePageShow(event) {
      if (event.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);
  return (
    <AuthProvider>
      <TemaProvider>
        <ToastHost />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <RotasAnimadas />
        </BrowserRouter>
      </TemaProvider>
    </AuthProvider>
  );
}