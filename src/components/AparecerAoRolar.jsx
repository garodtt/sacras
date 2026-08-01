import { motion } from 'motion/react';

// Efeito de "aparecer ao rolar" (13/07) — componente reutilizável:
// o conteúdo entra com um leve deslize + fade quando rola até ficar
// visível na tela, uma vez só (`viewport={{ once: true }}` — não fica
// repetindo toda vez que rola pra cima/baixo passando pelo mesmo
// ponto). `atraso` permite escalonar uma LISTA de itens (cada um
// aparecendo um pouquinho depois do anterior), passando o índice do
// item multiplicado por um valor pequeno (ex.: `atraso={indice * 0.05}`).
// `tag` escolhe o elemento renderizado (ex.: "li" pra funcionar dentro
// de uma <ul>, mantendo o CSS que depende do elemento ser um <li> de
// verdade) — por padrão "div".
export default function AparecerAoRolar({ children, atraso = 0, className, tag = 'div' }) {
  const Elemento = motion[tag];
  return (
    <Elemento
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, delay: atraso, ease: 'easeOut' }}
    >
      {children}
    </Elemento>
  );
}