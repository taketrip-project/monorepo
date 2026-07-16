import { useState, type FormEvent } from 'react';
import { Badge, Button, Input, Sheet } from '../../ui';
import { ApiError } from '../../lib/api/client';
import {
  criarReservaPublica,
  type ReservaPublicaCriada,
  type TipoPagamentoPublico,
} from '../../lib/api/publico';
import { extractFieldErrors } from '../../lib/api/fieldErrors';
import { isWhatsappValido } from '../../lib/validation';
import { formatMoeda } from '../../lib/format';
import './publico.css';

export interface ReservaFormSheetProps {
  open: boolean;
  onClose: () => void;
  codigo: string;
  /** Nome da organização controladora dos dados — aviso LGPD (ADR 010, Anexo A). */
  organizacaoNome: string;
  /** Poltrona tocada no mapa — sempre pré-selecionada, nunca campo de formulário. */
  poltrona: number | null;
  precoCentavos: number;
  sinalCentavos: number;
  onCriada: (reserva: ReservaPublicaCriada) => void;
  /** 409 poltrona_ocupada/bloqueada — a página atualiza o mapa e limpa a seleção. */
  onConflitoPoltrona: () => void;
}

/**
 * Formulário de reserva do passageiro (H3.2): nome + WhatsApp + CPF opcional
 * + escolha sinal/integral. Zero conta, zero senha. O valor NUNCA é campo —
 * o servidor calcula a partir do preço/sinal da excursão (ADR 008, item 4).
 *
 * Montar com `key` que muda a cada abertura (mesmo padrão do
 * CadastroRapidoSheet) para o formulário nascer sempre limpo.
 */
export function ReservaFormSheet({
  open,
  onClose,
  codigo,
  organizacaoNome,
  poltrona,
  precoCentavos,
  sinalCentavos,
  onCriada,
  onConflitoPoltrona,
}: ReservaFormSheetProps) {
  // Sinal igual (ou maior que) ao preço cheio não é escolha de verdade — o
  // formulário esconde a opção e manda `integral` direto.
  const temSinal = sinalCentavos > 0 && sinalCentavos < precoCentavos;

  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cpf, setCpf] = useState('');
  const [tipoPagamento, setTipoPagamento] = useState<TipoPagamentoPublico>(temSinal ? 'sinal' : 'integral');

  const [nomeError, setNomeError] = useState<string | undefined>();
  const [whatsappError, setWhatsappError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [poltronasLivresSugeridas, setPoltronasLivresSugeridas] = useState<number[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  const validar = (): boolean => {
    let ok = true;
    if (!nome.trim()) {
      setNomeError('Digite seu nome.');
      ok = false;
    } else {
      setNomeError(undefined);
    }
    if (!isWhatsappValido(whatsapp)) {
      setWhatsappError('Digite um WhatsApp válido, com DDD.');
      ok = false;
    } else {
      setWhatsappError(undefined);
    }
    return ok;
  };

  const reservar = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setPoltronasLivresSugeridas(null);
    if (poltrona === null || !validar()) return;

    setSalvando(true);
    try {
      const reserva = await criarReservaPublica(codigo, {
        poltrona,
        nome: nome.trim(),
        whatsapp: whatsapp.trim(),
        cpf: cpf.trim() || null,
        tipo_pagamento: tipoPagamento,
      });
      onCriada(reserva);
    } catch (error) {
      if (error instanceof ApiError && (error.codigo === 'poltrona_ocupada' || error.codigo === 'poltrona_bloqueada')) {
        setFormError(
          error.codigo === 'poltrona_ocupada'
            ? `Alguém acabou de reservar a poltrona ${poltrona}. Feche e escolha outra no mapa.`
            : error.mensagem,
        );
        const detalhes = error.detalhes as { poltronas_livres?: number[] } | undefined;
        setPoltronasLivresSugeridas(detalhes?.poltronas_livres ?? null);
        onConflitoPoltrona();
      } else if (error instanceof ApiError && error.codigo === 'validacao') {
        const campos = extractFieldErrors(error.detalhes);
        let algumCampo = false;
        if (campos.nome) {
          setNomeError(campos.nome);
          algumCampo = true;
        }
        if (campos.whatsapp) {
          setWhatsappError(campos.whatsapp);
          algumCampo = true;
        }
        if (!algumCampo) setFormError(error.mensagem);
      } else if (error instanceof ApiError && error.codigo === 'muitas_tentativas') {
        setFormError(
          error.retryAfterSeconds
            ? `Muitas tentativas em pouco tempo. Espere ${error.retryAfterSeconds}s e tente de novo.`
            : 'Muitas tentativas em pouco tempo. Espere um pouquinho e tente de novo.',
        );
      } else if (error instanceof ApiError) {
        setFormError(error.mensagem);
      } else {
        setFormError('Não conseguimos reservar agora. Confira sua conexão e tente de novo.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Reservar poltrona">
      <form className="tt-publico-form" onSubmit={reservar} noValidate>
        {poltrona !== null && (
          <Badge tone="primary">
            Poltrona <span className="tt-mono">{poltrona}</span>
          </Badge>
        )}

        <Input
          label="Nome"
          autoComplete="name"
          maxLength={120}
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          error={nomeError}
        />
        <Input
          label="WhatsApp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="11 91234-5678"
          value={whatsapp}
          onChange={(event) => setWhatsapp(event.target.value)}
          error={whatsappError}
          hint="É por ele que o organizador fala com você."
        />
        <Input
          label="CPF (opcional)"
          inputMode="numeric"
          maxLength={14}
          value={cpf}
          onChange={(event) => setCpf(event.target.value)}
          hint="Só se quiser — entra na lista de viagem."
        />

        {temSinal && (
          <fieldset className="tt-publico-pagamento">
            <legend className="tt-publico-pagamento-legend">Como você quer garantir?</legend>
            <label className="tt-publico-pagamento-opcao">
              <input
                type="radio"
                name="tipo_pagamento"
                value="sinal"
                checked={tipoPagamento === 'sinal'}
                onChange={() => setTipoPagamento('sinal')}
              />
              <span className="tt-publico-pagamento-texto">
                <span className="tt-publico-pagamento-nome">Pagar o sinal agora</span>
                <span className="tt-publico-pagamento-valor">{formatMoeda(sinalCentavos)}</span>
              </span>
            </label>
            <label className="tt-publico-pagamento-opcao">
              <input
                type="radio"
                name="tipo_pagamento"
                value="integral"
                checked={tipoPagamento === 'integral'}
                onChange={() => setTipoPagamento('integral')}
              />
              <span className="tt-publico-pagamento-texto">
                <span className="tt-publico-pagamento-nome">Pagar o valor cheio</span>
                <span className="tt-publico-pagamento-valor">{formatMoeda(precoCentavos)}</span>
              </span>
            </label>
          </fieldset>
        )}

        {formError && (
          <p className="tt-publico-alert tt-publico-alert--danger" role="alert">
            <span aria-hidden="true">⚠️</span> {formError}
          </p>
        )}
        {poltronasLivresSugeridas && poltronasLivresSugeridas.length > 0 && (
          <p className="tt-publico-mute">Poltronas livres: {poltronasLivresSugeridas.join(', ')}.</p>
        )}

        {/* Aviso LGPD (ADR 010, Anexo A) — sem checkbox de consentimento, por
            decisão do ADR: a base legal é a execução da reserva pedida pelo
            próprio titular. Link em nova aba para não perder o formulário. */}
        <p className="tt-publico-lgpd">
          Seus dados (nome, WhatsApp e CPF, se informar) vão direto para{' '}
          <strong>{organizacaoNome}</strong>, que organiza esta excursão, e servem só para a sua
          reserva, o contato e o embarque. Saiba mais na{' '}
          <a
            href="/privacidade"
            target="_blank"
            rel="noreferrer"
            aria-label="Política de Privacidade (abre em nova aba)"
          >
            Política de Privacidade
          </a>
          .
        </p>

        <Button type="submit" size="lg" fullWidth loading={salvando} loadingLabel="Reservando..." disabled={poltrona === null}>
          Confirmar reserva
        </Button>
      </form>
    </Sheet>
  );
}
