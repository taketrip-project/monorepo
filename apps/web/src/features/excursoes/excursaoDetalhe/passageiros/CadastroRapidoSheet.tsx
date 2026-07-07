import { useState, type FormEvent } from 'react';
import { Badge, Button, Input, Sheet } from '../../../../ui';
import { ApiError } from '../../../../lib/api/client';
import {
  buscarPassageiroPorWhatsapp,
  criarReserva,
  type FormaPagamento,
  type Reserva,
} from '../../../../lib/api/bookings';
import { extractFieldErrors } from '../../../../lib/api/fieldErrors';
import { isWhatsappValido } from '../../../../lib/validation';
import { FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABEL } from '../../reservaLabels';
import '../excursaoDetalhe.css';
import './passageiros.css';

interface CadastroRapidoSheetProps {
  open: boolean;
  onClose: () => void;
  excursaoId: string;
  /** Poltrona tocada no mapa — sempre pré-selecionada (frontend-guidelines §8 "Cadastro rápido"). */
  poltrona: number | null;
  precoDefaultCentavos: number;
  onCriada: (reserva: Reserva) => void;
}

/**
 * Cadastro rápido de passageiro (H1.9): no máximo 4 campos — Nome, WhatsApp,
 * Forma de pagamento, Valor. A vaga já vem escolhida do mapa (chip no
 * topo, não é campo de formulário). Sem CPF obrigatório.
 *
 * Quem usa este componente deve montá-lo com uma `key` que muda a cada
 * abertura (ver PassageirosTab) — assim o formulário sempre nasce limpo,
 * sem precisar de um efeito de reset.
 */
export function CadastroRapidoSheet({
  open,
  onClose,
  excursaoId,
  poltrona,
  precoDefaultCentavos,
  onCriada,
}: CadastroRapidoSheetProps) {
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | ''>('');
  const [valorReais, setValorReais] = useState((precoDefaultCentavos / 100).toFixed(2));

  const [nomeError, setNomeError] = useState<string | undefined>();
  const [whatsappError, setWhatsappError] = useState<string | undefined>();
  const [valorError, setValorError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [poltronasLivresSugeridas, setPoltronasLivresSugeridas] = useState<number[] | null>(null);
  const [passageiroEncontrado, setPassageiroEncontrado] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const buscarPassageiro = async () => {
    if (!isWhatsappValido(whatsapp)) return;
    try {
      const encontrados = await buscarPassageiroPorWhatsapp(whatsapp.trim());
      const passageiro = encontrados[0];
      if (passageiro) {
        setPassageiroEncontrado(passageiro.nome);
        if (!nome.trim()) setNome(passageiro.nome);
      } else {
        setPassageiroEncontrado(null);
      }
    } catch {
      // Busca de conveniência — se falhar, o organizador só digita o nome na mão.
    }
  };

  const validar = (): boolean => {
    let ok = true;
    if (!nome.trim()) {
      setNomeError('Digite o nome do passageiro.');
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
    setFormError(null);
    setPoltronasLivresSugeridas(null);
    if (poltrona === null || !validar()) return;

    setSalvando(true);
    try {
      const reserva = await criarReserva(excursaoId, {
        poltrona,
        nome: nome.trim(),
        whatsapp: whatsapp.trim(),
        forma_pagamento: formaPagamento || null,
        valor_centavos: Math.round(Number.parseFloat(valorReais) * 100),
      });
      onCriada(reserva);
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
        if (campos.whatsapp) {
          setWhatsappError(campos.whatsapp);
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

  return (
    <Sheet open={open} onClose={onClose} title="Cadastro rápido">
      <form className="tt-excursao-detalhe-sheet-form" onSubmit={salvar} noValidate>
        {poltrona !== null && (
          <Badge tone="primary" className="tt-passageiros-poltrona-chip">
            Poltrona {poltrona}
          </Badge>
        )}

        <Input
          label="Nome"
          maxLength={120}
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          error={nomeError}
        />
        <Input
          label="WhatsApp"
          type="tel"
          inputMode="tel"
          placeholder="11 91234-5678"
          value={whatsapp}
          onChange={(event) => setWhatsapp(event.target.value)}
          onBlur={buscarPassageiro}
          error={whatsappError}
          hint={passageiroEncontrado ? `Passageiro já cadastrado: ${passageiroEncontrado}` : undefined}
        />

        <div className="tt-excursao-detalhe-field">
          <label className="tt-excursao-detalhe-field-label" htmlFor="cadastro-rapido-forma-pagamento">
            Forma de pagamento (opcional)
          </label>
          <select
            id="cadastro-rapido-forma-pagamento"
            className="tt-excursao-detalhe-select"
            value={formaPagamento}
            onChange={(event) => setFormaPagamento(event.target.value as FormaPagamento | '')}
          >
            <option value="">Ainda não sei</option>
            {FORMAS_PAGAMENTO.map((forma) => (
              <option key={forma} value={forma}>
                {FORMA_PAGAMENTO_LABEL[forma]}
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
        />

        {formError && (
          <p className="tt-excursao-detalhe-alert" role="alert">
            <span aria-hidden="true">⚠️</span> {formError}
          </p>
        )}

        {poltronasLivresSugeridas && poltronasLivresSugeridas.length > 0 && (
          <p className="tt-passageiros-sugestao">
            Poltronas livres: {poltronasLivresSugeridas.join(', ')}. Feche e toque numa delas no mapa.
          </p>
        )}

        <Button type="submit" fullWidth loading={salvando} loadingLabel="Salvando..." disabled={poltrona === null}>
          Salvar reserva
        </Button>
      </form>
    </Sheet>
  );
}
