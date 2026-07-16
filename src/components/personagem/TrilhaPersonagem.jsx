import { useState } from 'react';
import { escolherTrilha, atualizarPassoTrilha, removerTrilhaPersonagem } from '../../lib/dados.js';
import PopupConfirmar from '../PopupConfirmar.jsx';

// Trilha de Redenção (13/07) — conteúdo das 6 trilhas direto do livro
// (TRILHA.pdf, p. 44-45). Cada uma tem uma frase de contexto e 6
// passos — os textos têm lacunas tipo "(nome)" de propósito (o livro
// pede pra preencher com a história de cada personagem); por isso os
// passos são editáveis aqui, não só uma checklist fixa.
const TRILHAS = {
  vinganca: {
    nome: 'Vingança',
    contexto: 'Preciso me vingar de (nome) que (assassinou/sequestrou) minha/meu (povo/família/terras).',
    passos: [
      'Causar problemas para minha gangue ao menos três vezes por causa da minha vingança.',
      'Encontrar e ajudar (nome), a última vítima de (nome de quem está se vingando).',
      'Ir até o último local onde (nome de quem está se vingando) foi avistado.',
      'Resolver outro problema que (nome de quem está se vingando) causou pelo caminho.',
      'Encontrar o paradeiro de (nome de quem está se vingando) e fazer o desafio para um duelo.',
      'Vencer o duelo e completar minha vingança.',
    ],
  },
  fuga: {
    nome: 'Fuga',
    contexto: 'Acabei de escapar (da cadeia/dos sagrados/de outra gangue). Há uma boa recompensa pela minha cabeça.',
    passos: [
      'Usar sua condição de procurado para ajudar a gangue.',
      'Causar problemas para minha gangue ao menos três vezes por ser procurado.',
      'Sacrificar (algo/alguém) importante para mim, em nome da minha liberdade.',
      'Livrar-me do pior caçador de recompensas que estiver atrás da minha cabeça.',
      'Juntar o dinheiro necessário para pagar o preço pela minha cabeça.',
      'Eliminar minha situação de procurado pagando a dívida ou lidando com as autoridades.',
    ],
  },
  divida: {
    nome: 'Dívida',
    contexto: 'Tenho uma dívida com um (mafioso/político) poderoso. Devo quitá-la ou pagarei com a vida.',
    passos: [
      'Esconder dinheiro da minha gangue para pagar minha dívida.',
      'Causar problemas para minha gangue ao menos três vezes por causa da minha dívida.',
      'Encontrar um trabalho que dê muito dinheiro, mas é muito mais arriscado do que o normal.',
      'Juntar o valor de metade da minha dívida, ou conseguir um desconto.',
      '(Roubar/enganar) alguém que eu amo para conseguir ainda mais dinheiro.',
      'Pagar minha dívida.',
    ],
  },
  remorso: {
    nome: 'Remorso',
    contexto: 'Cometi um crime impensável contra (minha gangue/família/meu povo).',
    passos: [
      'Não (matar/roubar/andar à cavalo) como conduta punitiva para meu remorso.',
      'Causar problemas para minha gangue ao menos três vezes por causa do meu remorso.',
      'Reencontrar aqueles que sofreram por minha causa e fazer um serviço importante para eles.',
      'Encontrar uma forma de compensar (minha gangue/família/meu povo) pelo ato que cometi.',
      'Sacrificar as (minhas posses/vida atual/alguém importante) para conseguir o perdão.',
      'Expiar o remorso dentro de mim e viver com o coração mais leve.',
    ],
  },
  recomeco: {
    nome: 'Recomeço',
    contexto: 'Já fui um grande (bandido/xerife/caçador) no passado, me aposentei e perdi minha honra.',
    passos: [
      'Realizar uma façanha que prove para minha gangue que eu ainda posso ser útil.',
      'Encontrar alguém do meu passado que ainda se lembre de minha reputação.',
      'Aprender ao menos 2 novas habilidades (isso pode ser conseguido com a evolução do personagem).',
      'Causar problemas para minha gangue ao menos três vezes pela minha busca por recomeço.',
      'Repetir duas façanhas tão épicas (roubos/salvamentos/capturas) quanto as que fiz no passado.',
      'Recuperar minha honra, glória e fama que tinha no passado.',
    ],
  },
  ambicao: {
    nome: 'Ambição',
    contexto: 'Vou me tornar (maior/melhor/mais rápido) (duelista/jogador/bandido) que já pisou no Oeste Selvagem.',
    passos: [
      'Encontrar três outros (duelistas/jogadores/bandidos) para (duelar/jogar/enfrentar).',
      'Causar problemas para minha gangue ao menos três vezes por causa da minha ambição.',
      'Fazer ao menos três grandes (duelistas/jogadores/bandidos) conhecerem minha reputação.',
      'Perder alguém importante por causa da ambição. (Este passo não pode acontecer primeiro).',
      'Fazer amizade com um (rival/xerife/bandido) que tem a mesma ambição que eu.',
      'Vencer o (duelo/jogo/combate) e me tornar (maior/melhor/mais rápido) do Oeste Selvagem.',
    ],
  },
};

export default function TrilhaPersonagem({ personagemId, passos, onMudar, editavel }) {
  const [selecionada, setSelecionada] = useState('');
  const [escolhendo, setEscolhendo] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmandoTroca, setConfirmandoTroca] = useState(false);

  const trilhaAtualId = passos[0]?.trilha ?? null;
  const trilhaAtual = trilhaAtualId ? TRILHAS[trilhaAtualId] : null;
  const concluidos = passos.filter((p) => p.concluido).length;
  const completou = passos.length === 6 && concluidos === 6;

  async function confirmarEscolha(trilhaId) {
    setErro('');
    setEscolhendo(true);
    const { data, error } = await escolherTrilha(personagemId, trilhaId, TRILHAS[trilhaId].passos);
    setEscolhendo(false);
    if (error) setErro(error.message);
    else {
      onMudar(data);
      setSelecionada('');
      setConfirmandoTroca(false);
    }
  }

  async function handleEscolher() {
    if (!selecionada) return;
    if (trilhaAtualId) {
      setConfirmandoTroca(true); // já tem uma ativa — confirma antes de trocar (perde o progresso)
      return;
    }
    confirmarEscolha(selecionada);
  }

  async function alternarConcluido(passo) {
    const { data, error } = await atualizarPassoTrilha(passo.id, { concluido: !passo.concluido });
    if (error) setErro(error.message);
    else onMudar(passos.map((p) => (p.id === passo.id ? data : p)));
  }

  async function salvarTexto(passo, texto) {
    if (texto === passo.texto) return;
    const { error } = await atualizarPassoTrilha(passo.id, { texto });
    if (error) setErro(error.message);
    else onMudar(passos.map((p) => (p.id === passo.id ? { ...p, texto } : p)));
  }

  if (!trilhaAtualId) {
    return (
      <div className="trilha-bloco">
        {erro && <p className="erro">{erro}</p>}
        <p className="detalhe-secundario">
          Sempre existe algo no passado que aperta o peito — remorso, culpa ou sede de vingança. Escolha uma Trilha
          rumo à sua redenção; ao completar os 6 passos, você ganha +1 Habilidade, +2 de Vida, e pode tirar uma carta
          a mais na Iniciativa e escolher a melhor.
        </p>
        {editavel && (
          <div className="form-inline">
            <select value={selecionada} onChange={(e) => setSelecionada(e.target.value)}>
              <option value="">Escolher uma trilha...</option>
              {Object.entries(TRILHAS).map(([id, t]) => (
                <option key={id} value={id}>
                  {t.nome}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleEscolher} disabled={!selecionada || escolhendo}>
              {escolhendo ? 'Escolhendo...' : 'Escolher esta trilha'}
            </button>
          </div>
        )}
        {selecionada && <p className="campo-dica">{TRILHAS[selecionada].contexto}</p>}
      </div>
    );
  }

  return (
    <div className="trilha-bloco">
      {erro && <p className="erro">{erro}</p>}
      <h3>Trilha: {trilhaAtual.nome}</h3>
      <p className="campo-dica">{trilhaAtual.contexto}</p>
      <p className="detalhe-secundario">
        {concluidos}/6 passos concluídos. Edite o texto de cada passo pra colocar nomes e detalhes de verdade da sua
        história — as lacunas entre parênteses são só sugestão do livro.
      </p>

      <ul className="trilha-passos">
        {passos.map((passo, i) => (
          <li key={passo.id} className={passo.concluido ? 'trilha-passo-concluido' : ''}>
            <label className="trilha-passo-checkbox">
              <input
                type="checkbox"
                checked={passo.concluido}
                disabled={!editavel}
                onChange={() => alternarConcluido(passo)}
              />
              <span>Passo {i + 1}</span>
            </label>
            <textarea
              defaultValue={passo.texto}
              disabled={!editavel}
              rows={2}
              onBlur={(e) => salvarTexto(passo, e.target.value)}
            />
          </li>
        ))}
      </ul>

      {completou && (
        <div className="trilha-redencao-alcancada">
          <strong>Redenção alcançada!</strong>
          <p>
            Você ganha +1 Habilidade, +2 de Vida, e pode tirar uma carta a mais na Iniciativa e escolher a melhor.
            Aplique isso nas abas de Habilidades/Atributos quando quiser.
          </p>
        </div>
      )}

      {editavel && (
        <button type="button" className="botao-secundario" onClick={() => setConfirmandoTroca(true)}>
          Trocar de trilha
        </button>
      )}

      {editavel && (
        <div className="form-inline">
          <select value={selecionada} onChange={(e) => setSelecionada(e.target.value)}>
            <option value="">Trocar pra outra trilha...</option>
            {Object.entries(TRILHAS)
              .filter(([id]) => id !== trilhaAtualId)
              .map(([id, t]) => (
                <option key={id} value={id}>
                  {t.nome}
                </option>
              ))}
          </select>
        </div>
      )}

      <PopupConfirmar
        aberto={confirmandoTroca}
        titulo="Trocar de trilha"
        mensagem={
          selecionada
            ? `Trocar para "${TRILHAS[selecionada].nome}"? O progresso da trilha atual (${concluidos}/6) será perdido.`
            : 'Escolha uma trilha no menu acima antes de confirmar a troca.'
        }
        textoConfirmar="Trocar"
        onConfirmar={() => selecionada && confirmarEscolha(selecionada)}
        onCancelar={() => setConfirmandoTroca(false)}
      />
    </div>
  );
}