import { useEffect, useState } from 'react';
import { Badge, Button, Input, ListRow } from '../../../../ui';
import { ApiError } from '../../../../lib/api/client';
import { listarReservas, type Reserva, type StatusPagamento } from '../../../../lib/api/bookings';
import { formatMoeda } from '../../../../lib/format';
import { STATUS_PAGAMENTO_LABEL, STATUS_PAGAMENTO_TONE } from '../../reservaLabels';
import '../excursaoDetalhe.css';
import './passageiros.css';

const POR_PAGINA = 20;

const FILTROS: { key: StatusPagamento | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendente', label: 'Pendente' },
  { key: 'sinal_pago', label: 'Sinal pago' },
  { key: 'pago', label: 'Pago' },
  { key: 'cancelado', label: 'Cancelado' },
];

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

interface ReservasListaViewProps {
  excursaoId: string;
  onAbrirFicha: (reservaId: string) => void;
  onImprimir: () => void;
  imprimindo: boolean;
  /** Incrementa para forçar recarregar (ex.: reserva criada no Mapa). */
  refreshKey: number;
}

/**
 * View "Lista" da aba Passageiros (H1.11): busca por nome OU poltrona
 * (tolerante a acento — resolvido no servidor), filtro por status de
 * pagamento, paginação. A criação de reserva mora no Mapa (toque numa vaga
 * livre) — aqui só listamos e navegamos pra ficha.
 */
export function ReservasListaView({ excursaoId, onAbrirFicha, onImprimir, imprimindo, refreshKey }: ReservasListaViewProps) {
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [filtro, setFiltro] = useState<StatusPagamento | 'todos'>('todos');
  const [pagina, setPagina] = useState(1);

  const [reservas, setReservas] = useState<Reserva[] | null>(null);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaDebounced(busca.trim());
      setPagina(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCarregando(true);
      try {
        const resultado = await listarReservas(excursaoId, {
          busca: buscaDebounced || undefined,
          statusPagamento: filtro === 'todos' ? undefined : filtro,
          pagina,
          porPagina: POR_PAGINA,
        });
        if (cancelado) return;
        setReservas(resultado.dados);
        setTotal(resultado.paginacao.total);
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
  }, [excursaoId, buscaDebounced, filtro, pagina, refreshKey]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="tt-excursao-detalhe-tab-content">
      <div className="tt-passageiros-toolbar">
        <Input
          label="Buscar"
          placeholder="Nome ou poltrona"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
        />
        <Button variant="ghost" loading={imprimindo} loadingLabel="Gerando..." onClick={onImprimir}>
          Imprimir lista
        </Button>
      </div>

      <div className="tt-passageiros-filtros" role="group" aria-label="Filtrar por status de pagamento">
        {FILTROS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={[
              'tt-passageiros-filtro-chip',
              filtro === item.key ? 'tt-passageiros-filtro-chip--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={filtro === item.key}
            onClick={() => {
              setFiltro(item.key);
              setPagina(1);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {erro && (
        <p className="tt-excursao-detalhe-alert" role="alert">
          <span aria-hidden="true">⚠️</span> {erro}
        </p>
      )}

      {carregando && !reservas && <p className="tt-excursao-detalhe-mute">Carregando...</p>}

      {reservas && reservas.length === 0 && (
        <p className="tt-excursao-detalhe-mute">
          Nenhuma reserva encontrada. Toque numa poltrona livre no Mapa para reservar.
        </p>
      )}

      {reservas && reservas.length > 0 && (
        <div className="tt-passageiros-lista">
          {reservas.map((reserva) => (
            <ListRow
              key={reserva.id}
              avatar={iniciais(reserva.passageiro.nome)}
              title={reserva.passageiro.nome}
              subtitle={`Poltrona ${reserva.poltrona} · ${formatMoeda(reserva.valor_centavos)}`}
              badge={
                <div className="tt-passageiros-badges">
                  <Badge tone={STATUS_PAGAMENTO_TONE[reserva.status_pagamento]}>
                    {STATUS_PAGAMENTO_LABEL[reserva.status_pagamento]}
                  </Badge>
                  {reserva.status === 'embarcada' && <Badge tone="success">Embarcada</Badge>}
                </div>
              }
              onClick={() => onAbrirFicha(reserva.id)}
            />
          ))}
        </div>
      )}

      {reservas && reservas.length > 0 && totalPaginas > 1 && (
        <div className="tt-passageiros-paginacao">
          <Button variant="ghost" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </Button>
          <span className="tt-mono">
            {pagina}/{totalPaginas}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
