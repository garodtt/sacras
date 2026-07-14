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

// Igual calcularEspacoMontaria, mas detalhado por sub-local — cada um
// com seu próprio limite (não é mais um pool só). Só entram os
// sub-locais que a montaria realmente tem equipado (13/07: "é
// importante contar o peso dos itens separados, porque existe a opção
// de eu largar a bolsa e quero saber exatamente o que tinha nela").
export function capacidadesPorLocalMontaria({ tem_bolsa, tipo_carga }) {
  const capacidades = { cavalo: ESPACO_MONTARIA_PADRAO };
  if (tem_bolsa) capacidades.bolsa = ESPACO_BOLSA;
  if (tipo_carga === 'carro') capacidades.carro = ESPACO_CARRO;
  if (tipo_carga === 'carroca') capacidades.carroca = ESPACO_CARROCA;
  return capacidades;
}

// ---------------------------------------------------------------------
// Munição (13/07 — revisado). Cada ARMA tem um `meio_transporte`
// (coldre/bandoleira/bainha) — isso decide de qual pool ela recarrega
// E quanta capacidade de reserva aquilo dá (1 arma no coldre = +36
// balas leves de capacidade; 1 na bandoleira = +24 pesadas; bainha é
// arma branca, sem munição). Não são mais itens separados — a arma já
// "traz" o coldre/bandoleira junto.
//
// Limites (validados aqui, aplicados na hora de escolher o meio de
// transporte de uma arma): no máximo 2 em bandoleira, no máximo 4
// somando coldre+bandoleira, no máximo 1 em bainha.
// ---------------------------------------------------------------------
const BALAS_POR_COLDRE = 36;
const BALAS_POR_BANDOLEIRA = 24;
const PESO_BALA_LEVE = 0.08;
const PESO_BALA_PESADA = 0.25;

export const LIMITE_BANDOLEIRA = 2;
export const LIMITE_COLDRE_MAIS_BANDOLEIRA = 4;
export const LIMITE_BAINHA = 1;

export function calcularCapacidadeMunicaoDeArmas(armas) {
  let leve = 0;
  let pesada = 0;
  for (const arma of armas) {
    if (arma.meio_transporte === 'coldre') leve += BALAS_POR_COLDRE;
    if (arma.meio_transporte === 'bandoleira') pesada += BALAS_POR_BANDOLEIRA;
  }
  return { leve, pesada };
}

// Confere se dá pra atribuir `novoMeio` a uma arma sem estourar os
// limites, olhando as OUTRAS armas (exclui a que está sendo editada).
// Devolve null se pode, ou uma mensagem de erro se não pode.
export function validarMeioTransporte(armas, armaId, novoMeio) {
  if (!novoMeio) return null;

  const outras = armas.filter((a) => a.id !== armaId);
  const coldres = outras.filter((a) => a.meio_transporte === 'coldre').length;
  const bandoleiras = outras.filter((a) => a.meio_transporte === 'bandoleira').length;
  const bainhas = outras.filter((a) => a.meio_transporte === 'bainha').length;

  if (novoMeio === 'bainha' && bainhas + 1 > LIMITE_BAINHA) {
    return `Bainha cheia — só cabe ${LIMITE_BAINHA} arma.`;
  }
  if (novoMeio === 'bandoleira' && bandoleiras + 1 > LIMITE_BANDOLEIRA) {
    return `Bandoleira cheia — só cabem até ${LIMITE_BANDOLEIRA} armas.`;
  }
  if (
    (novoMeio === 'coldre' || novoMeio === 'bandoleira') &&
    coldres + bandoleiras + 1 > LIMITE_COLDRE_MAIS_BANDOLEIRA
  ) {
    return `Cheio — só cabem até ${LIMITE_COLDRE_MAIS_BANDOLEIRA} armas somando coldre + bandoleira.`;
  }
  return null;
}

// Peso da munição = só o que EXCEDE a capacidade do coldre/bandoleira
// conta no inventário (o que cabe neles não pesa nada a mais — já é
// "parte" da arma). Ex.: 2 coldres = 72 de capacidade; se o campo de
// munição leve tiver 73, só 1 bala pesa (73 − 72 = 1 × 0,08).
export function calcularPesoMunicaoExcedente({ municaoLeveAtual, capacidadeLeve, municaoPesadaAtual, capacidadePesada }) {
  const excedenteLeve = Math.max(0, municaoLeveAtual - capacidadeLeve);
  const excedentePesada = Math.max(0, municaoPesadaAtual - capacidadePesada);
  return excedenteLeve * PESO_BALA_LEVE + excedentePesada * PESO_BALA_PESADA;
}

// Recarrega uma arma a partir do pool de reserva (leve ou pesada,
// conforme weapons.meio_transporte). `quantidade` é quanto tentar pôr
// de uma vez — default Infinity, ou seja "encher até o máximo" (botão
// Recarregar); passe 1 pra um "+1" parcial (bala avulsa, sem precisar
// encher tudo). Sempre travado no que couber na arma E no que existir
// no pool — o menor dos dois vence.
export function aplicarRecarga({ municaoAtual, municaoMax, poolAtual, quantidade = Infinity }) {
  const faltam = Math.max(0, municaoMax - municaoAtual);
  const pegar = Math.min(quantidade, faltam, poolAtual);
  return { municaoAtual: municaoAtual + pegar, poolAtual: poolAtual - pegar };
}