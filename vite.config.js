import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config padrão do Vite + React.
// Nada específico do Supabase aqui: as chaves vêm de variáveis
// de ambiente (VITE_...), lidas em src/lib/supabaseClient.js
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
