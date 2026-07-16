// Barramento de toast (13/07) — bem simples de propósito: sem Context/
// Provider, só um "publish/subscribe" global. Evita ter que embrulhar o
// app inteiro num Provider novo só pra um aviso de "Salvo". Quem quer
// mostrar um toast chama `mostrarToast(...)` de qualquer lugar;
// `<ToastHost/>` (montado uma vez em App.jsx) escuta e renderiza.
let ouvintes = [];

export function mostrarToast(mensagem, tipo = 'sucesso') {
  const toast = { id: `${Date.now()}-${Math.random()}`, mensagem, tipo };
  ouvintes.forEach((fn) => fn(toast));
}

export function ouvirToasts(fn) {
  ouvintes.push(fn);
  return () => {
    ouvintes = ouvintes.filter((f) => f !== fn);
  };
}