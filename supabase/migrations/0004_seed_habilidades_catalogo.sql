-- =====================================================================
-- Sacramento RPG — Migração 0004: catálogo de habilidades (30 do livro,
-- "Habilidades de Combate" + "Habilidades de Profissão").
--
-- Ícones do livro (habilidades.pdf): punho = Dor, caveira = Vida.
-- Onde o texto original tinha um ícone (dano/cura/vida), troquei por
-- "de Dor" ou "de Vida" por extenso — mesma lógica da ficha (Dor é
-- dano, Vida é vida/cura). Um caso combina os dois (quebra-ossos: cada
-- nível dá um pouco de Vida + um pouco de Dor no mesmo golpe).
-- =====================================================================

alter table public.habilidades_catalogo
  add column categoria text check (categoria in ('combate', 'profissao'));

insert into public.habilidades_catalogo (nome, categoria, descricao) values

('Armas da natureza', 'combate',
'Você prefere lutar com métodos "ultrapassados". Seja por tradição ou por gosto, sempre que lutar usando armas rústicas, como facas de pedra, lanças de madeira, machadinhas e armas rudimentares, o dano do seu ataque aumenta em 1 de Dor para cada ponto em Físico que tiver.'),

('Ataque sacana', 'combate',
'Sua honra pode ser a primeira pá de terra que cai em cima do seu caixão, então para o inferno com ela, não é mesmo? Ao realizar um ataque surpresa usando facas, navalhas ou qualquer outra lâmina oculta, o golpe causa dano adicional que aumenta a cada nível: nível 1 = +1 de Dor; nível 3 = +2 de Dor; nível 6 = +3 de Dor.'),

('Briga de bar', 'combate',
'Quando você viu, já estava enfiando a cara de um maluco no piano do Salão. Você sabe improvisar armas com aquilo que estiver na sua frente: uma cadeira, uma garrafa, ou o bebum segurando a garrafa. Objetos pequenos e médios causam 3 de Dor, enquanto objetos grandes causam 1 de Dor mas, neste segundo caso, os Testes de Violência têm -1 de penalidade para que os objetos desengonçados acertem os alvos.'),

('Coldre de sabão', 'combate',
'Quem inventou o ditado "quem ri por último, ri melhor" era meio tantan. Na Iniciativa, você pode puxar duas cartas e escolher a que quiser, a maior ou a menor, de acordo com a estratégia que pensar para seu turno na hora do combate.'),

('Dedo quente', 'combate',
'Você sente a alma de um revólver como o fogo de uma paixão ardente, fazendo de seus tiros tão precisos quanto mortais. Sempre que atirar com um revólver, você recebe +1 nos Testes de Violência. Além disso, contra alvos sem cobertura, o dano dos tiros aumenta conforme seu nível: nível 1 = +1 de Dor; nível 3 = +2 de Dor; nível 6 = +3 de Dor.'),

('Fúria dos aflitos', 'combate',
'Sua raiva é imparável e seu ódio é infinito, a ponto de você não medir perigos e arriscar a própria pele para massacrar seus inimigos. Em combate, você reduz sua Defesa em 1 ponto, e aumenta o dano de seus ataques corpo a corpo em 3 de Dor.'),

('Gatilho furioso', 'combate',
'Martelar o cão é a façanha de puxar o gatilho do revólver com uma das mãos enquanto bate no cão da arma com a outra mão. Você dispara dois tiros na mesma Ação de Combate, mas precisa gastar um Movimento para fazer isso. Se tiver mais Ações de Combate e Movimentos até o fim do turno, você pode atirar várias vezes até seu revólver descarregar, depois precisa usar suas Ações de Combate para recarregá-lo.'),

('Livramento', 'combate',
'Você ouviu a morte chamar seu nome, chegou sua hora, mas você não quer bater as botas. Quando riscar todos os seus Círculos de Vida, caia no chão, recupere 2 de Vida e permaneça com a sua carranca feia pela Terra. Se você cair outra vez no mesmo combate, acabou a colher de chá e será preciso fazer o Teste de Morte normalmente.'),

('Marretada', 'combate',
'Pra quê um revólver se sua mão é tão pesada quanto uma marreta? Quando luta de mãos vazias, apenas com o poder de seus socos e chutes, o dano de seus ataques desarmados aumenta em +1 de Dor para cada ponto no Atributo Físico que tiver.'),

('Parrudeza', 'combate',
'Difícil de morrer e duro de matar. Você tem um couro bem grosso ou só gosta muito de estar vivo. Você soma 2 de Vida à sua vida máxima. Esta Habilidade pode ser escolhida várias vezes.'),

('Punhos do oriente', 'combate',
'Você aprendeu artes marciais na sua terra natal ou com algum velho mestre que topou o ensinar, tornando-se uma grande máquina de distribuir chutes e socos. Você pode usar seus Movimentos para realizar ataques desarmados.'),

('Quebra-ossos', 'combate',
'Aplique golpes especiais de luta livre, como agarrões, arremessos ou o famoso suplex. Para dar este golpe é preciso gastar um Movimento e uma Ação de Combate. Você pode escolher imobilizar o oponente ou potencializar o dano do seu golpe conforme seu nível: nível 1 = 1 de Vida + 1 de Dor; nível 3 = 1 de Vida + 2 de Dor; nível 6 = 2 de Vida + 3 de Dor.'),

('Sorte dos covardes', 'combate',
'Deixe as façanhas incríveis pra lá, o que importa para você é ter sorte. No começo de um combate, puxe uma carta do baralho e obtenha o efeito conforme o naipe: Paus = +2 Ações de Combate; Copas = aumente sua Vida em 2; Espadas = +2 Movimentos; Ouros = +1 para Testes de Violência. Os efeitos duram até o final do combate. Para ter esta habilidade você não pode ter mais do que 1 em Intelecto e 2 em Violência, mesmo em níveis mais altos — se tiver, essa habilidade deixa de funcionar.'),

('Valei-me', 'combate',
'Improvise explosivos com o que tiver em mãos, como pedaços de pano, garrafas, um pouco de bebida, um ferrolho, um parafuso etc. Para fabricá-los é preciso ter sucesso em um Teste de Tradição NA 7. Se estiver no meio de um combate, além do teste, você precisa gastar 2 Ações de Combate e um Movimento por explosivo. O dano do explosivo aumenta conforme seu nível: nível 1 = 2 de Dor; nível 3 = 3 de Dor; nível 6 = 4 de Dor.'),

('Zói de gavião', 'combate',
'De vista afiada como uma ave de rapina, você acerta alvos distantes com maior precisão. Se atirar com um fuzil ou arco longo você recebe +1 nos Testes de Violência. Além disso, se estiver em uma posição vantajosa, o dano dos disparos aumenta conforme seu nível: nível 1 = +1 de Dor; nível 3 = +2 de Dor; nível 6 = +3 de Dor.'),

('Às na manga', 'profissao',
'Aquela mesa coberta por um pano verde no canto do Salão lhe é tão familiar quanto a latrina. É na mesa, não na latrina, que você ganha dinheiro, nas cartas e no blefe. Ao fazer Testes envolvendo jogos de cartas, role 2d6 e use o melhor dado.'),

('Boca na botija', 'profissao',
'Mal aguém sentou no cacto, você já está com o unguento na mão. Sua percepção é tão afiada quanto os dentes de um jacaré. Você quase nunca deixa passar algo desapercebido. Ao fazer Testes de Atenção, jogue 2d6 e use o melhor resultado. E outra, sua Defesa não é reduzida por ficar surpreso antes do combate.'),

('Canção da emoção', 'profissao',
'Uma viola, gaita ou violão está na sua mão enquanto você canta um modão. A melodia pode inspirar sua gangue a superar o pior dos combates. Uma vez por sessão, você pode gastar duas Ações de Combate para cada PJ que queira beneficiar e conceder a todos eles um dos bônus a seguir, conforme seu nível (gastando mais duas Ações de Combate por PJ pra cada benefício adicional): nível 1 = +1 Movimento; nível 3 = +1 Ação de Combate; nível 4 = +1 em Violência; nível 6 = +3 de Vida temporários.'),

('Chamego', 'profissao',
'Pula boi, pula cavalo, pula cavalo e boi! Foram tantos anos com o laço na mão que você sabe usar uma corda como ninguém. Ao fazer um teste para laçar algo ou alguém, jogue 2d6 e use o melhor resultado. Além disso, seus nós apertados dão penalidade de -1 para os Testes a quem tentar se soltar do chamego do seu laço.'),

('Cuspe e cola', 'profissao',
'Nas condições precárias da Guerra, tinham poucos trens para cuidar dos soldados feridos, às vezes era preciso limpar com cuspe e estancar com cola. Este é o único jeito de curar alguém no meio do combate. Para fazer isso, você precisa estar colado no seu paciente e gastar 2 Ações de Combate para cada ponto de Vida que curar. O limite de usos aumenta conforme seu nível: nível 1 = 1 uso por combate; nível 3 = 2 usos por combate; nível 6 = 4 usos por combate.'),

('Fogo no céu', 'profissao',
'Ah! A pólvora! Aquele pozinho preto que faz o fogo voar. Você tem fascínio por dinamites, TNT, nitroglicerina ou qualquer coisa que faça BOOOOOM! Ao fazer Testes envolvendo explosivos, jogue 2d6 e use o melhor resultado. Além disso, você também não corre o risco de explodir os próprios miolos caso tire uma falha crítica.'),

('Fumaça na água', 'profissao',
'O silêncio e a noite são os melhores amigos de um covarde... ops, quer dizer, de quem sobrevive à base da subtração de bens alheios. Quando fizer Testes de Roubo para afanar coisas, se esconder ou caminhar na quietude, jogue 2d6 e use o melhor resultado que cair.'),

('Galope certeiro', 'profissao',
'Gaspar e Estrela, um homem e uma égua. Inseparáveis. A ligação entre humanos e suas montarias é sempre inquebrável e pode motivar vinganças e redenções. Ao fazer Testes de Montaria no lombo do seu próprio cavalo, jogue 2d6 e use o melhor resultado. Você também ignora a penalidade em Testes de Montaria quando estiver montado em outros animais não familiares a você.'),

('Não vai doer nadinha', 'profissao',
'Quantas vidas você salvou na Guerra? Quantos braços e pernas amputou? Você cuidou de viroses, cancro mole, unha encravada, gripe, caxumba que já desceu e tanta coisa que nada mais o assusta. Ao fazer testes de Medicina, jogue 2d6 e use o melhor resultado. Além disso, sua cura adicional aumenta conforme seu nível: nível 1 = +1 de Vida; nível 3 = +2 de Vida; nível 6 = +4 de Vida.'),

('Natural da natureza', 'profissao',
'Os caminhos da natureza estão abertos para você. Você sabe nadar, escalar, subir em árvores, pular de galho em galho, abrir trilhas através das matas e pradarias. Sempre que fizer Testes de Suor, jogue 2d6 e use o melhor resultado. Além disso, você não precisa fazer testes para encontrar plantas, ervas medicinais ou comestíveis e abrigo em territórios inóspitos e selvagens.'),

('Sabiá imperatriz', 'profissao',
'Hora de tirar no dedo a última gota do perfume que vai esconder o futum de bosta que você tem. Sorria, seduza, convença e aperte as mãos certas para conseguir as informações que você tanto precisa. Ao fazer Testes de Negócios, jogue 2d6 e use o melhor resultado.'),

('Sabugos e peçonhas', 'profissao',
'Seus anos vivendo entre as matas do Oeste Selvagem lhe renderam conhecimento para saber tudo o que há de mal nas plantas. Você consegue produzir venenos mais eficientes. Eles causam 1 de Dor a cada ação feita pelo alvo envenenado — se o alvo usar uma ação para atirar, sofre 1 de Dor; se der outro tiro, sofre mais até o veneno ser curado, resistido ou o alvo ficar inconsciente.'),

('Salve-se quem puder', 'profissao',
'Lutar até morrer é coisa de quem não tem amor à vida, sô. Mesmo que as calças borradas fiquem para trás, ficar vivo não é descaso com ninguém. Só não vai me fazer isso no meio de um duelo porque, aí sim, é coisa de gente sem nem um tiquim de moral. Ao fazer qualquer Teste para escapar ou fugir, jogue 2d6 e use o melhor resultado. Em situações de fuga, você recebe +1 Movimento que só pode ser usado para dar no pé.'),

('Sorrisão, chapéu na mão', 'profissao',
'Com a cara lavada e sorriso no rosto, você consegue levar vantagens sempre que existe uma negociação financeira. Sempre que estiver comprando ou vendendo itens comuns (e não itens especiais ou raros), você consegue comprar itens com 25% de desconto e vendê-los 25% mais caro de acordo com os preços na tabela de equipamento.'),

('Zói de coruja', 'profissao',
'Na vivência ou na escola, seu objetivo sempre foi a busca pela teoria e pelo conhecimento. É uma sede de saber incontrolável que o transforma em enciclopédia ambulante. Sempre que fizer um Teste de Tradição para se lembrar de algum conhecimento lá do fundo da cachola, jogue 2d6 e fique com o melhor resultado.');