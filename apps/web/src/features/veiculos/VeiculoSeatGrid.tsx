import type { Layout } from '../../lib/api/fleet';
import './VeiculoSeatGrid.css';

export interface VeiculoSeatGridProps {
  layout: Layout;
  poltronasBloqueadas: number[];
  /** Presente = grade interativa (toque alterna bloqueado/desbloqueado); ausente = só leitura (preview do cadastro). */
  onTogglePoltrona?: (numero: number) => void;
}

/**
 * Grade read-only (ou com toque local para bloquear/desbloquear) do layout
 * de poltronas gerado pelo servidor. NÃO é o SeatMap interativo de reservas
 * (H1.8, depende do módulo bookings) — aqui não existem estados
 * paid/pending/selected, só livre/bloqueada.
 */
export function VeiculoSeatGrid({ layout, poltronasBloqueadas, onTogglePoltrona }: VeiculoSeatGridProps) {
  const bloqueadasSet = new Set(poltronasBloqueadas);

  return (
    <div className="tt-seatgrid" role="group" aria-label="Layout de poltronas">
      {layout.fileiras.map((fileira, indiceFileira) => (
        <div className="tt-seatgrid-fileira" key={indiceFileira}>
          {fileira.map((numero, indiceColuna) => {
            if (numero === null) {
              return <span className="tt-seatgrid-corredor" key={indiceColuna} aria-hidden="true" />;
            }

            const bloqueada = bloqueadasSet.has(numero);
            const classes = ['tt-seatgrid-poltrona', bloqueada ? 'tt-seatgrid-poltrona--blocked' : '']
              .filter(Boolean)
              .join(' ');
            const conteudo = (
              <>
                {bloqueada && (
                  <span aria-hidden="true" className="tt-seatgrid-icon">
                    🔒
                  </span>
                )}
                <span className="tt-seatgrid-numero">{numero}</span>
              </>
            );

            if (onTogglePoltrona) {
              return (
                <button
                  type="button"
                  key={indiceColuna}
                  className={classes}
                  onClick={() => onTogglePoltrona(numero)}
                  aria-pressed={bloqueada}
                  aria-label={
                    bloqueada
                      ? `Poltrona ${numero}, bloqueada. Toque para desbloquear.`
                      : `Poltrona ${numero}, livre. Toque para bloquear.`
                  }
                >
                  {conteudo}
                </button>
              );
            }

            return (
              <div
                key={indiceColuna}
                className={classes}
                aria-label={bloqueada ? `Poltrona ${numero}, bloqueada` : `Poltrona ${numero}, livre`}
              >
                {conteudo}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
