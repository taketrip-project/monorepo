import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../../ui';
import { ApiError } from '../../lib/api/client';
import { criarExcursao, type SinalTipo, type TipoExcursao } from '../../lib/api/excursions';
import { listarVeiculos, type Veiculo } from '../../lib/api/fleet';
import { getOrganizacao } from '../../lib/api/identity';
import { extractFieldErrors } from '../../lib/api/fieldErrors';
import { SINAIS_TIPO, SINAL_TIPO_LABEL, TIPOS_EXCURSAO, TIPO_EXCURSAO_LABEL } from './excursaoLabels';
import './NovaExcursaoPage.css';

/** Cadastro de excursão (H1.5): nasce em rascunho, edição fina fica pro detalhe. */
export function NovaExcursaoPage() {
  const navigate = useNavigate();

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [carregandoVeiculos, setCarregandoVeiculos] = useState(true);
  const [erroVeiculos, setErroVeiculos] = useState<string | null>(null);

  const [destino, setDestino] = useState('');
  const [eventoAncora, setEventoAncora] = useState('');
  const [dataSaida, setDataSaida] = useState('');
  const [dataRetorno, setDataRetorno] = useState('');
  const [tipo, setTipo] = useState<TipoExcursao>('bate_volta');
  const [veiculoId, setVeiculoId] = useState('');
  const [precoReais, setPrecoReais] = useState('');
  const [sinalTipo, setSinalTipo] = useState<SinalTipo>('percentual');
  const [sinalPercentual, setSinalPercentual] = useState('50');
  const [sinalFixoReais, setSinalFixoReais] = useState('');
  const [descricao, setDescricao] = useState('');

  const [destinoError, setDestinoError] = useState<string | undefined>();
  const [dataSaidaError, setDataSaidaError] = useState<string | undefined>();
  const [dataRetornoError, setDataRetornoError] = useState<string | undefined>();
  const [veiculoError, setVeiculoError] = useState<string | undefined>();
  const [precoError, setPrecoError] = useState<string | undefined>();
  const [sinalError, setSinalError] = useState<string | undefined>();
  const [descricaoError, setDescricaoError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [veic, org] = await Promise.all([listarVeiculos(1, 100), getOrganizacao()]);
        if (cancelado) return;
        setVeiculos(veic.dados);
        if (veic.dados.length === 1) setVeiculoId(veic.dados[0].id);
        setSinalPercentual(String(org.sinal_default_percentual));
      } catch (error) {
        if (cancelado) return;
        setErroVeiculos(
          error instanceof ApiError ? error.mensagem : 'Não conseguimos carregar os veículos.',
        );
      } finally {
        if (!cancelado) setCarregandoVeiculos(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

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
      const excursao = await criarExcursao({
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
      });
      navigate(`/excursoes/${excursao.id}`, { replace: true });
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
      } else if (error instanceof ApiError && error.codigo === 'nao_encontrado') {
        setVeiculoError(error.mensagem);
      } else if (error instanceof ApiError) {
        setFormError(error.mensagem);
      } else {
        setFormError('Não conseguimos criar a excursão agora. Tente de novo.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const semVeiculos = !carregandoVeiculos && !erroVeiculos && veiculos.length === 0;

  return (
    <div className="tt-nova-excursao-page">
      <h1 className="tt-nova-excursao-title">Nova excursão</h1>
      <p className="tt-nova-excursao-mute">Ela nasce em rascunho — você publica quando estiver pronta.</p>

      <form className="tt-nova-excursao-form" onSubmit={salvar} noValidate>
        <Input
          label="Destino"
          placeholder="Ex.: Praia do Rosa, Show do Roberto Carlos"
          maxLength={160}
          value={destino}
          onChange={(event) => setDestino(event.target.value)}
          error={destinoError}
        />
        <Input
          label="Evento âncora (opcional)"
          placeholder="Ex.: Show, jogo, festa religiosa"
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

        <div className="tt-nova-excursao-field">
          <span className="tt-nova-excursao-field-label">Tipo</span>
          <div className="tt-nova-excursao-toggle-group">
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

        <div className="tt-nova-excursao-field">
          <span className="tt-nova-excursao-field-label">Veículo</span>
          {carregandoVeiculos && <p className="tt-nova-excursao-mute">Carregando veículos...</p>}
          {erroVeiculos && (
            <p className="tt-nova-excursao-alert" role="alert">
              <span aria-hidden="true">⚠️</span> {erroVeiculos}
            </p>
          )}
          {semVeiculos && (
            <p className="tt-nova-excursao-mute">
              Você ainda não tem veículos cadastrados.{' '}
              <button type="button" className="tt-nova-excursao-link" onClick={() => navigate('/veiculos/novo')}>
                Cadastrar veículo
              </button>
            </p>
          )}
          {!carregandoVeiculos && !erroVeiculos && veiculos.length > 0 && (
            <select
              className="tt-nova-excursao-select"
              value={veiculoId}
              onChange={(event) => setVeiculoId(event.target.value)}
              aria-label="Veículo"
            >
              <option value="">Selecione um veículo</option>
              {veiculos.map((veiculo) => (
                <option key={veiculo.id} value={veiculo.id}>
                  {veiculo.apelido} · {veiculo.capacidade} vagas
                </option>
              ))}
            </select>
          )}
          {veiculoError && (
            <span className="tt-nova-excursao-field-error" role="alert">
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

        <div className="tt-nova-excursao-field">
          <span className="tt-nova-excursao-field-label">Sinal</span>
          <div className="tt-nova-excursao-toggle-group">
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
            hint={sinalError ? undefined : 'Herdado da configuração da organização — pode ajustar.'}
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

        <div className="tt-nova-excursao-field">
          <label className="tt-nova-excursao-field-label" htmlFor="descricao">
            Descrição (opcional)
          </label>
          <textarea
            id="descricao"
            className="tt-textarea"
            maxLength={4000}
            rows={4}
            placeholder="Detalhes que ajudam o passageiro a decidir: o que está incluso, roteiro, recomendações."
            value={descricao}
            onChange={(event) => setDescricao(event.target.value)}
          />
          {descricaoError && (
            <span className="tt-nova-excursao-field-error" role="alert">
              {descricaoError}
            </span>
          )}
        </div>

        {formError && (
          <p className="tt-nova-excursao-alert" role="alert">
            <span aria-hidden="true">⚠️</span> {formError}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={salvando} loadingLabel="Criando...">
          Criar excursão
        </Button>
      </form>
    </div>
  );
}
