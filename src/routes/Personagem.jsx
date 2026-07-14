import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  buscarPersonagem,
  atualizarPersonagem,
  listarItens,
  criarItem,
  removerTodosItensPersonagem,
  listarArmas,
  atualizarArma,
  buscarMontaria,
  listarHabilidadesPersonagem,
} from '../lib/dados.js';
import CampoEditavel from '../components/personagem/CampoEditavel.jsx';
import CampoStepper from '../components/personagem/CampoStepper.jsx';
import TrilhaCirculos from '../components/personagem/TrilhaCirculos.jsx';
import LinhaCirculosAjustavel from '../components/personagem/LinhaCirculosAjustavel.jsx';
import TabelaItens from '../components/personagem/TabelaItens.jsx';
import TabelaArmas from '../components/personagem/TabelaArmas.jsx';
import MunicaoPool from '../components/personagem/MunicaoPool.jsx';
import Habilidades from '../components/personagem/Habilidades.jsx';
import EfeitoDorPopup from '../components/personagem/EfeitoDorPopup.jsx';
import Montaria from '../components/personagem/Montaria.jsx';
import {
  aplicarDano,
  calcularStatsDerivados,
  ajustarComMaximo,
  ajustarValorSimples,
  calcularCapacidadeMunicaoDeArmas,
  calcularPesoMunicaoExcedente,
  aplicarRecarga,
} from '../lib/regras.js';

const ANTECEDENTES = [
  { campo: 'ant_atencao', label: 'Atenção' },
  { campo: 'ant_medicina', label: 'Medicina' },
  { campo: 'ant_montaria', label: 'Montaria' },
  { campo: 'ant_tradicao', label: 'Tradição' },
  { campo: 'ant_negocios', label: 'Negócios' },
  { campo: 'ant_roubo', label: 'Roubo' },
  { campo: 'ant_suor', label: 'Suor' },
  { campo: 'ant_violencia', label: 'Violência' },
];

// Editor completo do personagem (Fases 5, 6 e regras de 13/07):
//
// - Atributos agora SOMAM de verdade nos campos certos (Físico -> Vida
//   máx., Velocidade -> Movimentos, Coragem -> Ações de Combate,
//   Intelecto -> orçamento de Antecedentes). Movimentos e Ações de
//   Combate viram só leitura (são 100% derivados agora); Vida máx.
//   também é derivada, mas continua com o stepper +/- pra ajuste manual
//   por cima (efeitos temporários etc.) — editar o Físico de novo
//   recalcula e substitui esse ajuste manual, é uma simplificação
//   assumida, ver docs/ARQUITETURA.md.
// - Efeito de Dor agora é um popup marcado manualmente (dado físico),
//   não mais calculado a partir dos círculos.
// - Habilidades vêm de um catálogo compartilhado + criação própria.
// - Itens têm peso × quantidade, trava de carga de verdade (antes só
//   era um aviso). Coldre/bandoleira saiu do item — agora é
//   meio_transporte da arma (13/07).
// - Armas têm meio_transporte (coldre/bandoleira/bainha, com limites) e
//   tipo_dano (Dor/Vida); recarregam do pool certo. Munição excedente
//   (o que passa da capacidade do coldre/bandoleira) conta como peso.
// - Dinheiro e valor de recompensa são campos simples, sem regra.
//
// Só o dono (ou o Admin) edita; RLS (personagens_update) já bloqueia no
// banco, aqui só refletimos isso desabilitando os campos.
export default function Personagem() {
  const { id } = useParams();
  const { user, role } = useAuth();

  const [personagem, setPersonagem] = useState(null);
  const [itens, setItens] = useState([]);
  const [armas, setArmas] = useState([]);
  const [montaria, setMontaria] = useState(null);
  const [habilidades, setHabilidades] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagemDor, setMensagemDor] = useState('');

  useEffect(() => {
    carregar();
  }, [id]);

  async function carregar() {
    setCarregando(true);
    setErro('');

    const [resPersonagem, resItens, resArmas, resMontaria, resHabilidades] = await Promise.all([
      buscarPersonagem(id),
      listarItens(id),
      listarArmas(id),
      buscarMontaria(id),
      listarHabilidadesPersonagem(id),
    ]);

    const primeiroErro =
      resPersonagem.error || resItens.error || resArmas.error || resMontaria.error || resHabilidades.error;
    if (primeiroErro) setErro(primeiroErro.message);

    setPersonagem(resPersonagem.data ?? null);
    setItens(resItens.data ?? []);
    setArmas(resArmas.data ?? []);
    setMontaria(resMontaria.data ?? null);
    setHabilidades(resHabilidades.data ?? []);
    setCarregando(false);
  }

  const canEdit = Boolean(personagem) && (personagem.user_id === user?.id || role === 'admin');

  async function salvarCampo(campo, valor) {
    const { data, error } = await atualizarPersonagem(personagem.id, { [campo]: valor });
    if (error) setErro(error.message);
    else setPersonagem((atual) => ({ ...atual, ...data }));
  }

  // Físico -> Vida máx. (com Vida atual acompanhando a diferença).
  async function salvarFisico(novoFisico) {
    const { circulos_vida_max: novoMax } = calcularStatsDerivados({ ...personagem, atributo_fisico: novoFisico });
    const novaAtual = ajustarComMaximo({
      maxAntigo: personagem.circulos_vida_max,
      maxNovo: novoMax,
      atual: personagem.circulos_vida_atual,
    });
    const { data, error } = await atualizarPersonagem(personagem.id, {
      atributo_fisico: novoFisico,
      circulos_vida_max: novoMax,
      circulos_vida_atual: novaAtual,
    });
    if (error) setErro(error.message);
    else setPersonagem((atual) => ({ ...atual, ...data }));
  }

  // Velocidade -> Movimentos (só leitura, sem "atual" pra acompanhar).
  async function salvarVelocidade(novaVelocidade) {
    const { movimentos } = calcularStatsDerivados({ ...personagem, atributo_velocidade: novaVelocidade });
    const { data, error } = await atualizarPersonagem(personagem.id, {
      atributo_velocidade: novaVelocidade,
      movimentos,
    });
    if (error) setErro(error.message);
    else setPersonagem((atual) => ({ ...atual, ...data }));
  }

  // Coragem -> Ações de Combate (idem).
  async function salvarCoragem(novaCoragem) {
    const { acoes_combate } = calcularStatsDerivados({ ...personagem, atributo_coragem: novaCoragem });
    const { data, error } = await atualizarPersonagem(personagem.id, {
      atributo_coragem: novaCoragem,
      acoes_combate,
    });
    if (error) setErro(error.message);
    else setPersonagem((atual) => ({ ...atual, ...data }));
  }

  // Stepper +/- de Máximo de Vida / Máximo de Dor — ajuste manual por
  // cima do valor derivado do atributo (só Vida tem fórmula; Dor nunca
  // teve, sempre foi livre).
  async function ajustarMaxVida(novoMax) {
    const novaAtual = ajustarComMaximo({
      maxAntigo: personagem.circulos_vida_max,
      maxNovo: novoMax,
      atual: personagem.circulos_vida_atual,
    });
    const { data, error } = await atualizarPersonagem(personagem.id, {
      circulos_vida_max: novoMax,
      circulos_vida_atual: novaAtual,
    });
    if (error) setErro(error.message);
    else setPersonagem((atual) => ({ ...atual, ...data }));
  }

  async function ajustarMaxDor(novoMax) {
    const novaAtual = ajustarComMaximo({
      maxAntigo: personagem.circulos_dor_max,
      maxNovo: novoMax,
      atual: personagem.circulos_dor_atual,
    });
    const { data, error } = await atualizarPersonagem(personagem.id, {
      circulos_dor_max: novoMax,
      circulos_dor_atual: novaAtual,
    });
    if (error) setErro(error.message);
    else setPersonagem((atual) => ({ ...atual, ...data }));
  }

  // Ferimento direto na Vida — bypassa a Dor por completo, nunca mexe
  // no Máximo. +/-1 por toque (pensado pro celular).
  async function ajustarVidaAtual(delta) {
    const nova = ajustarValorSimples({
      atual: personagem.circulos_vida_atual,
      max: personagem.circulos_vida_max,
      delta,
    });
    if (nova === personagem.circulos_vida_atual) return;
    const { data, error } = await atualizarPersonagem(personagem.id, { circulos_vida_atual: nova });
    if (error) setErro(error.message);
    else setPersonagem((atual) => ({ ...atual, ...data }));
  }

  // Ferimento direto na Dor — subir (curar) é simples; descer aciona a
  // regra de "quebra de resistência" (src/lib/regras.js) igual antes,
  // só que agora 1 ponto por toque em vez de digitar um número.
  async function ajustarDorAtual(delta) {
    if (delta > 0) {
      const nova = ajustarValorSimples({
        atual: personagem.circulos_dor_atual,
        max: personagem.circulos_dor_max,
        delta,
      });
      if (nova === personagem.circulos_dor_atual) return;
      const { data, error } = await atualizarPersonagem(personagem.id, { circulos_dor_atual: nova });
      if (error) setErro(error.message);
      else setPersonagem((atual) => ({ ...atual, ...data }));
      setMensagemDor('');
      return;
    }

    const resultado = aplicarDano({
      vidaAtual: personagem.circulos_vida_atual,
      vidaMax: personagem.circulos_vida_max,
      dorAtual: personagem.circulos_dor_atual,
      dorMax: personagem.circulos_dor_max,
      dano: 1,
    });

    const { data, error } = await atualizarPersonagem(personagem.id, {
      circulos_vida_atual: resultado.vidaAtual,
      circulos_dor_atual: resultado.dorAtual,
    });

    if (error) {
      setErro(error.message);
      return;
    }
    setPersonagem((atual) => ({ ...atual, ...data }));
    setMensagemDor(
      resultado.quebras > 0
        ? resultado.caido
          ? 'Quebra de resistência — Vida chegou a 0.'
          : 'Quebra de resistência! Vida −1.'
        : ''
    );
  }

  async function handleMarcarEfeitoDor(n) {
    const { data, error } = await atualizarPersonagem(personagem.id, { efeito_dor_atual: n });
    if (error) setErro(error.message);
    else setPersonagem((atual) => ({ ...atual, ...data }));
  }

  // Recarrega uma arma a partir do pool de munição certo (leve/pesada,
  // Recarrega uma arma a partir do pool de munição certo (leve/pesada,
  // conforme arma.meio_transporte) — mexe em duas tabelas (weapons e
  // personagens) então mora aqui, não dentro de TabelaArmas.
  // `quantidade` (opcional): default enche até o máximo (Recarregar);
  // passe 1 pra um "+1" parcial (uma bala avulsa).
  async function handleRecarregarArma(arma, quantidade) {
    const campoPool = arma.meio_transporte === 'coldre' ? 'municao_leve_atual' : 'municao_pesada_atual';
    const poolAtual = personagem[campoPool] ?? 0;

    const resultado = aplicarRecarga({
      municaoAtual: arma.municao_atual ?? 0,
      municaoMax: arma.municao_max ?? 0,
      poolAtual,
      ...(quantidade !== undefined && { quantidade }),
    });

    const [resArma, resPersonagem] = await Promise.all([
      atualizarArma(arma.id, { municao_atual: resultado.municaoAtual }),
      atualizarPersonagem(personagem.id, { [campoPool]: resultado.poolAtual }),
    ]);

    const erroRecarga = resArma.error || resPersonagem.error;
    if (erroRecarga) {
      setErro(erroRecarga.message);
      return null;
    }
    setPersonagem((atual) => ({ ...atual, ...resPersonagem.data }));
    return { municaoAtual: resultado.municaoAtual };
  }

  if (carregando) return <p style={{ padding: '2rem' }}>Carregando...</p>;
  if (!personagem) return <p style={{ padding: '2rem' }}>Personagem não encontrado (ou sem acesso).</p>;

  const pontosAtributo =
    personagem.atributo_fisico + personagem.atributo_velocidade + personagem.atributo_intelecto + personagem.atributo_coragem;
  const budgetAntecedentes = 4 + personagem.atributo_intelecto;
  const pontosAntecedentes = ANTECEDENTES.reduce((soma, a) => soma + personagem[a.campo], 0);
  const caido = personagem.circulos_vida_atual <= 0;
  const capacidadeMunicao = calcularCapacidadeMunicaoDeArmas(armas);
  const pesoItensAtual = itens.reduce((soma, i) => soma + Number(i.espaco ?? 0) * Number(i.quantidade ?? 1), 0);
  const pesoMunicaoExcedente = calcularPesoMunicaoExcedente({
    municaoLeveAtual: personagem.municao_leve_atual,
    capacidadeLeve: capacidadeMunicao.leve,
    municaoPesadaAtual: personagem.municao_pesada_atual,
    capacidadePesada: capacidadeMunicao.pesada,
  });
  const limiteRestanteParaMunicao = personagem.espaco_max - pesoItensAtual;

  return (
    <main className="ficha">
      <p><Link to="/painel">&larr; Voltar</Link></p>

      <header className="ficha-header">
        <div className="ficha-nome">
          <CampoEditavel
            label="Nome"
            tipo="text"
            valor={personagem.nome}
            editavel={canEdit}
            onSalvar={(v) => salvarCampo('nome', v)}
          />
        </div>
      </header>

      {erro && <p className="erro">{erro}</p>}
      {!canEdit && (
        <p className="aviso-somente-leitura">
          Você está vendo a ficha de outro personagem — só o dono (ou o Admin) pode editar.
        </p>
      )}

      <details>
        <summary>Condições iniciais (referência)</summary>
        <p>
          6 Círculos de Vida, 6 Círculos de Dor, 1 Ação de Combate, 1 Movimento,
          4 Pontos de Antecedente, 4 Pontos de Atributo, Defesa 5.
        </p>
      </details>

      <section>
        <h2>Atributos</h2>
        <p className="detalhe-secundario">
          Pontos usados: {pontosAtributo} / 4 (guia de criação — não travado aqui)
        </p>
        <div className="grid-campos bloco-atributos-preto">
          <CampoEditavel
            label="Físico" valor={personagem.atributo_fisico} min={0} editavel={canEdit}
            onSalvar={salvarFisico}
            dica="+1 Círculo de Vida máx. para cada ponto aqui."
          />
          <CampoEditavel
            label="Velocidade" valor={personagem.atributo_velocidade} min={0} editavel={canEdit}
            onSalvar={salvarVelocidade}
            dica="+1 Movimento para cada ponto aqui."
          />
          <CampoEditavel
            label="Intelecto" valor={personagem.atributo_intelecto} min={0} editavel={canEdit}
            onSalvar={(v) => salvarCampo('atributo_intelecto', v)}
            dica="+1 no orçamento de Antecedentes para cada ponto aqui."
          />
          <CampoEditavel
            label="Coragem" valor={personagem.atributo_coragem} min={0} editavel={canEdit}
            onSalvar={salvarCoragem}
            dica="+1 Ação de Combate para cada ponto aqui."
          />
        </div>
      </section>

      <section>
        <h2>Antecedentes</h2>
        <p className="detalhe-secundario">
          Pontos usados: {pontosAntecedentes} / {budgetAntecedentes} (4 + Intelecto — guia, não travado)
        </p>
        <div className="grid-campos">
          {ANTECEDENTES.map((a) => (
            <div key={a.campo} className="antecedente-bloco">
              <strong>{a.label}</strong>
              <span className="antecedente-formula">1d6 + {personagem[a.campo]}</span>
              <TrilhaCirculos
                max={5}
                valor={personagem[a.campo]}
                editavel={canEdit}
                variante="neutro"
                onSelecionar={(v) => salvarCampo(a.campo, v)}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Combate</h2>
        <p className="detalhe-secundario">Movimentos e Ações de Combate são derivados dos Atributos acima.</p>
        <div className="grid-campos">
          <CampoEditavel label="Movimentos" valor={personagem.movimentos} editavel={false} onSalvar={() => {}} />
          <CampoEditavel label="Ações de Combate" valor={personagem.acoes_combate} editavel={false} onSalvar={() => {}} />
          <CampoEditavel label="Iniciativa" valor={personagem.iniciativa} editavel={canEdit}
            onSalvar={(v) => salvarCampo('iniciativa', v)} />
          <CampoEditavel label="Defesa" valor={personagem.defesa} min={0} editavel={canEdit}
            onSalvar={(v) => salvarCampo('defesa', v)} />
        </div>
      </section>

      <section>
        <h2>
          Círculos de Vida e Dor
          {caido && <span className="badge-caido">Caído</span>}
        </h2>
        <div className="grid-circulos">
          <div>
            <h4>Vida</h4>
            <CampoStepper label="Máximo de Vida" valor={personagem.circulos_vida_max} min={1} editavel={canEdit} onSalvar={ajustarMaxVida} />
            <LinhaCirculosAjustavel
              max={personagem.circulos_vida_max}
              valor={personagem.circulos_vida_atual}
              editavel={canEdit}
              variante="vida"
              legenda={`${personagem.circulos_vida_atual}/${personagem.circulos_vida_max}`}
              onAjustar={ajustarVidaAtual}
              onSelecionarCirculo={(v) => salvarCampo('circulos_vida_atual', v)}
            />
          </div>
          <div>
            <h4>Dor</h4>
            <CampoStepper label="Máximo de Dor" valor={personagem.circulos_dor_max} min={1} editavel={canEdit} onSalvar={ajustarMaxDor} />
            <LinhaCirculosAjustavel
              max={personagem.circulos_dor_max}
              valor={personagem.circulos_dor_atual}
              editavel={canEdit}
              variante="dor"
              legenda={`${personagem.circulos_dor_atual}/${personagem.circulos_dor_max}`}
              onAjustar={ajustarDorAtual}
              onSelecionarCirculo={(v) => salvarCampo('circulos_dor_atual', v)}
            />
            {mensagemDor && <small className="campo-dica">{mensagemDor}</small>}
          </div>
        </div>

        <EfeitoDorPopup efeitoAtual={personagem.efeito_dor_atual} onMarcar={handleMarcarEfeitoDor} editavel={canEdit} />
      </section>

      <section>
        <h2>Habilidades</h2>
        <Habilidades personagemId={personagem.id} habilidades={habilidades} onMudar={setHabilidades} editavel={canEdit} />
      </section>

      <section>
        <h2>Itens</h2>
        {canEdit && (
          <div className="campo-espaco-max">
            <CampoEditavel label="Peso máximo" valor={personagem.espaco_max} min={0} editavel={canEdit}
              onSalvar={(v) => salvarCampo('espaco_max', v)} />
          </div>
        )}
        {pesoMunicaoExcedente > 0 && (
          <p className="detalhe-secundario">
            {pesoMunicaoExcedente.toFixed(2)} de carga já contando com munição excedente (ver Armas, abaixo).
          </p>
        )}
        <TabelaItens
          itens={itens}
          onMudar={setItens}
          editavel={canEdit}
          limiteEspaco={personagem.espaco_max}
          pesoAdicional={pesoMunicaoExcedente}
          onAdicionar={() => criarItem(personagem.id, itens.length)}
          onExcluirTodos={() => removerTodosItensPersonagem(personagem.id)}
        />
      </section>

      <section>
        <h2>Armas</h2>
        <MunicaoPool
          capacidade={capacidadeMunicao}
          atualLeve={personagem.municao_leve_atual}
          atualPesada={personagem.municao_pesada_atual}
          limiteRestante={limiteRestanteParaMunicao}
          onSalvar={salvarCampo}
          editavel={canEdit}
        />
        <TabelaArmas
          personagemId={personagem.id}
          armas={armas}
          onMudar={setArmas}
          editavel={canEdit}
          onRecarregar={handleRecarregarArma}
          poolLeve={personagem.municao_leve_atual}
          poolPesada={personagem.municao_pesada_atual}
        />
      </section>

      <section>
        <h2>Dinheiro</h2>
        <div className="grid-campos">
          <CampoEditavel label="Dinheiro" valor={personagem.dinheiro} min={0} editavel={canEdit}
            onSalvar={(v) => salvarCampo('dinheiro', v)} />
          <CampoEditavel label="Valor da recompensa" valor={personagem.valor_recompensa} min={0} editavel={canEdit}
            onSalvar={(v) => salvarCampo('valor_recompensa', v)} />
        </div>
      </section>

      <section>
        <h2>Montaria</h2>
        <Montaria personagemId={personagem.id} montaria={montaria} onMudar={setMontaria} editavel={canEdit} />
      </section>
    </main>
  );
}