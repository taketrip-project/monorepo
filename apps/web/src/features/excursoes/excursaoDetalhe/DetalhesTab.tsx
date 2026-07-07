import { useState, type FormEvent } from 'react';
import { Button, Input } from '../../../ui';
import { ApiError } from '../../../lib/api/client';
import { atualizarExcursao, type Excursao, type SinalTipo, type TipoExcursao } from '../../../lib/api/excursions';
import type { Veiculo } from '../../../lib/api/fleet';
import { extractFieldErrors } from '../../../lib/api/fieldErrors';
import { formatDataCurta, formatHora, formatMoeda } from '../../../lib/format';
import { toDatetimeLocalValue } from '../datetimeLocal';
import { SINAIS_TIPO, SINAL_TIPO_LABEL, TIPOS_EXCURSAO, TIPO_EXCURSAO_LABEL } from '../excursaoLabels';
import './excursaoDetalhe.css';

interface DetalhesTabProps {
  excursao: Excursao;
  veiculos: Veiculo[];
  /** Notifica o pai (header/card-resumo) quando a edição é salva com sucesso. */
  onSalvo: (atualizada: Excursao) => void;
}

/** Aba "Detalhes" (H1.5–H1.7): dados da excursão e formulário de edição (PATCH). */
export function DetalhesTab({ excursao, veiculos, onSalvo }: DetalhesTabProps) {
  const [destino, setDestino] = useState(excursao.destino);
  const [eventoAncora, setEventoAncora] = useState(excursao.evento_ancora ?? '');
  const [dataSaida, setDataSaida] = useState(toDatetimeLocalValue(excursao.data_saida));
  const [dataRetorno, setDataRetorno] = useState(toDatetimeLocalValue(excursao.data_retorno));
  const [tipo, setTipo] = useState<TipoExcursao>(excursao.tipo);
  const [veiculoId, setVeiculoId] = useState(excursao.veiculo_id);
  const [precoReais, setPrecoReais] = useState((excursao.preco_centavos / 100).toFixed(2));
  const [sinalTipo, setSinalTipo] = useState<SinalTipo>(excursao.sinal_tipo);
  const [sinalPercentual, setSinalPercentual] = useState(
    excursao.sinal_tipo === 'percentual' ? String(excursao.sinal_valor) : '50',
  );
  const [sinalFixoReais, setSinalFixoReais] = useState(
    excursao.sinal_tipo === 'fixo' ? (excursao.sinal_valor / 100).toFixed(2) : '',
  );
  const [descricao, setDescricao] = useState(excursao.descricao ?? '');
  const [custoTotalReais, setCustoTotalReais] = useState(
    excursao.custo_total_centavos != null ? (excursao.custo_total_centavos / 100).toFixed(2) : '',
  );

  const [destinoError, setDestinoError] = useState<string | undefined>();
  const [dataSaidaError, setDataSaidaError] = useState<string | undefined>();
  const [dataRetornoError, setDataRetornoError] = useState<string | undefined>();
  const [veiculoError, setVeiculoError] = useState<string | undefined>();
  const [precoError, setPrecoError] = useState<string | undefined>();
  const [sinalError, setSinalError] = useState<string | undefined>();
  const [descricaoError, setDescricaoError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const validar = (): boolean => {
    let ok = true;
    if (!destino.trim()) {
      setDestinoError('Digite o destino da excursão.');
      ok = false;
    } else {
      setDestinoError(undefined);
    }
    if (!dataSaida) {
      setDataSaidaError('Escolha a data e hora de saída.');
      ok = false;
    } else {
      setDataSaidaError(undefined);
    }
    if (!dataRetorno) {
      setDataRetornoError('Escolha a data e hora de retorno.');
      ok = false;
    } else if (dataSaida && new Date(dataRetorno).getTime() < new Date(dataSaida).getTime()) {
      setDataRetornoError('O retorno não pode ser antes da saída.');
      ok = false;
    } else {
      setDataRetornoError(undefined);
    }
    if (!veiculoId) {
      setVeiculoError('Escolha um veículo.');
      ok = false;
    } else {
      setVeiculoError(undefined);
    }
    const preco = Number.parseFloat(precoReais);
    if (precoReais.trim() === '' || Number.isNaN(preco) || preco < 0) {
      setPrecoError('Informe um valor válido.');
      ok = false;
    } else {
      setPrecoError(undefined);
    }
    if (sinalTipo === 'percentual') {
      const percentual = Number.parseInt(sinalPercentual, 10);
      if (Number.isNaN(percentual) || percentual < 0 || percentual > 100) {
        setSinalError('Informe um percentual entre 0 e 100.');
        ok = false;
      } else {
        setSinalError(undefined);
      }
    } else {
      const fixo = Number.parseFloat(sinalFixoReais);
      if (sinalFixoReais.trim() === '' || Number.isNaN(fixo) || fixo < 0) {
        setSinalError('Informe um valor de sinal válido.');
        ok = false;
      } else {
        setSinalError(undefined);
      }
    }
    if (descricao.length > 4000) {
      setDescricaoError('Descrição muito longa (máximo 4000 caracteres).');
      ok = false;
    } else {
      setDescricaoError(undefined);
    }
    return ok;
  };

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!validar()) return;

    setSalvando(true);
    try {
      const custoTotal =
        custoTotalReais.trim() === '' ? null : Math.round(Number.parseFloat(custoTotalReais) * 100);
      const atualizada = await atualizarExcursao(excursao.id, {
        destino: destino.trim(),
        evento_ancora: eventoAncora.trim() || null,
        data_saida: new Date(dataSaida).toISOString(),
        data_retorno: new Date(dataRetorno).toISOString(),
        tipo,
        veiculo_id: veiculoId,
        preco_centavos: Math.round(Number.parseFloat(precoReais) * 100),
        sinal_tipo: sinalTipo,
        sinal_valor:
          sinalTipo === 'percentual'
            ? Number.parseInt(sinalPercentual, 10)
            : Math.round(Number.parseFloat(sinalFixoReais) * 100),
        descricao: descricao.trim() || null,
        custo_total_centavos: custoTotal,
      });
      onSalvo(atualizada);
      setSalvo(true);
      window.setTimeout(() => setSalvo(false), 2400);
    } catch (error) {
      if (error instanceof ApiError && error.codigo === 'validacao') {
        const campos = extractFieldErrors(error.detalhes);
        let algumCampo = false;
        if (campos.destino) {
          setDestinoError(campos.destino);
          algumCampo = true;
        }
        if (campos.data_saida) {
          setDataSaidaError(campos.data_saida);
          algumCampo = true;
        }
        if (campos.data_retorno) {
          setDataRetornoError(campos.data_retorno);
          algumCampo = true;
        }
        if (campos.veiculo_id) {
          setVeiculoError(campos.veiculo_id);
          algumCampo = true;
        }
        if (campos.preco_centavos) {
          setPrecoError(campos.preco_centavos);
          algumCampo = true;
        }
        if (campos.sinal_valor || campos.sinal_tipo) {
          setSinalError(campos.sinal_valor ?? campos.sinal_tipo);
          algumCampo = true;
        }
        if (campos.descricao) {
          setDescricaoError(campos.descricao);
          algumCampo = true;
        }
        if (!algumCampo) setFormError(error.mensagem);
      } else if (error instanceof ApiError) {
        // troca_veiculo_conflita_reservas e outros já vêm com mensagem pt-BR pronta.
        setFormError(error.mensagem);
      } else {
        setFormError('Não conseguimos salvar agora. Tente de novo.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="tt-excursao-detalhe-tab-content">
      <div className="tt-excursao-detalhe-resumo">
        <span>
          Tipo: <strong>{TIPO_EXCURSAO_LABEL[excursao.tipo]}</strong>
        </span>
        <span>
          Retorno:{' '}
          <span className="tt-mono">
            {formatDataCurta(excursao.data_retorno)} · {formatHora(excursao.data_retorno)}
          </span>
        </span>
        <span>
          Sinal: <span className="tt-mono">{formatMoeda(excursao.sinal_centavos)}</span>
        </span>
      </div>

      <form className="tt-excursao-detalhe-form" onSubmit={salvar} noValidate>
        <Input
          label="Destino"
          maxLength={160}
          value={destino}
          onChange={(event) => setDestino(event.target.value)}
          error={destinoError}
        />
        <Input
          label="Evento âncora (opcional)"
          maxLength={160}
          value={eventoAncora}
          onChange={(event) => setEventoAncora(event.target.value)}
        />
        <Input
          label="Saída"
          type="datetime-local"
          value={dataSaida}
          onChange={(event) => setDataSaida(event.target.value)}
          error={dataSaidaError}
        />
        <Input
          label="Retorno"
          type="datetime-local"
          value={dataRetorno}
          onChange={(event) => setDataRetorno(event.target.value)}
          error={dataRetornoError}
        />

        <div className="tt-excursao-detalhe-field">
          <span className="tt-excursao-detalhe-field-label">Tipo</span>
          <div className="tt-excursao-detalhe-toggle-group">
            {TIPOS_EXCURSAO.map((t) => (
              <Button
                key={t}
                type="button"
                variant={tipo === t ? 'soft' : 'secondary'}
                size="lg"
                aria-pressed={tipo === t}
                onClick={() => setTipo(t)}
              >
                {TIPO_EXCURSAO_LABEL[t]}
              </Button>
            ))}
          </div>
        </div>

        <div className="tt-excursao-detalhe-field">
          <label className="tt-excursao-detalhe-field-label" htmlFor="veiculo-select">
            Veículo
          </label>
          <select
            id="veiculo-select"
            className="tt-excursao-detalhe-select"
            value={veiculoId}
            onChange={(event) => setVeiculoId(event.target.value)}
          >
            <option value="">Selecione um veículo</option>
            {veiculos.map((veiculo) => (
              <option key={veiculo.id} value={veiculo.id}>
                {veiculo.apelido} · {veiculo.capacidade} vagas
              </option>
            ))}
          </select>
          {veiculoError && (
            <span className="tt-excursao-detalhe-field-error" role="alert">
              {veiculoError}
            </span>
          )}
        </div>

        <Input
          label="Preço por passageiro"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          prefix="R$"
          value={precoReais}
          onChange={(event) => setPrecoReais(event.target.value)}
          error={precoError}
        />

        <div className="tt-excursao-detalhe-field">
          <span className="tt-excursao-detalhe-field-label">Sinal</span>
          <div className="tt-excursao-detalhe-toggle-group">
            {SINAIS_TIPO.map((s) => (
              <Button
                key={s}
                type="button"
                variant={sinalTipo === s ? 'soft' : 'secondary'}
                size="lg"
                aria-pressed={sinalTipo === s}
                onClick={() => setSinalTipo(s)}
              >
                {SINAL_TIPO_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>

        {sinalTipo === 'percentual' ? (
          <Input
            label="Percentual do sinal"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            suffix="%"
            value={sinalPercentual}
            onChange={(event) => setSinalPercentual(event.target.value)}
            error={sinalError}
          />
        ) : (
          <Input
            label="Valor fixo do sinal"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            prefix="R$"
            value={sinalFixoReais}
            onChange={(event) => setSinalFixoReais(event.target.value)}
            error={sinalError}
          />
        )}

        <Input
          label="Custo total (opcional)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          prefix="R$"
          value={custoTotalReais}
          onChange={(event) => setCustoTotalReais(event.target.value)}
          hint="Usado só pra calcular o ponto de equilíbrio — não trava nada."
        />

        {excursao.viabilidade && (
          <p className="tt-excursao-detalhe-viabilidade">
            Empata com <span className="tt-mono">{excursao.viabilidade.ponto_equilibrio_pagos}</span> pagos · hoje:{' '}
            <span className="tt-mono">{excursao.viabilidade.pagos_atuais}</span> pagos
          </p>
        )}

        <div className="tt-excursao-detalhe-field">
          <label className="tt-excursao-detalhe-field-label" htmlFor="descricao">
            Descrição (opcional)
          </label>
          <textarea
            id="descricao"
            className="tt-textarea"
            maxLength={4000}
            rows={4}
            value={descricao}
            onChange={(event) => setDescricao(event.target.value)}
          />
          {descricaoError && (
            <span className="tt-excursao-detalhe-field-error" role="alert">
              {descricaoError}
            </span>
          )}
        </div>

        {formError && (
          <p className="tt-excursao-detalhe-alert" role="alert">
            <span aria-hidden="true">⚠️</span> {formError}
          </p>
        )}
        {salvo && !formError && (
          <p className="tt-excursao-detalhe-alert tt-excursao-detalhe-alert--success" role="status">
            <span aria-hidden="true">✅</span> Alterações salvas.
          </p>
        )}

        <Button type="submit" variant="secondary" fullWidth loading={salvando} loadingLabel="Salvando...">
          Salvar alterações
        </Button>
      </form>
    </div>
  );
}
