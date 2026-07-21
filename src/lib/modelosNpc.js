// Modelos de NPC prontos (13/07, expandido) — ponto de partida rápido,
// editável depois (tanto na Biblioteca de NPCs da campanha quanto
// direto no formulário de "Adicionar combatente" do Rastreador).
// Valores só um chute razoável pro Oeste Selvagem, sem ligação com
// nenhuma regra oficial do livro — ajuste como quiser depois de
// adicionar. `descricao` é só sugestão de partida — o Mestre reescreve
// com os detalhes da própria história.
export const MODELOS_NPC = [
  {
    nome: 'Capanga',
    vida_max: 4,
    dor_max: 4,
    balas_max: 6,
    descricao: 'Um pistoleiro qualquer da gangue, sem nome próprio — carne de canhão.',
  },
  {
    nome: 'Bandido básico',
    vida_max: 6,
    dor_max: 6,
    balas_max: 6,
    descricao: 'Fora da lei comum, não muito habilidoso, mas perigoso em bando.',
  },
  {
    nome: 'Xerife',
    vida_max: 8,
    dor_max: 8,
    balas_max: 12,
    descricao: 'Autoridade local, estrela no peito. Conhece todo mundo na cidade.',
  },
  {
    nome: 'Pistoleiro experiente',
    vida_max: 8,
    dor_max: 6,
    balas_max: 12,
    descricao: 'Já duelou e sobreviveu mais vezes do que gosta de admitir.',
  },
  {
    nome: 'Chefão da gangue',
    vida_max: 12,
    dor_max: 10,
    balas_max: 18,
    descricao: 'Manda em todo mundo ao redor. Raramente suja as próprias mãos.',
  },
  {
    nome: 'Comerciante',
    vida_max: 4,
    dor_max: 4,
    balas_max: 0,
    descricao: 'Dono de loja ou mercearia. Sabe tudo que circula pela cidade — pelo preço certo.',
  },
  {
    nome: 'Fazendeiro',
    vida_max: 6,
    dor_max: 6,
    balas_max: 4,
    descricao: 'Trabalha a terra, defende a família e o gado com o que tiver na mão.',
  },
  {
    nome: 'Caçador de recompensas',
    vida_max: 9,
    dor_max: 7,
    balas_max: 14,
    descricao: 'Persegue quem tem preço na cabeça. Não costuma se importar se é vivo ou morto.',
  },
  {
    nome: 'Curandeiro(a)',
    vida_max: 4,
    dor_max: 6,
    balas_max: 0,
    descricao: 'Conhece ervas e remédios da terra. Muitos preferem ele(a) ao médico da cidade.',
  },
  {
    nome: 'Bêbado da cidade',
    vida_max: 3,
    dor_max: 5,
    balas_max: 0,
    descricao: 'Sempre no bar, sempre com uma história — nem sempre verdadeira.',
  },
  {
    nome: 'Padre/Pastor',
    vida_max: 4,
    dor_max: 6,
    balas_max: 0,
    descricao: 'Guarda os segredos da cidade em confissão. Tenta manter a paz entre facções.',
  },
  {
    nome: 'Cavaleiro solitário',
    vida_max: 10,
    dor_max: 8,
    balas_max: 12,
    descricao: 'Forasteiro de passado misterioso, nunca fica muito tempo no mesmo lugar.',
  },
  {
    nome: 'Ferroviário',
    vida_max: 5,
    dor_max: 5,
    balas_max: 4,
    descricao: 'Trabalha na construção ou manutenção da linha férrea que corta a região.',
  },
];