import { useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import ProtectedRoute from './ProtectedRoute.jsx';

import Login from '../routes/Login.jsx';
import Cadastro from '../routes/Cadastro.jsx';
import EsqueciSenha from '../routes/EsqueciSenha.jsx';
import RedefinirSenha from '../routes/RedefinirSenha.jsx';
import Painel from '../routes/Painel.jsx';
import PainelPersonagens from '../routes/PainelPersonagens.jsx';
import PainelCampanhas from '../routes/PainelCampanhas.jsx';
import CampanhaDetalhe from '../routes/CampanhaDetalhe.jsx';
import Combate from '../routes/Combate.jsx';
import Personagem from '../routes/Personagem.jsx';
import AdminDashboard from '../routes/AdminDashboard.jsx';

// Transição de tela estilo "cortina" (13/07) — inspirado num exemplo
// pago da biblioteca Motion (motion.dev/examples/react-curtains-scope,
// exclusivo de assinantes Motion+, sem código fonte público);
// reconstruído aqui só com a API gratuita/de código aberto da mesma
// biblioteca (`motion`, sucessora do Framer Motion).
//
// Duas partes trabalhando juntas:
// 1. `AnimatePresence mode="wait"` + `<Routes location={location}
//    key={location.pathname}>` — o padrão oficial de integração
//    Motion + React Router: espera a tela ANTIGA terminar de sumir
//    antes de montar a NOVA (sem isso, as duas ficam sobrepostas
//    brevemente, uma "pulando" por cima da outra).
// 2. `.cortina-transicao` — um retângulo sólido (cor da tinta do
//    tema) que cobre a tela inteira e imediatamente "sobe" (encolhe
//    a partir do topo, como uma cortina de teatro/porta de saloon
//    batendo com o tema faroeste do site) toda vez que a rota muda.
//    Roda de forma independente da troca de conteúdo em si — não
//    trava a navegação esperando a cortina terminar de subir.
export default function RotasAnimadas() {
  const location = useLocation();

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: 'easeInOut' }}
        >
          <Routes location={location}>
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
        </motion.div>
      </AnimatePresence>

      <motion.div
        key={`${location.pathname}-cortina`}
        className="cortina-transicao"
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
      />
    </>
  );
}