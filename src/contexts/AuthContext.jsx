import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!ativo) return;
      setSession(session);
      if (session) carregarProfile(session.user.id);
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) carregarProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function carregarProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) console.error('Erro ao carregar profile:', error.message);
    setProfile(data ?? null);
    setLoading(false);
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    role: profile?.role ?? null,
    loading,

    // 13/07 — usado depois de editar nome/foto em EditarPerfil.jsx, pra
    // o resto do app (ex.: "Bem-vindo, X" no Painel) já refletir sem
    // precisar de F5.
    refreshProfile: () => (session ? carregarProfile(session.user.id) : Promise.resolve()),

    signUp: ({ email, password, displayName }) =>
      supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      }),

    signIn: ({ email, password }) =>
      supabase.auth.signInWithPassword({ email, password }),

    signOut: () => supabase.auth.signOut(),

    // envia e-mail com link de redefinição de senha
    resetPassword: (email) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      }),

    // usado na tela que o link do e-mail acima abre
    updatePassword: (novaSenha) =>
      supabase.auth.updateUser({ password: novaSenha }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa ser usado dentro de <AuthProvider>');
  return ctx;
}