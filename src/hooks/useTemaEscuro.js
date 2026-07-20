import { useEffect, useState } from 'react';

const CHAVE = 'sacramento-tema-mestre';

// Tema escuro (13/07, revisado — virou global por pedido: antes só
// existia nas telas do Mestre, chamado uma vez em cada uma; agora é
// chamado UMA ÚNICA VEZ em App.jsx, então persiste em toda navegação
// (Painel, ficha, campanha, combate — tudo) até o usuário apagar ou
// trocar de volta. Lembrado por navegador via localStorage (esse é um
// app de verdade rodando no navegador do usuário, não um artefato do
// Claude — aqui localStorage funciona normalmente).
//
// Aplica a classe `.tema-escuro` no <body> inteiro (o fundo/textura da
// página é pintado no body). Como todo o CSS já usa var(--cor-x) em
// vez de cor fixa, o tema se aplica sozinho em tudo sem precisar
// duplicar nenhuma regra.
export function useTemaEscuro() {
  const [temaEscuro, setTemaEscuro] = useState(() => {
    try {
      return localStorage.getItem(CHAVE) === 'escuro';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.body.classList.toggle('tema-escuro', temaEscuro);
    try {
      localStorage.setItem(CHAVE, temaEscuro ? 'escuro' : 'claro');
    } catch {
      // localStorage bloqueado (modo privado, etc.) — sem problema,
      // só não persiste entre sessões.
    }
    return () => document.body.classList.remove('tema-escuro');
  }, [temaEscuro]);

  return [temaEscuro, () => setTemaEscuro((atual) => !atual)];
}