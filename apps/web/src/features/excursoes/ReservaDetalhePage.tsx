import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Input, Sheet } from '../../ui';
import { ApiError } from '../../lib/api/client';
import {
  atualizarReserva,
  atualizarStatusPagamento,
  cancelarReserva,
  desfazerEmbarque,
  marcarEmbarque,
  obterReserva,
  type FormaPagamento,
  type Reserva,
  type StatusPagamento,
} from '../../lib/api/bookings';
import { extractFieldErrors } from '../../lib/api/fieldErrors';
import { obterExcursao, type Excursao } from '../../lib/api/excursions';
import { formatDataHora, formatMoeda } from '../../lib/format';
import {
  FORMAS_PAGAMENTO,
  FORMA_PAGAMENTO_LABEL,
  STATUS_PAGAMENTO_LABEL,
  STATUS_PAGAMENTO_TONE,
  STATUS_RESERVA_LABEL,
  STATUS_RESERVA_TONE,
} from './reservaLabels';
import './excursaoDetalhe/excursaoDetalhe.css';
import './ReservaDetalhePage.css';

/** Próxima(s) transição(ões) de pagamento sugerida(s) — o backend valida de verdade; aqui é só UX. */
const PROXIMO_STATUS_PAGAMENTO: Record<StatusPagamento, Exclude<StatusPagamento, 'pendente'>[]> = {
  pendente: ['sinal_pago', 'pago'],
  sinal_pago: ['pago'],
  pago: [],
  cancelado: [],
};

/**
 * Valor da pendência de estorno ao cancelar — espelha exatamente a regra do
 * backend (`ReservasService.cancelarInterno`, `reservas.service.ts`): para
 * `sinal_pago` OU `pago`, a pendência é o `valor_centavos` CHEIO da reserva,
 * não o sinal proporcional — o MVP não rastreia o valor exato pago por
 * cobrança (isso é do módulo billing, fase 2). NÃO recalcular por sinal.
 */
function calcularValorRecebido(reserva: Reserva): number {
  return reserva.status_pagamento === 'pago' || reserva.status_pagamento === 'sinal_pago'
    ? reserva.valor_centavos
    : 0;
}

export function ReservaDetalhePage() {
  const { reservaId } = useParams<{ reservaId: string }>();
  const navigate = useNavigate();

  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [excursao, setExcursao] = useState<Excursao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [poltrona, setPoltrona] = useState('');
  const [pontoEmbarqueId, setPontoEmbarqueId] = useState('');
  const [valorReais, setValorReais] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | ''>('');

  const [nomeError, setNomeError] = useState<string | undefined>();
  const [poltronaError, setPoltronaError] = useState<string | undefined>();
  const [valorError, setValorError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [poltronasLivresSugeridas, setPoltronasLivresSugeridas] = useState<number[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const [alterandoPagamento, setAlterandoPagamento] = useState(false);
  const [erroPagamento, setErroPagamento] = useState<string | null>(null);

  const [alterandoEmbarque, setAlterandoEmbarque] = useState(false);
  const [erroEmbarque, setErroEmbarque] = useState<string | null>(null);

  const [cancelarSheetAberto, setCancelarSheetAberto] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [cancelarErro, setCancelarErro] = useState<string | null>(null);
  const [valorPendenteEstorno, setValorPendenteEstorno] = useState<number | null>(null);

  const preencherForm = (dados: Reserva) => {
    setNome(dados.passageiro.nome);
    setCpf(dados.passageiro.cpf ?? '');
    setPoltrona(String(dados.poltrona));
    setPontoEmbarqueId(dados.ponto_embarque_id ?? '');
    setValorReais((dados.valor_centavos / 100).toFixed(2));
    setFormaPagamento(dados.forma_pagamento ?? '');
  };

  useEffect(() => {
    if (!reservaId) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      setErroCarregar(null);
      try {
        const dados = await obterReserva(reservaId);
        if (cancelado) return;
        setReserva(dados);
        const excursaoDados = await obterExcursao(dados.excursao_id);
        if (cancelado) return;
        setExcursao(excursaoDados);
        preencherForm(dados);
      } catch (error) {
        if (cancelado) return;
        setErroCarregar(error instanceof ApiError ? error.mensagem : 'Não conseguimos carregar esta reserva.');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [reservaId]);

  const validar = (): boolean => {
    let ok = true;
    if (!nome.trim()) {
      setNomeError('Digite o nome do passageiro.');
      ok = false;
    } else {
      setNomeError(undefined);
    }
    const poltronaNumero = Number.parseInt(poltrona, 10);
    if (Number.isNaN(poltronaNumero) || poltronaNumero < 1) {
      setPoltronaError('Informe um número de poltrona válido.');
      ok = false;
    } else {
      setPoltronaError(undefined);
    }
    const valor = Number.parseFloat(valorReais);
    if (valorReais.trim() === '' || Number.isNaN(valor) || valor < 0) {
      setValorError('Informe um valor válido.');
      ok = false;
    } else {
      setValorError(undefined);
    }
    return ok;
  };

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (!reservaId) return;
    setFormError(null);
    setPoltronasLivresSugeridas(null);
    if (!validar()) return;

    setSalvando(true);
    try {
      const atualizada = await atualizarReserva(reservaId, {
        nome: nome.trim(),
        cpf: cpf.trim() || null,
        poltrona: Number.parseInt(poltrona, 10),
        ponto_embarque_id: pontoEmbarqueId || null,
        valor_centavos: Math.round(Number.parseFloat(valorReais) * 100),
        forma_pagamento: formaPagamento || null,
      });
      setReserva(atualizada);
      setSalvo(true);
      window.setTimeout(() => setSalvo(false), 2400);
    } catch (error) {
      if (error instanceof ApiError && error.codigo === 'poltrona_ocupada') {
        setFormError(error.mensagem);
        const detalhes = error.detalhes as { poltronas_livres?: number[] } | undefined;
        setPoltronasLivresSugeridas(detalhes?.poltronas_livres ?? []);
      } else if (error instanceof ApiError && error.codigo === 'validacao') {
        const campos = extractFieldErrors(error.detalhes);
        let algumCampo = false;
        if (campos.nome) {
          setNomeError(campos.nome);
          algumCampo = true;
        }
        if (campos.poltrona) {
          setPoltronaError(campos.poltrona);
          algumCampo = true;
        }
        if (campos.valor_centavos) {
          setValorError(campos.valor_centavos);
          algumCampo = true;
        }
        if (!algumCampo) setFormError(error.mensagem);
      } else if (error instanceof ApiError) {
        setFormError(error.mensagem);
      } else {
        setFormError('Não conseguimos salvar agora. Tente de novo.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const marcarStatusPagamento = async (status: Exclude<StatusPagamento, 'pendente'>) => {
    if (!reservaId) return;
    setAlterandoPagamento(true);
    setErroPagamento(null);
    try {
      const atualizada = await atualizarStatusPagamento(reservaId, status);
      setReserva(atualizada);
    } catch (error) {
      setErroPagamento(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos atualizar o pagamento agora.',
      );
    } finally {
      setAlterandoPagamento(false);
    }
  };

  const alternarEmbarque = async () => {
    if (!reservaId || !reserva) return;
    setAlterandoEmbarque(true);
    setErroEmbarque(null);
    try {
      const atualizada = reserva.status === 'embarcada' ? await desfazerEmbarque(reservaId) : await marcarEmbarque(reservaId);
      setReserva(atualizada);
    } catch (error) {
      setErroEmbarque(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos atualizar o embarque agora.',
      );
    } finally {
      setAlterandoEmbarque(false);
    }
  };

  const abrirCancelar = () => {
    setMotivoCancelamento('');
    setCancelarErro(null);
    setValorPendenteEstorno(null);
    setCancelarSheetAberto(true);
  };

  const confirmarCancelamento = async () => {
    if (!reservaId || !reserva) return;
    setCancelando(true);
    setCancelarErro(null);
    try {
      const valorRecebido = calcularValorRecebido(reserva);
      const atualizada = await cancelarReserva(reservaId, motivoCancelamento.trim() || null);
      setReserva(atualizada);
      setValorPendenteEstorno(valorRecebido > 0 ? valorRecebido : 0);
    } catch (error) {
      setCancelarErro(error instanceof ApiError ? error.mensagem : 'Não conseguimos cancelar agora. Tente de novo.');
    } finally {
      setCancelando(false);
    }
  };

  if (carregando) {
    return (
      <div className="tt-reserva-detalhe-page">
        <h1 className="tt-reserva-detalhe-title">Reserva</h1>
        <p className="tt-excursao-detalhe-mute">Carregando...</p>
      </div>
    );
  }

  if (erroCarregar || !reserva || !excursao) {
    return (
      <div className="tt-reserva-detalhe-page">
        <h1 className="tt-reserva-detalhe-title">Reserva</h1>
        <p className="tt-excursao-detalhe-alert" role="alert">
          <span aria-hidden="true">⚠️</span> {erroCarregar ?? 'Reserva não encontrada.'}
        </p>
      </div>
    );
  }

  const podeEditar = reserva.status !== 'cancelada' && reserva.status !== 'expirada';
  const podeEmbarcar = reserva.status === 'ativa' || reserva.status === 'embarcada';
  const podeCancelar = reserva.status === 'ativa' || reserva.status === 'embarcada';
  const proximosPagamento = PROXIMO_STATUS_PAGAMENTO[reserva.status_pagamento];

  return (
    <div className="tt-reserva-detalhe-page">
      <h1 className="tt-reserva-detalhe-title">{reserva.passageiro.nome}</h1>
      <p className="tt-excursao-detalhe-mute">
        {excursao.destino} · Poltrona <span className="tt-mono">{reserva.poltrona}</span>
      </p>

      <div className="tt-reserva-detalhe-badges">
        <Badge tone={STATUS_RESERVA_TONE[reserva.status]}>{STATUS_RESERVA_LABEL[reserva.status]}</Badge>
        <Badge tone={STATUS_PAGAMENTO_TONE[reserva.status_pagamento]}>
          {STATUS_PAGAMENTO_LABEL[reserva.status_pagamento]}
        </Badge>
      </div>

      <div className="tt-reserva-detalhe-secao">
        <h2 className="tt-reserva-detalhe-secao-title">Pagamento</h2>
        {erroPagamento && (
          <p className="tt-excursao-detalhe-alert" role="alert">
            <span aria-hidden="true">⚠️</span> {erroPagamento}
          </p>
        )}
        {proximosPagamento.length > 0 ? (
          <div className="tt-excursao-detalhe-sheet-actions">
            {proximosPagamento.map((status) => (
              <Button
                key={status}
                variant="success"
                fullWidth
                loading={alterandoPagamento}
                loadingLabel="Salvando..."
                onClick={() => marcarStatusPagamento(status)}
              >
                Marcar {STATUS_PAGAMENTO_LABEL[status].toLowerCase()}
              </Button>
            ))}
          </div>
        ) : (
          <p className="tt-excursao-detalhe-mute">Nenhuma ação de pagamento disponível.</p>
        )}
      </div>

      <div className="tt-reserva-detalhe-secao">
        <h2 className="tt-reserva-detalhe-secao-title">Embarque</h2>
        {erroEmbarque && (
          <p className="tt-excursao-detalhe-alert" role="alert">
            <span aria-hidden="true">⚠️</span> {erroEmbarque}
          </p>
        )}
        {reserva.status === 'embarcada' && reserva.embarcada_em && (
          <p className="tt-excursao-detalhe-mute">
            Embarcou às <span className="tt-mono">{formatDataHora(reserva.embarcada_em)}</span>
          </p>
        )}
        <Button
          variant={reserva.status === 'embarcada' ? 'secondary' : 'success'}
          fullWidth
          disabled={!podeEmbarcar}
          loading={alterandoEmbarque}
          loadingLabel="Salvando..."
          onClick={alternarEmbarque}
        >
          {reserva.status === 'embarcada' ? 'Desfazer embarque' : 'Marcar embarcado'}
        </Button>
      </div>

      <form className="tt-excursao-detalhe-form" onSubmit={salvar} noValidate>
        <h2 className="tt-reserva-detalhe-secao-title">Dados da reserva</h2>
        <Input
          label="Nome"
          maxLength={120}
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          error={nomeError}
          disabled={!podeEditar}
        />
        <Input
          label="CPF (opcional)"
          value={cpf}
          onChange={(event) => setCpf(event.target.value)}
          disabled={!podeEditar}
        />
        <Input
          label="Poltrona"
          type="number"
          inputMode="numeric"
          min={1}
          value={poltrona}
          onChange={(event) => setPoltrona(event.target.value)}
          error={poltronaError}
          disabled={!podeEditar}
        />

        <div className="tt-excursao-detalhe-field">
          <label className="tt-excursao-detalhe-field-label" htmlFor="reserva-ponto-embarque">
            Ponto de embarque
          </label>
          <select
            id="reserva-ponto-embarque"
            className="tt-excursao-detalhe-select"
            value={pontoEmbarqueId}
            onChange={(event) => setPontoEmbarqueId(event.target.value)}
            disabled={!podeEditar}
          >
            <option value="">Nenhum</option>
            {excursao.pontos_embarque.map((ponto) => (
              <option key={ponto.id} value={ponto.id}>
                {ponto.local}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Valor"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          prefix="R$"
          value={valorReais}
          onChange={(event) => setValorReais(event.target.value)}
          error={valorError}
          disabled={!podeEditar}
        />

        <div className="tt-excursao-detalhe-field">
          <label className="tt-excursao-detalhe-field-label" htmlFor="reserva-forma-pagamento">
            Forma de pagamento
          </label>
          <select
            id="reserva-forma-pagamento"
            className="tt-excursao-detalhe-select"
            value={formaPagamento}
            onChange={(event) => setFormaPagamento(event.target.value as FormaPagamento | '')}
            disabled={!podeEditar}
          >
            <option value="">Não informada</option>
            {FORMAS_PAGAMENTO.map((forma) => (
              <option key={forma} value={forma}>
                {FORMA_PAGAMENTO_LABEL[forma]}
              </option>
            ))}
          </select>
        </div>

        {formError && (
          <p className="tt-excursao-detalhe-alert" role="alert">
            <span aria-hidden="true">⚠️</span> {formError}
          </p>
        )}
        {poltronasLivresSugeridas && poltronasLivresSugeridas.length > 0 && (
          <p className="tt-excursao-detalhe-mute">Poltronas livres: {poltronasLivresSugeridas.join(', ')}</p>
        )}
        {salvo && !formError && (
          <p className="tt-excursao-detalhe-alert tt-excursao-detalhe-alert--success" role="status">
            <span aria-hidden="true">✅</span> Alterações salvas.
          </p>
        )}

        {podeEditar && (
          <Button type="submit" variant="secondary" fullWidth loading={salvando} loadingLabel="Salvando...">
            Salvar alterações
          </Button>
        )}
      </form>

      {podeCancelar && (
        <Button variant="danger" fullWidth size="lg" onClick={abrirCancelar}>
          Cancelar reserva
        </Button>
      )}

      <Sheet open={cancelarSheetAberto} onClose={() => setCancelarSheetAberto(false)} title="Cancelar reserva">
        <div className="tt-excursao-detalhe-sheet-form">
          {valorPendenteEstorno === null ? (
            <>
              <p>Isso libera a poltrona {reserva.poltrona} na hora. Se já tinha pagamento, vira pendência de estorno manual.</p>
              <Input
                label="Motivo (opcional)"
                value={motivoCancelamento}
                onChange={(event) => setMotivoCancelamento(event.target.value)}
                maxLength={500}
              />
              {cancelarErro && (
                <p className="tt-excursao-detalhe-alert" role="alert">
                  <span aria-hidden="true">⚠️</span> {cancelarErro}
                </p>
              )}
              <div className="tt-excursao-detalhe-sheet-actions">
                <Button variant="secondary" fullWidth onClick={() => setCancelarSheetAberto(false)}>
                  Voltar
                </Button>
                <Button
                  variant="danger"
                  fullWidth
                  loading={cancelando}
                  loadingLabel="Cancelando..."
                  onClick={confirmarCancelamento}
                >
                  Cancelar reserva
                </Button>
              </div>
            </>
          ) : (
            <>
              <p>Reserva cancelada. A poltrona {reserva.poltrona} já está livre de novo.</p>
              {valorPendenteEstorno > 0 ? (
                <p>
                  Pendência de estorno (resolva manualmente, fora do sistema):{' '}
                  <span className="tt-mono">{formatMoeda(valorPendenteEstorno)}</span>
                </p>
              ) : (
                <p>Sem pagamento recebido — nenhuma pendência de estorno.</p>
              )}
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setCancelarSheetAberto(false);
                  navigate(-1);
                }}
              >
                Entendi
              </Button>
            </>
          )}
        </div>
      </Sheet>
    </div>
  );
}
