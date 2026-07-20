import { describe, it, expect } from 'vitest';
import {
  aplicarDano,
  calcularVidaMaxDeAtributo,
  calcularStatsDerivados,
  ajustarComMaximo,
  ajustarValorSimples,
  calcularEspacoMontaria,
  capacidadesPorLocalMontaria,
  calcularCapacidadeMunicaoDeArmas,
  validarMeioTransporte,
  calcularPesoMunicaoExcedente,
  aplicarRecarga,
  LIMITE_BANDOLEIRA,
  LIMITE_COLDRE_MAIS_BANDOLEIRA,
  LIMITE_BAINHA,
} from './regras.js';

// 13/07 — primeira leva de testes do projeto. Cobre só `regras.js`
// (funções puras, sem Supabase) — é onde a regra de negócio de
// verdade está concentrada (quebra de resistência, munição, espaço de
// montaria); o resto do app é majoritariamente CRUD + RLS, que testes
// unitários não pegam bem de qualquer jeito (isso é o que a auditoria
// de RLS, feita à parte, cobre).
//
// Rodar com `npx vitest run` (ou `npx vitest` pra modo observador).

describe('aplicarDano', () => {
  it('reduz a Dor direto quando o dano é menor que a Dor atual — não quebra', () => {
    const r = aplicarDano({ vidaAtual: 6, vidaMax: 6, dorAtual: 6, dorMax: 6, dano: 2 });
    expect(r).toEqual({ vidaAtual: 6, dorAtual: 4, quebras: 0, caido: false });
  });

  it('quebra a resistência quando o dano é exatamente igual à Dor atual', () => {
    const r = aplicarDano({ vidaAtual: 6, vidaMax: 6, dorAtual: 3, dorMax: 6, dano: 3 });
    expect(r).toEqual({ vidaAtual: 5, dorAtual: 6, quebras: 1, caido: false });
  });

  it('quebra mais de uma vez numa tacada só se o dano for grande o bastante', () => {
    // Dor max 6, dano 14: 6 (quebra 1) + 6 (quebra 2) + 2 restante na Dor
    const r = aplicarDano({ vidaAtual: 6, vidaMax: 6, dorAtual: 6, dorMax: 6, dano: 14 });
    expect(r).toEqual({ vidaAtual: 4, dorAtual: 4, quebras: 2, caido: false });
  });

  it('marca "caido" quando a Vida chega a 0, e não deixa a Vida ir negativa', () => {
    const r = aplicarDano({ vidaAtual: 1, vidaMax: 6, dorAtual: 1, dorMax: 6, dano: 100 });
    expect(r.vidaAtual).toBe(0);
    expect(r.caido).toBe(true);
  });

  it('para de consumir dano assim que a Vida chega a 0 (não continua "gastando" o resto)', () => {
    const r = aplicarDano({ vidaAtual: 1, vidaMax: 6, dorAtual: 1, dorMax: 6, dano: 3 });
    // 1ª quebra: dor 1->6 (reseta), vida 1->0, restante = 3-1 = 2 — mas para porque vida chegou a 0
    expect(r.vidaAtual).toBe(0);
    expect(r.quebras).toBe(1);
  });

  it('dano 0 não muda nada', () => {
    const r = aplicarDano({ vidaAtual: 6, vidaMax: 6, dorAtual: 4, dorMax: 6, dano: 0 });
    expect(r).toEqual({ vidaAtual: 6, dorAtual: 4, quebras: 0, caido: false });
  });

  it('dano negativo é tratado como 0 (não cura)', () => {
    const r = aplicarDano({ vidaAtual: 6, vidaMax: 6, dorAtual: 4, dorMax: 6, dano: -5 });
    expect(r.dorAtual).toBe(4);
    expect(r.vidaAtual).toBe(6);
  });
});

describe('calcularVidaMaxDeAtributo', () => {
  it('atributo 0 dá a base (6)', () => {
    expect(calcularVidaMaxDeAtributo(0)).toBe(6);
  });

  it('soma o atributo à base', () => {
    expect(calcularVidaMaxDeAtributo(3)).toBe(9);
  });

  it('trata undefined/null como 0', () => {
    expect(calcularVidaMaxDeAtributo(undefined)).toBe(6);
    expect(calcularVidaMaxDeAtributo(null)).toBe(6);
  });
});

describe('calcularStatsDerivados', () => {
  it('calcula os 3 derivados a partir dos atributos', () => {
    const r = calcularStatsDerivados({ atributo_fisico: 2, atributo_velocidade: 1, atributo_coragem: 3 });
    expect(r).toEqual({ circulos_vida_max: 8, movimentos: 2, acoes_combate: 4 });
  });

  it('atributos ausentes contam como 0 (fica só a base)', () => {
    const r = calcularStatsDerivados({});
    expect(r).toEqual({ circulos_vida_max: 6, movimentos: 1, acoes_combate: 1 });
  });
});

describe('ajustarComMaximo', () => {
  it('máximo sobe — o atual acompanha a mesma diferença', () => {
    expect(ajustarComMaximo({ maxAntigo: 6, maxNovo: 8, atual: 6 })).toBe(8);
  });

  it('máximo desce — o atual acompanha (pode ficar menor que o novo máximo)', () => {
    expect(ajustarComMaximo({ maxAntigo: 6, maxNovo: 4, atual: 6 })).toBe(4);
  });

  it('nunca deixa o atual passar do novo máximo', () => {
    expect(ajustarComMaximo({ maxAntigo: 6, maxNovo: 8, atual: 6 })).toBeLessThanOrEqual(8);
  });

  it('nunca deixa o atual ficar negativo', () => {
    expect(ajustarComMaximo({ maxAntigo: 6, maxNovo: 2, atual: 1 })).toBe(0);
  });
});

describe('ajustarValorSimples', () => {
  it('soma o delta normalmente', () => {
    expect(ajustarValorSimples({ atual: 3, max: 6, delta: 1 })).toBe(4);
  });

  it('trava no máximo', () => {
    expect(ajustarValorSimples({ atual: 6, max: 6, delta: 1 })).toBe(6);
  });

  it('trava no 0 (não vai negativo)', () => {
    expect(ajustarValorSimples({ atual: 0, max: 6, delta: -1 })).toBe(0);
  });
});

describe('calcularEspacoMontaria', () => {
  it('só o padrão, sem bolsa nem carga', () => {
    expect(calcularEspacoMontaria({ tem_bolsa: false, tipo_carga: null })).toBe(10);
  });

  it('padrão + bolsa', () => {
    expect(calcularEspacoMontaria({ tem_bolsa: true, tipo_carga: null })).toBe(25);
  });

  it('padrão + carro', () => {
    expect(calcularEspacoMontaria({ tem_bolsa: false, tipo_carga: 'carro' })).toBe(30);
  });

  it('padrão + carroça', () => {
    expect(calcularEspacoMontaria({ tem_bolsa: false, tipo_carga: 'carroca' })).toBe(40);
  });

  it('bolsa + carro juntos (são compatíveis, diferente de carro+carroça)', () => {
    expect(calcularEspacoMontaria({ tem_bolsa: true, tipo_carga: 'carro' })).toBe(45);
  });
});

describe('capacidadesPorLocalMontaria', () => {
  it('só cavalo quando não tem bolsa nem carga', () => {
    expect(capacidadesPorLocalMontaria({ tem_bolsa: false, tipo_carga: null })).toEqual({ cavalo: 10 });
  });

  it('inclui bolsa quando tem_bolsa é true', () => {
    expect(capacidadesPorLocalMontaria({ tem_bolsa: true, tipo_carga: null })).toEqual({ cavalo: 10, bolsa: 15 });
  });

  it('inclui carroça quando tipo_carga é "carroca" (e não inclui "carro")', () => {
    const r = capacidadesPorLocalMontaria({ tem_bolsa: false, tipo_carga: 'carroca' });
    expect(r).toEqual({ cavalo: 10, carroca: 30 });
    expect(r.carro).toBeUndefined();
  });
});

describe('calcularCapacidadeMunicaoDeArmas', () => {
  it('lista vazia dá 0 nos dois', () => {
    expect(calcularCapacidadeMunicaoDeArmas([])).toEqual({ leve: 0, pesada: 0 });
  });

  it('soma coldres (leve) e bandoleiras (pesada) separadamente', () => {
    const armas = [
      { meio_transporte: 'coldre' },
      { meio_transporte: 'coldre' },
      { meio_transporte: 'bandoleira' },
    ];
    expect(calcularCapacidadeMunicaoDeArmas(armas)).toEqual({ leve: 72, pesada: 24 });
  });

  it('bainha não contribui pra nenhum dos dois', () => {
    expect(calcularCapacidadeMunicaoDeArmas([{ meio_transporte: 'bainha' }])).toEqual({ leve: 0, pesada: 0 });
  });
});

describe('validarMeioTransporte', () => {
  it('null (desequipar) sempre é permitido, sem checar limite', () => {
    expect(validarMeioTransporte([], 'x', null)).toBeNull();
  });

  it('permite dentro do limite', () => {
    const armas = [{ id: 'a', meio_transporte: 'coldre' }];
    expect(validarMeioTransporte(armas, 'b', 'coldre')).toBeNull();
  });

  it('bloqueia acima do limite de bainha (só 1)', () => {
    const armas = [{ id: 'a', meio_transporte: 'bainha' }];
    expect(validarMeioTransporte(armas, 'b', 'bainha')).toMatch(/Bainha/);
  });

  it(`bloqueia acima do limite de bandoleira (só ${LIMITE_BANDOLEIRA})`, () => {
    const armas = [
      { id: 'a', meio_transporte: 'bandoleira' },
      { id: 'b', meio_transporte: 'bandoleira' },
    ];
    expect(validarMeioTransporte(armas, 'c', 'bandoleira')).toMatch(/Bandoleira/);
  });

  it(`bloqueia acima do limite combinado coldre+bandoleira (só ${LIMITE_COLDRE_MAIS_BANDOLEIRA})`, () => {
    const armas = [
      { id: 'a', meio_transporte: 'coldre' },
      { id: 'b', meio_transporte: 'coldre' },
      { id: 'c', meio_transporte: 'bandoleira' },
      { id: 'd', meio_transporte: 'bandoleira' },
    ];
    expect(validarMeioTransporte(armas, 'e', 'coldre')).toMatch(/Cheio/);
  });

  it('exclui a PRÓPRIA arma da contagem (trocar a arma já equipada por ela mesma nunca deveria travar)', () => {
    const armas = [
      { id: 'a', meio_transporte: 'bainha' }, // única arma na bainha
    ];
    // "a" tentando continuar na bainha — não deve contar a si mesma como uma segunda arma
    expect(validarMeioTransporte(armas, 'a', 'bainha')).toBeNull();
  });
});

describe('calcularPesoMunicaoExcedente', () => {
  it('sem excedente (tudo dentro da capacidade) pesa 0', () => {
    const r = calcularPesoMunicaoExcedente({
      municaoLeveAtual: 30,
      capacidadeLeve: 36,
      municaoPesadaAtual: 20,
      capacidadePesada: 24,
    });
    expect(r).toBe(0);
  });

  it('cobra peso só do que excede, não do total', () => {
    const r = calcularPesoMunicaoExcedente({
      municaoLeveAtual: 40, // 4 acima de 36
      capacidadeLeve: 36,
      municaoPesadaAtual: 0,
      capacidadePesada: 24,
    });
    expect(r).toBeCloseTo(4 * 0.08, 5);
  });

  it('soma excedente leve e pesada juntos quando os dois passam do limite', () => {
    const r = calcularPesoMunicaoExcedente({
      municaoLeveAtual: 37, // 1 acima de 36
      capacidadeLeve: 36,
      municaoPesadaAtual: 25, // 1 acima de 24
      capacidadePesada: 24,
    });
    expect(r).toBeCloseTo(1 * 0.08 + 1 * 0.25, 5);
  });
});

describe('aplicarRecarga', () => {
  it('enche até o máximo quando o pool tem bala de sobra (quantidade padrão = Infinity)', () => {
    const r = aplicarRecarga({ municaoAtual: 2, municaoMax: 6, poolAtual: 100 });
    expect(r).toEqual({ municaoAtual: 6, poolAtual: 96 });
  });

  it('só pega o que o pool tiver, se for menos do que falta pra encher', () => {
    const r = aplicarRecarga({ municaoAtual: 0, municaoMax: 6, poolAtual: 3 });
    expect(r).toEqual({ municaoAtual: 3, poolAtual: 0 });
  });

  it('quantidade=1 pega só 1 bala (o "+1" parcial)', () => {
    const r = aplicarRecarga({ municaoAtual: 2, municaoMax: 6, poolAtual: 100, quantidade: 1 });
    expect(r).toEqual({ municaoAtual: 3, poolAtual: 99 });
  });

  it('arma já cheia não pega nada do pool, mesmo com quantidade alta', () => {
    const r = aplicarRecarga({ municaoAtual: 6, municaoMax: 6, poolAtual: 100 });
    expect(r).toEqual({ municaoAtual: 6, poolAtual: 100 });
  });

  it('pool vazio não pega nada', () => {
    const r = aplicarRecarga({ municaoAtual: 0, municaoMax: 6, poolAtual: 0 });
    expect(r).toEqual({ municaoAtual: 0, poolAtual: 0 });
  });
});