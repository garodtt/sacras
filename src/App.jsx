import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Login from './routes/Login.jsx';
import Cadastro from './routes/Cadastro.jsx';
import EsqueciSenha from './routes/EsqueciSenha.jsx';
import RedefinirSenha from './routes/RedefinirSenha.jsx';
import Painel from './routes/Painel.jsx';
import PainelPersonagens from './routes/PainelPersonagens.jsx';
import PainelCampanhas from './routes/PainelCampanhas.jsx';
import CampanhaDetalhe from './routes/CampanhaDetalhe.jsx';
import Combate from './routes/Combate.jsx';
import Personagem from './routes/Personagem.jsx';
import AdminDashboard from './routes/AdminDashboard.jsx';
import ToastHost from './components/ToastHost.jsx';
import { TemaProvider } from './contexts/TemaContext.jsx';

// v2 (13/07): não existe mais separação Mestre/Jogador nem rota
// "roteadora" por papel (PainelRedirect saiu) — todo usuário autenticado
// cai no mesmo /painel. Só o Admin tem uma rota extra (/admin).

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
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />

            <Route
              path="/painel"
              element={
                <ProtectedRoute>
                  <Painel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/painel/personagens"
              element={
                <ProtectedRoute>
                  <PainelPersonagens />
                </ProtectedRoute>
              }
            />
            <Route
              path="/painel/campanhas"
              element={
                <ProtectedRoute>
                  <PainelCampanhas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/campanha/:id"
              element={
                <ProtectedRoute>
                  <CampanhaDetalhe />
                </ProtectedRoute>
              }
            />
            <Route
              path="/campanha/:id/combate"
              element={
                <ProtectedRoute>
                  <Combate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/personagem/:id"
              element={
                <ProtectedRoute>
                  <Personagem />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Painel />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TemaProvider>
    </AuthProvider>
  );
}