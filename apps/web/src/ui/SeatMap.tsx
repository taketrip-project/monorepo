import './SeatMap.css';

/**
 * Estado "de negócio" de uma poltrona, igual aos contratos
 * (docs/api/bookings.yaml `Poltrona.estado` no app do organizador;
 * docs/api/publico.yaml `MapaPoltronasPublico` traz o estado reduzido
 * `ocupada` — o público nunca vê pendente/pago nem nomes).
 */
export type SeatMapEstado = 'livre' | 'pendente' | 'sinal_pago' | 'pago' | 'embarcada' | 'bloqueada' | 'ocupada';

export type SeatMapBucket = 'empty' | 'pending' | 'paid' | 'blocked';

export interface SeatMapLegendaItem {
  bucket: SeatMapBucket;
  label: string;
}

export interface SeatMapPoltrona {
  numero: number;
  estado: SeatMapEstado;
  passageiroNome?: string | null;
  /** Repassado sem uso interno — útil pra quem consome `onSeatClick` navegar direto pra ficha da reserva. */
  reservaId?: string | null;
}

export interface SeatMapProps {
  /** Matriz de fileiras; `null` é corredor/vazio (mesmo formato do layout de veículo). */
  fileiras: (number | null)[][];
  poltronas: SeatMapPoltrona[];
  /** Número da poltrona em seleção ativa (ex.: cadastro rápido em andamento) — vence o estado real na exibição. */
  selecionada?: number | null;
  /** Ausente = grade só leitura. Presente = toque em qualquer poltrona não bloqueada/ocupada dispara o callback. */
  onSeatClick?: (poltrona: SeatMapPoltrona) => void;
  /** Legenda de estados abaixo da grade — visível por padrão (frontend-guidelines §8: "legenda sempre visível"). */
  legenda?: boolean;
  /** Itens da legenda — o mapa público usa Livre · Ocupada · Bloqueada (estados reduzidos). */
  legendaItens?: SeatMapLegendaItem[];
  className?: string;
}

/**
 * Visual bucket (tokens de `frontend-guidelines.md` §7 "Mapa de poltronas"):
 * paid · pending · empty · selected · blocked. `sinal_pago` cai no mesmo
 * bucket visual de `pendente` (o design system não define um 6º estado) e
 * `embarcada` cai no bucket de `pago` — o detalhe de embarque mora na Lista
 * de embarque, não no mapa. `ocupada` (mapa público, estados reduzidos)
 * também usa o bucket `paid`: para o passageiro, ocupada = indisponível,
 * mesma linguagem visual da poltrona tomada no app do organizador.
 */
function bucketDoEstado(estado: SeatMapEstado): SeatMapBucket {
  switch (estado) {
    case 'livre':
      return 'empty';
    case 'pendente':
    case 'sinal_pago':
      return 'pending';
    case 'pago':
    case 'embarcada':
    case 'ocupada':
      return 'paid';
    case 'bloqueada':
      return 'blocked';
  }
}

const ESTADO_LABEL: Record<SeatMapEstado, string> = {
  livre: 'livre',
  pendente: 'pendente',
  sinal_pago: 'sinal pago',
  pago: 'pago',
  embarcada: 'embarcada',
  bloqueada: 'bloqueada',
  ocupada: 'ocupada',
};

const LEGENDA_ITENS: SeatMapLegendaItem[] = [
  { bucket: 'paid', label: 'Pago' },
  { bucket: 'pending', label: 'Pendente' },
  { bucket: 'empty', label: 'Livre' },
  { bucket: 'blocked', label: 'Bloqueada' },
];

function IconePorBucket({ bucket }: { bucket: SeatMapBucket | 'selected' }) {
  if (bucket === 'paid') return <span aria-hidden="true">✓</span>;
  if (bucket === 'blocked') return <span aria-hidden="true">🔒</span>;
  return null;
}

export function SeatMap({
  fileiras,
  poltronas,
  selecionada = null,
  onSeatClick,
  legenda = true,
  legendaItens = LEGENDA_ITENS,
  className,
}: SeatMapProps) {
  const porNumero = new Map(poltronas.map((p) => [p.numero, p]));

  return (
    <div className={['tt-seatmap', className ?? ''].filter(Boolean).join(' ')}>
      <div className="tt-seatmap-grid" role="group" aria-label="Mapa de poltronas">
        {fileiras.map((fileira, indiceFileira) => (
          <div className="tt-seatmap-fileira" key={indiceFileira}>
            {fileira.map((numero, indiceColuna) => {
              if (numero === null) {
                return <span className="tt-seatmap-corredor" key={indiceColuna} aria-hidden="true" />;
              }

              const poltrona = porNumero.get(numero);
              if (!poltrona) {
                return <span className="tt-seatmap-corredor" key={indiceColuna} aria-hidden="true" />;
              }

              const isSelecionada = selecionada === numero;
              const bucket = isSelecionada ? 'selected' : bucketDoEstado(poltrona.estado);
              const clicavel =
                Boolean(onSeatClick) && poltrona.estado !== 'bloqueada' && poltrona.estado !== 'ocupada';
              const classes = ['tt-seatmap-poltrona', `tt-seatmap-poltrona--${bucket}`].filter(Boolean).join(' ');

              const rotulo = isSelecionada
                ? `Poltrona ${numero}, selecionada`
                : poltrona.passageiroNome
                  ? `Poltrona ${numero}, ${ESTADO_LABEL[poltrona.estado]}, ${poltrona.passageiroNome}`
                  : `Poltrona ${numero}, ${ESTADO_LABEL[poltrona.estado]}`;

              const conteudo = (
                <>
                  <IconePorBucket bucket={bucket} />
                  <span className="tt-seatmap-numero">{numero}</span>
                </>
              );

              if (clicavel) {
                return (
                  <button
                    type="button"
                    key={indiceColuna}
                    className={classes}
                    onClick={() => onSeatClick?.(poltrona)}
                    aria-pressed={isSelecionada}
                    aria-label={rotulo}
                  >
                    {conteudo}
                  </button>
                );
              }

              return (
                <div key={indiceColuna} className={classes} aria-label={rotulo}>
                  {conteudo}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {legenda && (
        <div className="tt-seatmap-legenda">
          {legendaItens.map((item) => (
            <span key={item.bucket} className="tt-seatmap-legenda-item">
              <span className={`tt-seatmap-legenda-dot tt-seatmap-legenda-dot--${item.bucket}`} aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
