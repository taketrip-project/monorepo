import { useEffect, useState } from 'react';
import { Button, SeatMap, type SeatMapPoltrona } from '../../../../ui';
import { ApiError } from '../../../../lib/api/client';
import { obterMapaPoltronas, type MapaPoltronas } from '../../../../lib/api/bookings';
import '../excursaoDetalhe.css';
import './passageiros.css';

interface MapaPoltronasViewProps {
  excursaoId: string;
  /** Poltrona livre escolhida -> abre o cadastro rápido pré-preenchido. */
  onAbrirCadastro: (poltrona: number) => void;
  /** Poltrona ocupada -> abre a ficha da reserva. */
  onAbrirFicha: (reservaId: string) => void;
  /** Incrementa para forçar recarregar (ex.: reserva criada em outra view). */
  refreshKey: number;
}

/**
 * View "Mapa" da aba Passageiros (H1.8): grade de poltronas com toque em
 * livre selecionando a vaga (sticky bar no rodapé com CTA "Adicionar") e
 * toque em ocupada levando direto pra ficha do passageiro
 * (frontend-guidelines §8 "Mapa de vagas").
 */
export function MapaPoltronasView({ excursaoId, onAbrirCadastro, onAbrirFicha, refreshKey }: MapaPoltronasViewProps) {
  const [mapa, setMapa] = useState<MapaPoltronas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCarregando(true);
      try {
        const dados = await obterMapaPoltronas(excursaoId);
        if (cancelado) return;
        setMapa(dados);
        setErro(null);
      } catch (error) {
        if (cancelado) return;
        setErro(error instanceof ApiError ? error.mensagem : 'Não conseguimos carregar o mapa agora.');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [excursaoId, refreshKey]);

  const aoTocarPoltrona = (poltrona: SeatMapPoltrona) => {
    if (poltrona.estado === 'livre') {
      setSelecionada((atual) => (atual === poltrona.numero ? null : poltrona.numero));
      return;
    }
    if (poltrona.reservaId) onAbrirFicha(poltrona.reservaId);
  };

  if (carregando) {
    return <p className="tt-excursao-detalhe-mute">Carregando mapa...</p>;
  }

  if (!mapa) {
    return (
      <p className="tt-excursao-detalhe-alert" role="alert">
        <span aria-hidden="true">⚠️</span> {erro ?? 'Não conseguimos carregar o mapa de poltronas.'}
      </p>
    );
  }

  return (
    <div className="tt-excursao-detalhe-tab-content">
      <p className="tt-excursao-detalhe-mute">
        <span className="tt-mono">{mapa.vagas}</span> vagas livres de <span className="tt-mono">{mapa.capacidade}</span>
      </p>

      {erro && (
        <p className="tt-excursao-detalhe-alert" role="alert">
          <span aria-hidden="true">⚠️</span> {erro}
        </p>
      )}

      <SeatMap
        fileiras={mapa.layout.fileiras}
        poltronas={mapa.poltronas.map((p) => ({
          numero: p.numero,
          estado: p.estado,
          passageiroNome: p.passageiro_nome,
          reservaId: p.reserva_id,
        }))}
        selecionada={selecionada}
        onSeatClick={aoTocarPoltrona}
      />

      {selecionada !== null && (
        <div className="tt-passageiros-mapa-sticky">
          <span className="tt-passageiros-mapa-sticky-label">
            Poltrona <span className="tt-passageiros-mapa-sticky-numero">{selecionada}</span> selecionada
          </span>
          <Button variant="primary" onClick={() => onAbrirCadastro(selecionada)}>
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
