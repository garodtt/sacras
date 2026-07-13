import { useState } from 'react';

// Texto vem direto da ficha impressa original. Vive aqui agora (não
// mais em Personagem.jsx) porque é o único lugar que ainda usa a lista.
// Exportada (13/07) pra também ser reaproveitada como referência no
// Rastreador de Combate (src/routes/Combate.jsx) — mesma lista, sem
// duplicar.
export const EFEITOS_DOR = [
  { n: 1, nome: 'Atordoamento', efeito: '−1 Ação de Combate no próximo turno.' },
  { n: 2, nome: 'Queda', efeito: 'Gaste 1 Movimento para levantar.' },
  { n: 3, nome: 'Distração', efeito: 'Não pode atacar o mesmo alvo no próximo ataque.' },
  { n: 4, nome: 'Sangramento', efeito: '+1 Dor por turno até o fim do combate.' },
  { n: 5, nome: 'Intimidação', efeito: 'Se afaste do atacante no próximo turno.' },
  { n: 6, nome: 'Desorientação', efeito: 'Testes de Violência −1 no próximo turno.' },
];

// Popup da tabela de efeitos da Dor. Antes (Fase 5/6) a linha ativa era
// calculada a partir dos círculos marcados; agora (13/07) o jogador rola
// 1d6 fisicamente na mesa e só MARCA qual efeito valeu — é uma escolha
// manual (personagem.efeito_dor_atual), não mais uma conta automática.
// Clicar no efeito já marcado desmarca (volta a null).
export default function EfeitoDorPopup({ efeitoAtual, onMarcar, editavel }) {
  const [aberto, setAberto] = useState(false);

  function marcar(n) {
    onMarcar(n === efeitoAtual ? null : n);
    setAberto(false);
  }

  const efeitoAtivo = EFEITOS_DOR.find((e) => e.n === efeitoAtual);

  return (
    <>
      <button type="button" className="botao-efeito-dor" onClick={() => setAberto(true)}>
        {efeitoAtivo ? `Efeito de Dor: ${efeitoAtivo.n}. ${efeitoAtivo.nome}` : 'Marcar efeito de Dor'}
      </button>

      {aberto && (
        <div className="popup-fundo" onClick={() => setAberto(false)}>
          <div className="popup-caixa" onClick={(e) => e.stopPropagation()}>
            <h3>Efeito de Dor</h3>
            <p className="detalhe-secundario">Role 1d6 na mesa e marque o resultado.</p>
            <table className="tabela-efeitos-dor">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Efeito</th>
                  <th>Consequência</th>
                </tr>
              </thead>
              <tbody>
                {EFEITOS_DOR.map((e) => (
                  <tr
                    key={e.n}
                    className={e.n === efeitoAtual ? 'efeito-ativo' : ''}
                    onClick={() => editavel && marcar(e.n)}
                    style={{ cursor: editavel ? 'pointer' : 'default' }}
                  >
                    <td>{e.n}</td>
                    <td>{e.nome}</td>
                    <td>{e.efeito}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={() => setAberto(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
}