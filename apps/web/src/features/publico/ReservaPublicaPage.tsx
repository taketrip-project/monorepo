import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Button } from '../../ui';
import { ApiError } from '../../lib/api/client';
import { obterSituacaoReservaPublica, type SituacaoReservaPublica } from '../../lib/api/publico';
import { formatDataCurta, formatHora, formatMoeda } from '../../lib/format';
import {
  STATUS_PAGAMENTO_LABEL,
  STATUS_PAGAMENTO_TONE,
  STATUS_RESERVA_LABEL,
  STATUS_RESERVA_TONE,
} from '../excursoes/reservaLabels';
import { PublicoLayout } from './PublicoLayout';
import './publico.css';

/**
 * Intervalo do polling enquanto o pagamento está pendente — o rate limit da
 * rota é 60/min por IP; 8s fica bem folgado e ainda dá a sensação de "virou
 * Pago sozinho" quando o webhook PIX confirmar.
 */
const POLL_MS = 8_000;
/** Backoff quando uma consulta do polling falha (rede instável, 429 sem Retry-After). */
const POLL_ERRO_MS = 30_000;

type ErroCarregamento = { tipo: 'nao_encontrada' } | { tipo: 'muitas_tentativas'; retryAfterSeconds?: number } | { tipo: 'rede' };

function deveContinuarPolling(situacao: SituacaoReservaPublica): boolean {
  return situacao.status === 'ativa' && situacao.status_pagamento === 'pendente';
}

/**
 * Elemento da rota /r/{reservaId}: remonta a página (via `key`) quando o
 * reservaId muda numa navegação SPA — zera situação/erro/polling antigos em
 * vez de mostrar a reserva anterior enquanto a nova carrega.
 */
export function ReservaPublicaRoute() {
  const { reservaId } = useParams<{ reservaId: string }>();
  return <ReservaPublicaPage key={reservaId} />;
}

/**
 * Situação da reserva para o passageiro — rota /r/{reservaId} (H3.2). O UUID
 * é o token de posse: só quem reservou recebeu o link. Faz polling curto
 * enquanto o pagamento está pendente; a transição Pendente → Pago acontece
 * sem refresh (sucesso esperado é silencioso: cor + texto, sem modal).
 */
export function ReservaPublicaPage() {
  const { reservaId } = useParams<{ reservaId: string }>();

  const [situacao, setSituacao] = useState<SituacaoReservaPublica | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<ErroCarregamento | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [copiado, setCopiado] = useState(false);

  // Nas falhas DURANTE o polling (já temos dados na tela) não trocamos a tela
  // por erro — seguimos mostrando o último estado e tentamos de novo devagar.
  const temDadosRef = useRef(false);

  useEffect(() => {
    if (!reservaId) return;
    let cancelado = false;
    let timer: number | undefined;

    const consultar = async () => {
      try {
        const dados = await obterSituacaoReservaPublica(reservaId);
        if (cancelado) return;
        temDadosRef.current = true;
        setSituacao(dados);
        setErro(null);
        setCarregando(false);
        if (deveContinuarPolling(dados)) {
          timer = window.setTimeout(consultar, POLL_MS);
        }
      } catch (error) {
        if (cancelado) return;
        setCarregando(false);
        if (error instanceof ApiError && error.status === 404) {
          setErro({ tipo: 'nao_encontrada' });
          return; // link errado não melhora sozinho — sem retry.
        }
        const retryMs =
          error instanceof ApiError && error.codigo === 'muitas_tentativas' && error.retryAfterSeconds
            ? error.retryAfterSeconds * 1000
            : POLL_ERRO_MS;
        if (temDadosRef.current) {
          // Mantém a tela com o último estado e tenta de novo mais devagar.
          timer = window.setTimeout(consultar, retryMs);
          return;
        }
        if (error instanceof ApiError && error.codigo === 'muitas_tentativas') {
          setErro({ tipo: 'muitas_tentativas', retryAfterSeconds: error.retryAfterSeconds });
        } else {
          setErro({ tipo: 'rede' });
        }
      }
    };

    consultar();
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [reservaId, tentativa]);

  useEffect(() => {
    if (situacao) document.title = `Sua reserva · ${situacao.destino} · taketrip`;
  }, [situacao]);

  const copiarPix = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2_400);
    } catch {
      // Sem clipboard (contexto inseguro) — o código continua visível para copiar na mão.
    }
  };

  if (carregando) {
    return (
      <PublicoLayout>
        <p className="tt-publico-mute" role="status">
          Carregando sua reserva...
        </p>
      </PublicoLayout>
    );
  }

  if (erro || !situacao) {
    return (
      <PublicoLayout>
        <div className="tt-publico-vazio">
          {erro?.tipo === 'nao_encontrada' ? (
            <>
              <span className="tt-publico-vazio-icone" aria-hidden="true">
                🔎
              </span>
              <h1 className="tt-publico-vazio-titulo">Reserva não encontrada</h1>
              <p className="tt-publico-mute">Confira se o link está completo, igualzinho ao que você recebeu.</p>
            </>
          ) : erro?.tipo === 'muitas_tentativas' ? (
            <>
              <span className="tt-publico-vazio-icone" aria-hidden="true">
                ⏳
              </span>
              <h1 className="tt-publico-vazio-titulo">Muita gente acessando</h1>
              <p className="tt-publico-mute">
                {erro.retryAfterSeconds
                  ? `Espere ${erro.retryAfterSeconds}s e tente de novo.`
                  : 'Espere um pouquinho e tente de novo.'}
              </p>
              <Button variant="secondary" onClick={() => setTentativa((t) => t + 1)}>
                Tentar de novo
              </Button>
            </>
          ) : (
            <>
              <span className="tt-publico-vazio-icone" aria-hidden="true">
                📡
              </span>
              <h1 className="tt-publico-vazio-titulo">Sem conexão</h1>
              <p className="tt-publico-mute">Não conseguimos carregar sua reserva. Confira sua internet.</p>
              <Button variant="secondary" onClick={() => setTentativa((t) => t + 1)}>
                Tentar de novo
              </Button>
            </>
          )}
        </div>
      </PublicoLayout>
    );
  }

  const pagamentoConfirmado = situacao.status_pagamento === 'pago' || situacao.status_pagamento === 'sinal_pago';

  return (
    <PublicoLayout>
      <header className="tt-publico-header">
        <div className="tt-publico-badges">
          <Badge tone={STATUS_RESERVA_TONE[situacao.status]}>{STATUS_RESERVA_LABEL[situacao.status]}</Badge>
          <Badge tone={STATUS_PAGAMENTO_TONE[situacao.status_pagamento]}>
            {STATUS_PAGAMENTO_LABEL[situacao.status_pagamento]}
          </Badge>
        </div>
        <h1 className="tt-publico-destino">{situacao.destino}</h1>
        <p className="tt-publico-sub">
          Saída{' '}
          <span className="tt-mono">
            {formatDataCurta(situacao.data_saida)} · {formatHora(situacao.data_saida)}
          </span>
        </p>
      </header>

      <section className="tt-publico-card" aria-label="Sua poltrona">
        <div className="tt-publico-reserva-poltrona">
          <span className="tt-publico-reserva-poltrona-numero">{situacao.poltrona}</span>
          <span className="tt-publico-reserva-poltrona-label">sua poltrona</span>
        </div>

        {situacao.status === 'expirada' && (
          <p className="tt-publico-alert tt-publico-alert--warning" role="status">
            <span aria-hidden="true">⏰</span> Sua reserva expirou e a poltrona foi liberada. Se ainda quiser
            ir, reserve de novo pelo link da excursão.
          </p>
        )}
        {situacao.status === 'cancelada' && (
          <p className="tt-publico-alert tt-publico-alert--danger" role="status">
            <span aria-hidden="true">✕</span> Esta reserva foi cancelada. Qualquer dúvida, fale com o
            organizador pelo WhatsApp.
          </p>
        )}
        {situacao.status !== 'expirada' && situacao.status !== 'cancelada' && pagamentoConfirmado && (
          <p className="tt-publico-alert tt-publico-alert--success" role="status">
            <span aria-hidden="true">✓</span>{' '}
            {situacao.status_pagamento === 'pago'
              ? 'Pagamento confirmado. Boa viagem!'
              : 'Sinal confirmado — sua poltrona está garantida!'}
          </p>
        )}
        {situacao.status === 'ativa' && situacao.status_pagamento === 'pendente' && situacao.instrucoes && (
          <p className="tt-publico-alert tt-publico-alert--warning" role="status">
            <span aria-hidden="true">🕐</span> {situacao.instrucoes}
          </p>
        )}
      </section>

      {situacao.cobranca && situacao.status === 'ativa' && situacao.status_pagamento === 'pendente' && (
        <section className="tt-publico-card" aria-label="Pagamento PIX">
          <h2 className="tt-publico-card-title">
            Pague com PIX ·{' '}
            <span className="tt-mono">{formatMoeda(situacao.cobranca.valor_centavos)}</span>
          </h2>
          <img
            className="tt-publico-qr"
            alt="QR code do PIX"
            src={
              situacao.cobranca.qr_code_base64.startsWith('data:')
                ? situacao.cobranca.qr_code_base64
                : `data:image/png;base64,${situacao.cobranca.qr_code_base64}`
            }
          />
          <p className="tt-publico-copia-cola">{situacao.cobranca.copia_e_cola}</p>
          <Button variant="soft" fullWidth onClick={() => copiarPix(situacao.cobranca!.copia_e_cola)}>
            {copiado ? 'Copiado ✓' : 'Copiar código PIX'}
          </Button>
          <p className="tt-publico-mute">Assim que o PIX cair, esta página atualiza sozinha.</p>
        </section>
      )}

      <p className="tt-publico-mute">Guarde este link — é por ele que você acompanha sua reserva.</p>
    </PublicoLayout>
  );
}
