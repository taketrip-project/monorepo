import { useEffect, useState } from 'react';
import { ApiError } from '../../../../lib/api/client';
import {
  desfazerEmbarque,
  marcarEmbarque,
  obterListaEmbarque,
  type ListaEmbarque,
} from '../../../../lib/api/bookings';
import { formatHora } from '../../../../lib/format';
import '../excursaoDetalhe.css';
import './passageiros.css';

interface EmbarqueViewProps {
  excursaoId: string;
  refreshKey: number;
}

/**
 * View "Embarque" da aba Passageiros (H1.12): lista agrupada por ponto de
 * embarque, KPI `embarcados/total` no topo, 1 toque marca/desmarca embarque
 * (frontend-guidelines §8 "Embarque"). Falha de rede não apaga a lista já
 * carregada — útil em conexão ruim no dia da viagem.
 */
export function EmbarqueView({ excursaoId, refreshKey }: EmbarqueViewProps) {
  const [lista, setLista] = useState<ListaEmbarque | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [alternandoId, setAlternandoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCarregando(true);
      try {
        const dados = await obterListaEmbarque(excursaoId);
        if (cancelado) return;
        setLista(dados);
        setErro(null);
      } catch (error) {
        if (cancelado) return;
        setErro(error instanceof ApiError ? error.mensagem : 'Não conseguimos carregar a lista agora.');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [excursaoId, refreshKey]);

  const alternarEmbarque = async (reservaId: string, embarcadaAtual: boolean) => {
    if (!lista || alternandoId) return;
    setAlternandoId(reservaId);
    setErro(null);

    // Otimista: reflete na hora, reconcilia (ou desfaz) com a resposta do servidor.
    const anterior = lista;
    const agoraIso = new Date().toISOString();
    setLista({
      ...lista,
      embarcados: lista.embarcados + (embarcadaAtual ? -1 : 1),
      grupos: lista.grupos.map((grupo) => ({
        ...grupo,
        passageiros: grupo.passageiros.map((p) =>
          p.reserva_id === reservaId ? { ...p, embarcada: !embarcadaAtual, embarcada_em: embarcadaAtual ? null : agoraIso } : p,
        ),
      })),
    });

    try {
      const reserva = embarcadaAtual ? await desfazerEmbarque(reservaId) : await marcarEmbarque(reservaId);
      setLista((atual) => {
        if (!atual) return atual;
        return {
          ...atual,
          grupos: atual.grupos.map((grupo) => ({
            ...grupo,
            passageiros: grupo.passageiros.map((p) =>
              p.reserva_id === reservaId
                ? { ...p, embarcada: reserva.status === 'embarcada', embarcada_em: reserva.embarcada_em }
                : p,
            ),
          })),
        };
      });
    } catch (error) {
      setLista(anterior);
      setErro(error instanceof ApiError ? error.mensagem : 'Não conseguimos atualizar o embarque agora.');
    } finally {
      setAlternandoId(null);
    }
  };

  if (carregando && !lista) {
    return <p className="tt-excursao-detalhe-mute">Carregando...</p>;
  }

  if (!lista) {
    return (
      <p className="tt-excursao-detalhe-alert" role="alert">
        <span aria-hidden="true">⚠️</span> {erro ?? 'Não conseguimos carregar a lista de embarque.'}
      </p>
    );
  }

  const progresso = lista.total > 0 ? Math.min(100, (lista.embarcados / lista.total) * 100) : 0;

  return (
    <div className="tt-excursao-detalhe-tab-content">
      <div className="tt-passageiros-kpi">
        <span className="tt-passageiros-kpi-numero">
          {lista.embarcados}/{lista.total} embarcaram
        </span>
        <div
          className="tt-passageiros-kpi-track"
          role="progressbar"
          aria-valuenow={Math.round(progresso)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${lista.embarcados} de ${lista.total} passageiros embarcaram`}
        >
          <div className="tt-passageiros-kpi-fill" style={{ width: `${progresso}%` }} />
        </div>
      </div>

      {erro && (
        <p className="tt-excursao-detalhe-alert" role="alert">
          <span aria-hidden="true">⚠️</span> {erro}
        </p>
      )}

      {lista.grupos.length === 0 && (
        <p className="tt-excursao-detalhe-mute">Nenhum ponto de embarque com passageiros ainda.</p>
      )}

      {lista.grupos.map((grupo) => (
        <div className="tt-passageiros-embarque-grupo" key={grupo.ponto_embarque.id}>
          <div className="tt-passageiros-embarque-grupo-header">
            <span className="tt-passageiros-embarque-grupo-local">{grupo.ponto_embarque.local}</span>
            <span className="tt-passageiros-embarque-grupo-horario tt-mono">
              {formatHora(grupo.ponto_embarque.horario)}
            </span>
          </div>

          {grupo.passageiros.map((passageiro) => (
            <button
              key={passageiro.reserva_id}
              type="button"
              className={[
                'tt-passageiros-embarque-row',
                passageiro.embarcada ? 'tt-passageiros-embarque-row--embarcada' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={alternandoId === passageiro.reserva_id}
              onClick={() => alternarEmbarque(passageiro.reserva_id, passageiro.embarcada)}
              aria-pressed={passageiro.embarcada}
            >
              <span className="tt-passageiros-embarque-info">
                <span className="tt-passageiros-embarque-nome">{passageiro.nome}</span>
                <span className="tt-passageiros-embarque-poltrona tt-mono">Poltrona {passageiro.poltrona}</span>
              </span>
              <span className="tt-passageiros-embarque-status">
                <span aria-hidden="true">{passageiro.embarcada ? '✅' : '⬜'}</span>
                {passageiro.embarcada && passageiro.embarcada_em && (
                  <span className="tt-passageiros-embarque-horario tt-mono">
                    {formatHora(passageiro.embarcada_em)}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
