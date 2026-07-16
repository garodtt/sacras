import { useEffect, useState } from 'react';
import { calcularPesoMunicaoExcedente } from '../../lib/regras.js';
import PopupReferencia from '../combate/PopupReferencia.jsx';

// Munição de RESERVA (leve = coldre, pesada = bandoleira). Capacidade
// vem das ARMAS (meio_transporte, src/lib/regras.js) — cada arma no
// coldre/bandoleira já "traz" a capacidade junto.
//
// 13/07: os dois campos tinham `defaultValue`, que só lê o valor UMA
// VEZ (na primeira montagem) — por isso, depois de recarregar uma arma
// (que muda esse número por fora, sem passar por este input), o campo
// ficava "preso" no valor antigo até recarregar a página inteira.
// Agora usa buffer local + useEffect (mesmo padrão do CampoEditavel.jsx)
// pra acompanhar mudanças vindas de fora.
//
// Passar da capacidade continua permitido — só o excedente (o que não
// cabe no coldre/bandoleira) passa a contar como peso no inventário
// (0,08 por bala leve, 0,25 por pesada). `limiteRestante` é o que sobra
// de carga depois dos itens — se o excedente não couber nisso, a trava
// impede salvar (e o campo volta pro valor de antes).
export default function MunicaoPool({ capacidade, atualLeve, atualPesada, limiteRestante, onSalvar, editavel }) {
  const [bufferLeve, setBufferLeve] = useState(atualLeve ?? 0);
  const [bufferPesada, setBufferPesada] = useState(atualPesada ?? 0);
  const [erro, setErro] = useState('');
  const [ajudaAberta, setAjudaAberta] = useState(false);

  useEffect(() => {
    setBufferLeve(atualLeve ?? 0);
  }, [atualLeve]);

  useEffect(() => {
    setBufferPesada(atualPesada ?? 0);
  }, [atualPesada]);

  // Devolve true se salvou, false se rejeitou (chamador decide o que
  // fazer com o buffer nos dois casos).
  function validarESalvar(campo, valor, capacidadeDoTipo, outroAtual, outraCapacidade, ehLeve) {
    const novoExcedente = ehLeve
      ? calcularPesoMunicaoExcedente({
          municaoLeveAtual: valor,
          capacidadeLeve: capacidadeDoTipo,
          municaoPesadaAtual: outroAtual,
          capacidadePesada: outraCapacidade,
        })
      : calcularPesoMunicaoExcedente({
          municaoLeveAtual: outroAtual,
          capacidadeLeve: outraCapacidade,
          municaoPesadaAtual: valor,
          capacidadePesada: capacidadeDoTipo,
        });

    if (novoExcedente > limiteRestante) {
      setErro(`Não cabe: o excedente de munição passaria da carga disponível (${limiteRestante.toFixed(2)}).`);
      return false;
    }
    setErro('');
    onSalvar(campo, valor);
    return true;
  }

  return (
    <div className="municao-pool-bloco">
      <div className="municao-pool-cabecalho">
        <strong>Munição de reserva</strong>
        <button type="button" className="botao-ajuda" onClick={() => setAjudaAberta(true)} aria-label="Como funciona a munição">
          ?
        </button>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <div className="grid-campos municao-pool">
        <label className="campo-editavel">
          <span>Munição leve — reserva ({capacidade.leve} sem pesar)</span>
          <input
            type="number"
            min="0"
            value={bufferLeve}
            disabled={!editavel}
            onChange={(e) => setBufferLeve(e.target.value)}
            onBlur={() => {
              const novo = Math.max(0, Number(bufferLeve) || 0);
              if (novo === atualLeve) {
                setBufferLeve(atualLeve ?? 0);
                return;
              }
              const salvou = validarESalvar('municao_leve_atual', novo, capacidade.leve, atualPesada, capacidade.pesada, true);
              if (!salvou) setBufferLeve(atualLeve ?? 0);
            }}
          />
          <small className="campo-dica">
            Armas no coldre definem a capacidade. Acima disso, cada bala pesa 0,08 no inventário.
          </small>
        </label>
        <label className="campo-editavel">
          <span>Munição pesada — reserva ({capacidade.pesada} sem pesar)</span>
          <input
            type="number"
            min="0"
            value={bufferPesada}
            disabled={!editavel}
            onChange={(e) => setBufferPesada(e.target.value)}
            onBlur={() => {
              const novo = Math.max(0, Number(bufferPesada) || 0);
              if (novo === atualPesada) {
                setBufferPesada(atualPesada ?? 0);
                return;
              }
              const salvou = validarESalvar('municao_pesada_atual', novo, capacidade.pesada, atualLeve, capacidade.leve, false);
              if (!salvou) setBufferPesada(atualPesada ?? 0);
            }}
          />
          <small className="campo-dica">
            Armas na bandoleira definem a capacidade. Acima disso, cada bala pesa 0,25 no inventário.
          </small>
        </label>
      </div>

      <PopupReferencia titulo="Como funciona a munição" aberto={ajudaAberta} onFechar={() => setAjudaAberta(false)}>
        <p>
          Cada arma no <strong>coldre</strong> traz junto 36 balas <strong>leves</strong> de capacidade; cada arma na{' '}
          <strong>bandoleira</strong> traz 24 <strong>pesadas</strong>. É como se o coldre/bandoleira "viesse" com a
          arma — não é um item separado.
        </p>
        <p>
          Munição dentro dessa capacidade <strong>não pesa nada</strong> no inventário — já é considerada guardada
          direto na arma. Se você tiver <strong>mais</strong> munição do que essa capacidade (por exemplo, achou
          balas extras numa missão), o que sobra pesa normalmente (0,08 por bala leve, 0,25 por pesada) e entra na
          conta de carga dos Itens.
        </p>
        <p>
          "Recarregar" numa arma (aba Combate, tabela de Armas) puxa dessa reserva pro carregador da arma — se
          reduzir a reserva pra dentro da capacidade de novo, o peso extra desaparece sozinho.
        </p>
      </PopupReferencia>
    </div>
  );
}