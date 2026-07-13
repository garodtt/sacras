// Regras de jogo (Fase 6). Por enquanto só a mecânica de Vida/Dor
// documentada em docs/ARQUITETURA.md, seção 5 (reconstruída do projeto
// antigo) e confirmada pelo usuário em 13/07. Função pura — não fala com
// o Supabase, só calcula; quem chama decide o que persistir.

// Aplica `dano` pontos contra a Dor. Regra ("quebra de resistência"):
// Dor desce a cada ponto de dano; ao chegar a 0 (ou menos), ela volta ao
// máximo e a Vida desce 1. Se o dano for grande o bastante pra quebrar
// mais de uma vez de uma tacada só, repete até o dano acabar ou a Vida
// chegar a 0 (não desce abaixo disso — ver seção 5, "quando Vida chega a
// 0, o personagem é marcado como 'caído'"; aqui devolvemos esse estado
// como booleano `caido`, derivado, sem precisar de coluna nova no banco).
export function aplicarDano({ vidaAtual, vidaMax, dorAtual, dorMax, dano }) {
  let vida = vidaAtual;
  let dor = dorAtual;
  let restante = Math.max(0, Math.floor(Number(dano) || 0));
  let quebras = 0;

  while (restante > 0 && vida > 0) {
    if (restante < dor) {
      dor -= restante;
      restante = 0;
    } else {
      restante -= dor;
      dor = dorMax;
      vida -= 1;
      quebras += 1;
    }
  }

  vida = Math.max(0, Math.min(vidaMax, vida));

  return { vidaAtual: vida, dorAtual: dor, quebras, caido: vida <= 0 };
}

// ---------------------------------------------------------------------
// Estatísticas derivadas dos Atributos (confirmado 13/07):
//   Físico     -> +1 no máximo de Vida (base 6)
//   Velocidade -> +1 Movimento (base 1)
//   Coragem    -> +1 Ação de Combate (base 1)
//   Intelecto  -> +1 no orçamento de Antecedentes (base 4) — isso
//                 continua calculado só na tela (não é um campo único
//                 pra persistir, já que são 8 antecedentes separados).
// Bases vêm de "Condições iniciais" (docs/ARQUITETURA.md, seção 4).
// ---------------------------------------------------------------------
const BASE_VIDA = 6;
const BASE_MOVIMENTOS = 1;
const BASE_ACOES_COMBATE = 1;

// Físico (personagem) e Resistência (montaria) usam a mesma fórmula —
// "vida e dor do cavalo igual do jogador" (13/07).
export function calcularVidaMaxDeAtributo(valorAtributo) {
  return BASE_VIDA + Number(valorAtributo || 0);
}

export function calcularStatsDerivados({ atributo_fisico, atributo_velocidade, atributo_coragem }) {
  return {
    circulos_vida_max: calcularVidaMaxDeAtributo(atributo_fisico),
    movimentos: BASE_MOVIMENTOS + Number(atributo_velocidade || 0),
    acoes_combate: BASE_ACOES_COMBATE + Number(atributo_coragem || 0),
  };
}

// Quando um "máximo" muda (por atributo ou pelo +/- manual), o "atual"
// acompanha a DIFERENÇA — sobe junto (ganhou vida máxima, ganha vida) e
// nunca fica acima do novo máximo nem abaixo de 0.
export function ajustarComMaximo({ maxAntigo, maxNovo, atual }) {
  const delta = maxNovo - maxAntigo;
  return Math.max(0, Math.min(maxNovo, atual + delta));
}

// Ajuste simples de +/-1 (ou qualquer delta) no valor ATUAL — não mexe
// no máximo, não aciona a regra de quebra de resistência. Usado pro
// ferimento direto na Vida (bypassa a Dor por completo) e pra cura de
// Dor (Dor subindo não desfaz uma quebra que já aconteceu).
export function ajustarValorSimples({ atual, max, delta }) {
  return Math.max(0, Math.min(max, atual + delta));
}

// ---------------------------------------------------------------------
// Espaço da Montaria: 10 (padrão) + bolsa de montaria (+15) + carro
// (+20) ou carroça (+30) — carro/carroça são mutuamente exclusivos,
// mas qualquer um dos dois pode vir junto com a bolsa.
// ---------------------------------------------------------------------
const ESPACO_MONTARIA_PADRAO = 10;
const ESPACO_BOLSA = 15;
const ESPACO_CARRO = 20;
const ESPACO_CARROCA = 30;

export function calcularEspacoMontaria({ tem_bolsa, tipo_carga }) {
  let espaco = ESPACO_MONTARIA_PADRAO;
  if (tem_bolsa) espaco += ESPACO_BOLSA;
  if (tipo_carga === 'carro') espaco += ESPACO_CARRO;
  if (tipo_carga === 'carroca') espaco += ESPACO_CARROCA;
  return espaco;
}

// ---------------------------------------------------------------------
// Munição — capacidade de cada pool de reserva vem dos itens do tipo
// certo (coldre = leve, bandoleira = pesada), multiplicando pela
// quantidade (2 coldres = 72 balas leves de capacidade).
// ---------------------------------------------------------------------
const BALAS_POR_COLDRE = 36;
const BALAS_POR_BANDOLEIRA = 24;

export function calcularCapacidadeMunicao(itens) {
  let leve = 0;
  let pesada = 0;
  for (const item of itens) {
    if (item.tipo_carregador === 'coldre') leve += BALAS_POR_COLDRE * (item.quantidade || 1);
    if (item.tipo_carregador === 'bandoleira') pesada += BALAS_POR_BANDOLEIRA * (item.quantidade || 1);
  }
  return { leve, pesada };
}

// Recarrega uma arma a partir do pool de reserva (leve ou pesada,
// conforme weapons.categoria). Só pega o que existir no pool — se
// faltar bala pra encher, carrega parcial e o pool zera (ex. arma
// cabe 6, pool tem 4: arma fica com 4, pool fica 0).
export function aplicarRecarga({ municaoAtual, municaoMax, poolAtual }) {
  const faltam = Math.max(0, municaoMax - municaoAtual);
  const pegar = Math.min(faltam, poolAtual);
  return { municaoAtual: municaoAtual + pegar, poolAtual: poolAtual - pegar };
}