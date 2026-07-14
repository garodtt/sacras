import { useEffect, useState } from 'react';
import CampoEditavel from './CampoEditavel.jsx';
import CampoStepper from './CampoStepper.jsx';
import LinhaCirculosAjustavel from './LinhaCirculosAjustavel.jsx';
import TabelaItens from './TabelaItens.jsx';
import {
  criarMontaria,
  atualizarMontaria,
  removerMontaria,
  listarItensMontaria,
  criarItemMontaria,
  removerItensMontariaPorLocal,
} from '../../lib/dados.js';
import {
  aplicarDano,
  ajustarComMaximo,
  ajustarValorSimples,
  calcularVidaMaxDeAtributo,
  capacidadesPorLocalMontaria,
} from '../../lib/regras.js';

const NOME_LOCAL = {
  cavalo: 'No próprio cavalo (padrão)',
  bolsa: 'Bolsa de Montaria',
  carro: 'Carro',
  carroca: 'Carroça',
};

// Texto de cada nível vem direto da ficha impressa original.
const NIVEIS_FIDELIDADE = [
  { nivel: 0, texto: 'Montaria estranha: sem bônus.' },
  { nivel: 1, texto: 'Atende quando chamada pelo nome.' },
  { nivel: 2, texto: 'Ganha +1 ponto em um dos dois Atributos à sua escolha.' },
  { nivel: 3, texto: 'Quando chamada, vai até você se estiver dentro de 500m de raio.' },
  { nivel: 4, texto: 'Sem penalidades para saltar obstáculos perigosos.' },
  { nivel: 5, texto: 'Ganha +1 ponto em um dos dois Atributos à sua escolha.' },
];

// 0 ou 1 montaria por personagem (unique em mounts.personagem_id). Se
// `montaria` vier null, mostra só o formulário de criar.
//
// 13/07 — "vida e dor do cavalo igual do jogador": Resistência agora
// soma no Máximo de Vida (igual Físico soma pro personagem), com o
// mesmo stepper +/- por cima. Inventário próprio (itens com mount_id
// em vez de personagem_id) com carga própria: 10 padrão + bolsa (+15)
// + carro (+20) ou carroça (+30). O popup de Efeito de Dor (dado
// físico) não se aplica aqui — é sobre ações de combate do personagem,
// não faz sentido pra montaria.
//
// `secao` (13/07, ficha em abas): 'stats' mostra nome/presente/potência/
// resistência/vida/dor/fidelidade/carga; 'inventario' mostra só os
// sub-locais de item. Personagem.jsx renderiza esta peça DUAS vezes
// (uma por aba) — cada instância busca `itensMontaria` de novo ao
// montar (é remontada quando a aba troca), então sempre fica
// atualizado; o preço é buscar de novo a cada troca de aba, aceitável
// pro tamanho de dado aqui.
export default function Montaria({ personagemId, montaria, onMudar, editavel, secao = 'stats' }) {
  const [criando, setCriando] = useState(false);
  const [nomeNova, setNomeNova] = useState('');
  const [erro, setErro] = useState('');
  const [mensagemDor, setMensagemDor] = useState('');
  const [itensMontaria, setItensMontaria] = useState([]);
  const [carregandoItens, setCarregandoItens] = useState(false);

  useEffect(() => {
    if (!montaria?.id) {
      setItensMontaria([]);
      return;
    }
    setCarregandoItens(true);
    listarItensMontaria(montaria.id).then(({ data, error }) => {
      if (error) setErro(error.message);
      setItensMontaria(data ?? []);
      setCarregandoItens(false);
    });
  }, [montaria?.id]);

  async function handleCriar(e) {
    e.preventDefault();
    if (!nomeNova.trim()) return;

    setErro('');
    setCriando(true);
    const { data, error } = await criarMontaria(personagemId, nomeNova.trim());
    setCriando(false);

    if (error) setErro(error.message);
    else onMudar(data);
  }

  async function salvarCampo(campo, valor) {
    const { data, error } = await atualizarMontaria(montaria.id, { [campo]: valor });
    if (error) setErro(error.message);
    else onMudar(data);
  }

  // Resistência -> Máximo de Vida (mesma regra do personagem: Físico ->
  // Vida). Vida atual acompanha a diferença (ajustarComMaximo).
  async function salvarResistencia(novaResistencia) {
    const novoMax = calcularVidaMaxDeAtributo(novaResistencia);
    const novaAtual = ajustarComMaximo({
      maxAntigo: montaria.circulos_vida_max,
      maxNovo: novoMax,
      atual: montaria.circulos_vida_atual,
    });
    const { data, error } = await atualizarMontaria(montaria.id, {
      resistencia: novaResistencia,
      circulos_vida_max: novoMax,
      circulos_vida_atual: novaAtual,
    });
    if (error) setErro(error.message);
    else onMudar(data);
  }

  async function ajustarMaxVida(novoMax) {
    const novaAtual = ajustarComMaximo({
      maxAntigo: montaria.circulos_vida_max,
      maxNovo: novoMax,
      atual: montaria.circulos_vida_atual,
    });
    const { data, error } = await atualizarMontaria(montaria.id, {
      circulos_vida_max: novoMax,
      circulos_vida_atual: novaAtual,
    });
    if (error) setErro(error.message);
    else onMudar(data);
  }

  async function ajustarMaxDor(novoMax) {
    const novaAtual = ajustarComMaximo({
      maxAntigo: montaria.circulos_dor_max,
      maxNovo: novoMax,
      atual: montaria.circulos_dor_atual,
    });
    const { data, error } = await atualizarMontaria(montaria.id, {
      circulos_dor_max: novoMax,
      circulos_dor_atual: novaAtual,
    });
    if (error) setErro(error.message);
    else onMudar(data);
  }

  // Ferimento direto na Vida — bypassa a Dor, nunca mexe no Máximo.
  async function ajustarVidaAtual(delta) {
    const nova = ajustarValorSimples({
      atual: montaria.circulos_vida_atual,
      max: montaria.circulos_vida_max,
      delta,
    });
    if (nova === montaria.circulos_vida_atual) return;
    const { data, error } = await atualizarMontaria(montaria.id, { circulos_vida_atual: nova });
    if (error) setErro(error.message);
    else onMudar(data);
  }

  // Ferimento direto na Dor — subir é simples; descer aciona a quebra
  // de resistência (mesma regra do personagem).
  async function ajustarDorAtual(delta) {
    if (delta > 0) {
      const nova = ajustarValorSimples({
        atual: montaria.circulos_dor_atual,
        max: montaria.circulos_dor_max,
        delta,
      });
      if (nova === montaria.circulos_dor_atual) return;
      const { data, error } = await atualizarMontaria(montaria.id, { circulos_dor_atual: nova });
      if (error) setErro(error.message);
      else onMudar(data);
      setMensagemDor('');
      return;
    }

    const resultado = aplicarDano({
      vidaAtual: montaria.circulos_vida_atual,
      vidaMax: montaria.circulos_vida_max,
      dorAtual: montaria.circulos_dor_atual,
      dorMax: montaria.circulos_dor_max,
      dano: 1,
    });

    const { data, error } = await atualizarMontaria(montaria.id, {
      circulos_vida_atual: resultado.vidaAtual,
      circulos_dor_atual: resultado.dorAtual,
    });

    if (error) {
      setErro(error.message);
      return;
    }
    onMudar(data);
    setMensagemDor(
      resultado.quebras > 0
        ? resultado.caido
          ? 'Quebra de resistência — Vida chegou a 0.'
          : 'Quebra de resistência! Vida −1.'
        : ''
    );
  }

  async function handleRemover() {
    if (!window.confirm('Remover a montaria deste personagem?')) return;
    const { error } = await removerMontaria(montaria.id);
    if (error) setErro(error.message);
    else onMudar(null);
  }

  if (!montaria) {
    if (secao === 'inventario') {
      return <p className="detalhe-secundario">Você ainda não tem montaria — crie uma na aba "Montaria".</p>;
    }
    return (
      <div className="bloco-montaria">
        {erro && <p className="erro">{erro}</p>}
        <p className="detalhe-secundario">Este personagem ainda não tem montaria.</p>
        {editavel && (
          <form onSubmit={handleCriar} className="form-inline">
            <label>
              Nome da montaria
              <input value={nomeNova} onChange={(e) => setNomeNova(e.target.value)} required />
            </label>
            <button type="submit" disabled={criando}>
              {criando ? 'Criando...' : 'Criar montaria'}
            </button>
          </form>
        )}
      </div>
    );
  }

  const pontosDistribuidos = montaria.potencia + montaria.resistencia;
  const caido = montaria.circulos_vida_atual <= 0;
  const capacidades = capacidadesPorLocalMontaria({ tem_bolsa: montaria.tem_bolsa, tipo_carga: montaria.tipo_carga });
  const espacoTotal = Object.values(capacidades).reduce((soma, v) => soma + v, 0);

  if (secao === 'inventario') {
    return (
      <div className="bloco-montaria">
        {erro && <p className="erro">{erro}</p>}
        <p className="detalhe-secundario">
          Separado por sub-local — se largar a bolsa (ou o carro/carroça), dá pra ver exatamente o que tinha nela
          antes de excluir só aquele grupo.
        </p>
        {carregandoItens ? (
          <p className="detalhe-secundario">Carregando itens...</p>
        ) : (
          Object.entries(capacidades).map(([local, limite]) => {
            const itensDoLocal = itensMontaria.filter((i) => i.local_montaria === local);
            return (
              <div key={local} className="sub-inventario-montaria">
                <h5>{NOME_LOCAL[local]}</h5>
                <TabelaItens
                  itens={itensDoLocal}
                  onMudar={(novaLista) =>
                    setItensMontaria((atual) => [...atual.filter((i) => i.local_montaria !== local), ...novaLista])
                  }
                  editavel={editavel}
                  limiteEspaco={limite}
                  onAdicionar={() => criarItemMontaria(montaria.id, itensDoLocal.length, local)}
                  onExcluirTodos={() => removerItensMontariaPorLocal(montaria.id, local)}
                />
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="bloco-montaria">
      {erro && <p className="erro">{erro}</p>}

      <div className="grid-campos">
        <CampoEditavel
          label="Nome"
          tipo="text"
          valor={montaria.nome}
          editavel={editavel}
          onSalvar={(v) => salvarCampo('nome', v)}
        />
      </div>

      <label className="campo-presente">
        <input
          type="checkbox"
          checked={montaria.presente}
          disabled={!editavel}
          onChange={(e) => salvarCampo('presente', e.target.checked)}
        />
        Montaria está com o personagem agora
      </label>
      {!montaria.presente && (
        <p className="aviso-somente-leitura">
          Montaria não está presente — os itens dela não estão disponíveis pro personagem agora.
        </p>
      )}

      <p className="detalhe-secundario">
        Distribua 3 pontos entre Potência e Resistência — atualmente {pontosDistribuidos}/3 (guia, não travado).
      </p>

      <div className="grid-campos">
        <CampoEditavel
          label="Potência"
          valor={montaria.potencia}
          min={0}
          editavel={editavel}
          onSalvar={(v) => salvarCampo('potencia', v)}
          dica="1d6 + Potência + Montaria contra NA 6."
        />
        <CampoEditavel
          label="Resistência"
          valor={montaria.resistencia}
          min={0}
          editavel={editavel}
          onSalvar={salvarResistencia}
          dica="+1 Círculo de Vida para cada ponto aqui."
        />
      </div>

      <div className="grid-circulos">
        <div>
          <h4>
            Círculos de Vida
            {caido && <span className="badge-caido">Caído</span>}
          </h4>
          <CampoStepper label="Máximo de Vida" valor={montaria.circulos_vida_max} min={1} editavel={editavel} onSalvar={ajustarMaxVida} />
          <LinhaCirculosAjustavel
            max={montaria.circulos_vida_max}
            valor={montaria.circulos_vida_atual}
            editavel={editavel}
            variante="vida"
            legenda={`${montaria.circulos_vida_atual}/${montaria.circulos_vida_max}`}
            onAjustar={ajustarVidaAtual}
            onSelecionarCirculo={(v) => salvarCampo('circulos_vida_atual', v)}
          />
        </div>
        <div>
          <h4>Círculos de Dor</h4>
          <CampoStepper label="Máximo de Dor" valor={montaria.circulos_dor_max} min={1} editavel={editavel} onSalvar={ajustarMaxDor} />
          <LinhaCirculosAjustavel
            max={montaria.circulos_dor_max}
            valor={montaria.circulos_dor_atual}
            editavel={editavel}
            variante="dor"
            legenda={`${montaria.circulos_dor_atual}/${montaria.circulos_dor_max}`}
            onAjustar={ajustarDorAtual}
            onSelecionarCirculo={(v) => salvarCampo('circulos_dor_atual', v)}
          />
          {mensagemDor && <small className="campo-dica">{mensagemDor}</small>}
        </div>
      </div>

      <div className="nivel-fidelidade">
        <h4>Nível de Fidelidade</h4>
        <ul>
          {NIVEIS_FIDELIDADE.map((n) => (
            <li key={n.nivel} className={n.nivel <= montaria.nivel_fidelidade ? 'nivel-ativo' : ''}>
              <button
                type="button"
                className="pip-numerado"
                disabled={!editavel}
                onClick={() => salvarCampo('nivel_fidelidade', n.nivel)}
                aria-pressed={n.nivel <= montaria.nivel_fidelidade}
              >
                {n.nivel}
              </button>
              <span>{n.texto}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="config-carga-montaria">
        <h4>Carga da montaria</h4>
        <p className="detalhe-secundario">
          Padrão (10) {montaria.tem_bolsa && '+ Bolsa de Montaria (15)'}
          {montaria.tipo_carga === 'carro' && ' + Carro (20)'}
          {montaria.tipo_carga === 'carroca' && ' + Carroça (30)'}
          {' '}= {espacoTotal} de carga total (cada sub-local com seu próprio limite, ver abaixo).
        </p>
        <label>
          <input
            type="checkbox"
            checked={montaria.tem_bolsa}
            disabled={!editavel}
            onChange={(e) => salvarCampo('tem_bolsa', e.target.checked)}
          />
          Bolsa de montaria (+15)
        </label>
        <div className="opcoes-carga">
          <label>
            <input
              type="radio"
              name="tipo_carga"
              checked={!montaria.tipo_carga}
              disabled={!editavel}
              onChange={() => salvarCampo('tipo_carga', null)}
            />
            Nenhum carro/carroça
          </label>
          <label>
            <input
              type="radio"
              name="tipo_carga"
              checked={montaria.tipo_carga === 'carro'}
              disabled={!editavel}
              onChange={() => salvarCampo('tipo_carga', 'carro')}
            />
            Carro (+20)
          </label>
          <label>
            <input
              type="radio"
              name="tipo_carga"
              checked={montaria.tipo_carga === 'carroca'}
              disabled={!editavel}
              onChange={() => salvarCampo('tipo_carga', 'carroca')}
            />
            Carroça (+30)
          </label>
        </div>
      </div>

      {editavel && (
        <button type="button" className="botao-remover" onClick={handleRemover}>
          Remover montaria
        </button>
      )}
    </div>
  );
}