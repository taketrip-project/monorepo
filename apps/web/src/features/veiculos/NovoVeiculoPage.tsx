import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../../ui';
import { ApiError } from '../../lib/api/client';
import { criarVeiculo, obterLayoutPadrao, type Layout, type TipoVeiculo } from '../../lib/api/fleet';
import { extractFieldErrors } from '../../lib/api/fieldErrors';
import { FAIXA_POLTRONAS, TIPOS_VEICULO, TIPO_VEICULO_LABEL } from './tipoVeiculo';
import { VeiculoSeatGrid } from './VeiculoSeatGrid';
import './NovoVeiculoPage.css';

/** Cadastro de veículo (H1.4): apelido, placa, tipo e quantidade de poltronas. */
export function NovoVeiculoPage() {
  const navigate = useNavigate();

  const [apelido, setApelido] = useState('');
  const [placa, setPlaca] = useState('');
  const [tipo, setTipo] = useState<TipoVeiculo>('van');
  const [quantidadePoltronas, setQuantidadePoltronas] = useState(String(FAIXA_POLTRONAS.van.min));

  const [apelidoError, setApelidoError] = useState<string | undefined>();
  const [placaError, setPlacaError] = useState<string | undefined>();
  const [quantidadeError, setQuantidadeError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [layoutPreview, setLayoutPreview] = useState<Layout | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [erroPreview, setErroPreview] = useState<string | null>(null);

  const faixa = FAIXA_POLTRONAS[tipo];
  const quantidadeNumero = Number.parseInt(quantidadePoltronas, 10);
  const quantidadeValida =
    !Number.isNaN(quantidadeNumero) && quantidadeNumero >= faixa.min && quantidadeNumero <= faixa.max;

  useEffect(() => {
    // Fora da faixa: nada para buscar. O render já esconde o preview
    // (via `quantidadeValida`) sem precisar zerar estado aqui.
    if (!quantidadeValida) return;

    const quantidade = quantidadeNumero;
    let cancelado = false;
    const timer = window.setTimeout(async () => {
      setCarregandoPreview(true);
      setErroPreview(null);
      try {
        const layout = await obterLayoutPadrao(tipo, quantidade);
        if (!cancelado) setLayoutPreview(layout);
      } catch (error) {
        if (!cancelado) {
          setLayoutPreview(null);
          setErroPreview(
            error instanceof ApiError ? error.mensagem : 'Não conseguimos gerar a pré-visualização.',
          );
        }
      } finally {
        if (!cancelado) setCarregandoPreview(false);
      }
    }, 300);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [tipo, quantidadeNumero, quantidadeValida]);

  const selecionarTipo = (novoTipo: TipoVeiculo) => {
    setTipo(novoTipo);
    setQuantidadePoltronas(String(FAIXA_POLTRONAS[novoTipo].min));
    setQuantidadeError(undefined);
  };

  const validar = (): boolean => {
    let ok = true;
    if (!apelido.trim()) {
      setApelidoError('Digite um apelido para o veículo.');
      ok = false;
    } else {
      setApelidoError(undefined);
    }
    if (!placa.trim()) {
      setPlacaError('Digite a placa do veículo.');
      ok = false;
    } else {
      setPlacaError(undefined);
    }
    const quantidade = Number.parseInt(quantidadePoltronas, 10);
    if (Number.isNaN(quantidade) || quantidade < faixa.min || quantidade > faixa.max) {
      setQuantidadeError(
        `Para ${TIPO_VEICULO_LABEL[tipo].toLowerCase()}, use entre ${faixa.min} e ${faixa.max} poltronas.`,
      );
      ok = false;
    } else {
      setQuantidadeError(undefined);
    }
    return ok;
  };

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!validar()) return;

    setSalvando(true);
    try {
      const veiculo = await criarVeiculo({
        apelido: apelido.trim(),
        placa: placa.trim().toUpperCase(),
        tipo,
        quantidade_poltronas: Number.parseInt(quantidadePoltronas, 10),
      });
      navigate(`/veiculos/${veiculo.id}`, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.codigo === 'validacao') {
        const campos = extractFieldErrors(error.detalhes);
        let algumCampo = false;
        if (campos.apelido) {
          setApelidoError(campos.apelido);
          algumCampo = true;
        }
        if (campos.placa) {
          setPlacaError(campos.placa);
          algumCampo = true;
        }
        if (campos.quantidade_poltronas) {
          setQuantidadeError(campos.quantidade_poltronas);
          algumCampo = true;
        }
        if (campos.tipo) {
          setFormError(campos.tipo);
          algumCampo = true;
        }
        if (!algumCampo) setFormError(error.mensagem);
      } else if (error instanceof ApiError && error.codigo === 'placa_ja_cadastrada') {
        setPlacaError(error.mensagem);
      } else if (error instanceof ApiError) {
        setFormError(error.mensagem);
      } else {
        setFormError('Não conseguimos cadastrar agora. Tente de novo.');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="tt-novo-veiculo-page">
      <h1 className="tt-novo-veiculo-title">Novo veículo</h1>

      <form className="tt-novo-veiculo-form" onSubmit={salvar} noValidate>
        <Input
          label="Apelido"
          placeholder="Ex.: Van 1, Ônibus da Serra"
          maxLength={60}
          value={apelido}
          onChange={(event) => setApelido(event.target.value)}
          error={apelidoError}
        />
        <Input
          label="Placa"
          placeholder="ABC1D23"
          maxLength={10}
          value={placa}
          onChange={(event) => setPlaca(event.target.value.toUpperCase())}
          error={placaError}
        />

        <div className="tt-novo-veiculo-field">
          <span className="tt-novo-veiculo-field-label">Tipo de veículo</span>
          <div className="tt-novo-veiculo-tipo-group">
            {TIPOS_VEICULO.map((t) => (
              <Button
                key={t}
                type="button"
                variant={tipo === t ? 'soft' : 'secondary'}
                size="lg"
                aria-pressed={tipo === t}
                onClick={() => selecionarTipo(t)}
              >
                {TIPO_VEICULO_LABEL[t]}
              </Button>
            ))}
          </div>
        </div>

        <Input
          label="Quantidade de poltronas"
          type="number"
          inputMode="numeric"
          min={faixa.min}
          max={faixa.max}
          value={quantidadePoltronas}
          onChange={(event) => setQuantidadePoltronas(event.target.value)}
          error={quantidadeError}
          hint={quantidadeError ? undefined : `Faixa esperada: ${faixa.min} a ${faixa.max} poltronas.`}
        />

        <div className="tt-novo-veiculo-preview">
          <h2 className="tt-novo-veiculo-preview-title">Pré-visualização do layout</h2>
          {!quantidadeValida && (
            <p className="tt-novo-veiculo-mute">Ajuste a quantidade para dentro da faixa para ver o layout.</p>
          )}
          {quantidadeValida && carregandoPreview && (
            <p className="tt-novo-veiculo-mute">Gerando pré-visualização...</p>
          )}
          {quantidadeValida && !carregandoPreview && erroPreview && (
            <p className="tt-novo-veiculo-mute">{erroPreview}</p>
          )}
          {quantidadeValida && !carregandoPreview && !erroPreview && layoutPreview && (
            <VeiculoSeatGrid layout={layoutPreview} poltronasBloqueadas={[]} />
          )}
        </div>

        {formError && (
          <p className="tt-novo-veiculo-alert" role="alert">
            <span aria-hidden="true">⚠️</span> {formError}
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={salvando} loadingLabel="Cadastrando...">
          Cadastrar veículo
        </Button>
      </form>
    </div>
  );
}
