import './ExcursionCard.css';
import { Badge, type BadgeTone } from './Badge';

/** Espelha StatusExcursao do contrato (docs/api/excursions.yaml). */
export type ExcursionStatus = 'rascunho' | 'publicada' | 'lotada' | 'em_andamento' | 'concluida' | 'cancelada';

// Rótulo é o termo pt-BR do produto (frontend-guidelines §10); nem sempre é
// igual ao nome técnico do estado — ex.: "publicada" aparece como "Aberta".
const STATUS_LABEL: Record<ExcursionStatus, string> = {
  rascunho: 'Rascunho',
  publicada: 'Aberta',
  lotada: 'Lotada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const STATUS_TONE: Record<ExcursionStatus, BadgeTone> = {
  rascunho: 'mute',
  publicada: 'primary',
  lotada: 'warning',
  em_andamento: 'accent',
  concluida: 'success',
  cancelada: 'danger',
};

export interface ExcursionCardProps {
  destino: string;
  status: ExcursionStatus;
  /** Pré-formatado pelo chamador, ex.: "Dom · 15 jun" (ver frontend-guidelines §10). */
  dataLabel: string;
  /** Pré-formatado pelo chamador, ex.: "05:30" (24h). */
  horaLabel: string;
  vagasOcupadas: number;
  vagasTotal: number;
  pagos: number;
  pendentes: number;
  /** Ex.: "em 3 dias" — opcional. */
  prazoLabel?: string;
  onClick?: () => void;
}

/**
 * Card puro — não busca dado, recebe tudo pronto via props (inclusive
 * vagas/capacidade mockadas). Depende só do design system.
 */
export function ExcursionCard({
  destino,
  status,
  dataLabel,
  horaLabel,
  vagasOcupadas,
  vagasTotal,
  pagos,
  pendentes,
  prazoLabel,
  onClick,
}: ExcursionCardProps) {
  const progresso = vagasTotal > 0 ? Math.min(100, (vagasOcupadas / vagasTotal) * 100) : 0;
  const lotada = vagasOcupadas >= vagasTotal;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      className="tt-excursion-card"
      type={onClick ? 'button' : undefined}
      onClick={onClick}
    >
      <div className="tt-excursion-card-top">
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
        {prazoLabel && <span className="tt-excursion-card-meta">{prazoLabel}</span>}
      </div>

      <div className="tt-excursion-card-destino">{destino}</div>

      <div className="tt-excursion-card-datahora">
        <span aria-hidden="true">📅</span>
        <span className="tt-mono">{dataLabel}</span>
        <span aria-hidden="true">⏰</span>
        <span className="tt-mono">{horaLabel}</span>
      </div>

      <div className="tt-excursion-card-vagas">
        <div className="tt-excursion-card-vagas-row">
          <span>
            <span className="tt-mono">
              {vagasOcupadas}/{vagasTotal}
            </span>{' '}
            vagas
          </span>
          <span>
            <span className="tt-mono">{pagos}</span> pagos · <span className="tt-mono">{pendentes}</span> pendentes
          </span>
        </div>
        <div
          className="tt-excursion-card-progress-track"
          role="progressbar"
          aria-valuenow={Math.round(progresso)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${vagasOcupadas} de ${vagasTotal} vagas ocupadas`}
        >
          <div
            className={[
              'tt-excursion-card-progress-fill',
              lotada ? 'tt-excursion-card-progress-fill--lotada' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ width: `${progresso}%` }}
          />
        </div>
      </div>
    </Tag>
  );
}
