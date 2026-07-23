import { createContext, useContext } from 'react';
import { useTemaEscuro } from '../hooks/useTemaEscuro.js';

// Context de tema (13/07, correção de bug real) — antes App.jsx e
// Painel.jsx chamavam `useTemaEscuro()` CADA UM a própria vez, duas
// instâncias independentes do mesmo hook. Cada instância tem sua
// própria limpeza (`return () => document.body.classList.remove(...)`)
// que roda quando o COMPONENTE DESMONTA. Painel.jsx desmonta toda vez
// que você navega pra outra tela — nesse momento, a limpeza da
// instância DELE apagava a classe `.tema-escuro` do body, mesmo a
// instância de App.jsx (que nunca desmonta) ainda querendo o tema
// escuro ligado. Resultado: o tema "só mudava" enquanto você estava
// literalmente na tela de Perfil, e voltava sozinho ao sair.
//
// Corrigido com Context: o hook roda UMA ÚNICA VEZ (dentro de
// TemaProvider, montado em App.jsx, que nunca desmonta). Qualquer tela
// que precisar ler ou alternar o tema usa `useTema()` — que só LÊ o
// valor do Context, sem ter o próprio efeito/limpeza, então montar ou
// desmontar uma tela normal (Painel, ficha, campanha) nunca mexe na
// classe do body.
const TemaContext = createContext(null);

export function TemaProvider({ children }) {
  const [temaEscuro, alternarTemaEscuro] = useTemaEscuro();
  return <TemaContext.Provider value={{ temaEscuro, alternarTemaEscuro }}>{children}</TemaContext.Provider>;
}

export function useTema() {
  const contexto = useContext(TemaContext);
  if (!contexto) {
    throw new Error('useTema() só funciona dentro de <TemaProvider> (ver App.jsx)');
  }
  return contexto;
}