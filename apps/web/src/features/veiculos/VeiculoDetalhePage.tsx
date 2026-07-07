import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Input, Sheet } from '../../ui';
import { ApiError } from '../../lib/api/client';
import {
  atualizarVeiculo,
  excluirVeiculo,
  obterVeiculo,
  type TipoVeiculo,
  type Veiculo,
} from '../../lib/api/fleet';
import { extractFieldErrors } from '../../lib/api/fieldErrors';
import { FAIXA_POLTRONAS, TIPOS_VEICULO, TIPO_VEICULO_LABEL } from './tipoVeiculo';
import { VeiculoSeatGrid } from './VeiculoSeatGrid';
import './VeiculoDetalhePage.css';

type PassoExclusao = 'confirmar' | 'requer_confirmacao' | 'bloqueado';

export function VeiculoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);

  const [apelido, setApelido] = useState('');
  const [placa, setPlaca] = useState('');
  const [tipo, setTipo] = useState<TipoVeiculo>('van');
  const [quantidadePoltronas, setQuantidadePoltronas] = useState('');
  const [poltronasBloqueadas, setPoltronasBloqueadas] = useState<number[]>([]);

  const [apelidoError, setApelidoError] = useState<string | undefined>();
  const [placaError, setPlacaError] = useState<string | undefined>();
  const [quantidadeError, setQuantidadeError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const [confirmSheetAberto, setConfirmSheetAberto] = useState(false);
  const [confirmSheetMensagem, setConfirmSheetMensagem] = useState('');

  const [excluirSheetAberto, setExcluirSheetAberto] = useState(false);
  const [excluirPasso, setExcluirPasso] = useState<PassoExclusao>('confirmar');
  const [excluirMensagem, setExcluirMensagem] = useState('');
  const [excluirErro, setExcluirErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    (async () => {
      try {
        const dados = await obterVeiculo(id);
        if (cancelado) return;
        setVeiculo(dados);
        setApelido(dados.apelido);
        setPlaca(dados.placa);
        setTipo(dados.tipo);
        setQuantidadePoltronas(String(dados.quantidade_poltronas));
        setPoltronasBloqueadas(dados.poltronas_bloqueadas);
      } catch (error) {
        if (cancelado) return;
        setErroCarregar(
          error instanceof ApiError ? error.mensagem : 'Não conseguimos carregar este veículo.',
        );
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  const togglePoltrona = (numero: number) => {
    setPoltronasBloqueadas((atual) =>
      atual.includes(numero) ? atual.filter((n) => n !== numero) : [...atual, numero],
    );
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
    const faixa = FAIXA_POLTRONAS[tipo];
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

  const salvar = async (confirmar: boolean) => {
    if (!id) return;
    setFormError(null);
    if (!confirmar && !validar()) return;

    setSalvando(true);
    try {
      const atualizado = await atualizarVeiculo(id, {
        apelido: apelido.trim(),
        placa: placa.trim().toUpperCase(),
        tipo,
        quantidade_poltronas: Number.parseInt(quantidadePoltronas, 10),
        poltronas_bloqueadas: poltronasBloqueadas,
        ...(confirmar ? { confirmar: true } : {}),
      });
      setVeiculo(atualizado);
      setPoltronasBloqueadas(atualizado.poltronas_bloqueadas);
      setConfirmSheetAberto(false);
      setSalvo(true);
      window.setTimeout(() => setSalvo(false), 2400);
    } catch (error) {
      if (error instanceof ApiError && error.codigo === 'veiculo_em_uso_requer_confirmacao') {
        setConfirmSheetMensagem(error.mensagem);
        setConfirmSheetAberto(true);
      } else if (error instanceof ApiError && error.codigo === 'validacao') {
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
        if (!algumCampo) setFormError(error.mensagem);
      } else if (error instanceof ApiError && error.codigo === 'placa_ja_cadastrada') {
        setPlacaError(error.mensagem);
      } else if (error instanceof ApiError) {
        // poltrona_com_reserva e outros — mensagem pt-BR já pronta do servidor.
        setFormError(error.mensagem);
      } else {
        setFormError('Não conseguimos salvar agora. Tente de novo.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    salvar(false);
  };

  const abrirExcluir = () => {
    setExcluirPasso('confirmar');
    setExcluirMensagem('');
    setExcluirErro(null);
    setExcluirSheetAberto(true);
  };

  const confirmarExclusao = async (comConfirmar: boolean) => {
    if (!id) return;
    setExcluindo(true);
    setExcluirErro(null);
    try {
      await excluirVeiculo(id, comConfirmar);
      navigate('/veiculos', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.codigo === 'veiculo_em_uso_requer_confirmacao') {
        setExcluirPasso('requer_confirmacao');
        setExcluirMensagem(error.mensagem);
      } else if (error instanceof ApiError && error.codigo === 'veiculo_com_excursao_futura') {
        setExcluirPasso('bloqueado');
        setExcluirMensagem(error.mensagem);
      } else if (error instanceof ApiError) {
        setExcluirErro(error.mensagem);
      } else {
        setExcluirErro('Não conseguimos excluir agora. Tente de novo.');
      }
    } finally {
      setExcluindo(false);
    }
  };

  if (carregando) {
    return (
      <div className="tt-veiculo-detalhe-page">
        <h1 className="tt-veiculo-detalhe-title">Veículo</h1>
        <p className="tt-veiculo-detalhe-mute">Carregando...</p>
      </div>
    );
  }

  if (erroCarregar || !veiculo) {
    return (
      <div className="tt-veiculo-detalhe-page">
        <h1 className="tt-veiculo-detalhe-title">Veículo</h1>
        <p className="tt-veiculo-detalhe-alert" role="alert">
          <span aria-hidden="true">⚠️</span> {erroCarregar ?? 'Veículo não encontrado.'}
        </p>
      </div>
    );
  }

  return (
    <div className="tt-veiculo-detalhe-page">
      <h1 className="tt-veiculo-detalhe-title">{veiculo.apelido}</h1>
      <p className="tt-veiculo-detalhe-mute">{veiculo.capacidade} vagas de capacidade</p>

      <form className="tt-veiculo-detalhe-form" onSubmit={onSubmit} noValidate>
        <Input
          label="Apelido"
          maxLength={60}
          value={apelido}
          onChange={(event) => setApelido(event.target.value)}
          error={apelidoError}
        />
        <Input
          label="Placa"
          maxLength={10}
          value={placa}
          onChange={(event) => setPlaca(event.target.value.toUpperCase())}
          error={placaError}
        />

        <div className="tt-veiculo-detalhe-field">
          <span className="tt-veiculo-detalhe-field-label">Tipo de veículo</span>
          <div className="tt-veiculo-detalhe-tipo-group">
            {TIPOS_VEICULO.map((t) => (
              <Button
                key={t}
                type="button"
                variant={tipo === t ? 'soft' : 'secondary'}
                size="lg"
                aria-pressed={tipo === t}
                onClick={() => setTipo(t)}
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
          value={quantidadePoltronas}
          onChange={(event) => setQuantidadePoltronas(event.target.value)}
          error={quantidadeError}
        />

        <div className="tt-veiculo-detalhe-layout">
          <h2 className="tt-veiculo-detalhe-layout-title">Layout de poltronas</h2>
          <p className="tt-veiculo-detalhe-mute">Toque numa poltrona para bloquear ou desbloquear.</p>
          <VeiculoSeatGrid
            layout={veiculo.layout}
            poltronasBloqueadas={poltronasBloqueadas}
            onTogglePoltrona={togglePoltrona}
          />
        </div>

        {formError && (
          <p className="tt-veiculo-detalhe-alert" role="alert">
            <span aria-hidden="true">⚠️</span> {formError}
          </p>
        )}
        {salvo && !formError && (
          <p className="tt-veiculo-detalhe-alert tt-veiculo-detalhe-alert--success" role="status">
            <span aria-hidden="true">✅</span> Alterações salvas.
          </p>
        )}

        <Button type="submit" variant="secondary" fullWidth loading={salvando} loadingLabel="Salvando...">
          Salvar alterações
        </Button>
      </form>

      <Button variant="danger" fullWidth size="lg" onClick={abrirExcluir}>
        Excluir veículo
      </Button>

      <Sheet
        open={confirmSheetAberto}
        onClose={() => setConfirmSheetAberto(false)}
        title="Confirmar alteração"
      >
        <div className="tt-veiculo-detalhe-form">
          <p>{confirmSheetMensagem}</p>
          <div className="tt-veiculo-detalhe-sheet-actions">
            <Button variant="secondary" fullWidth onClick={() => setConfirmSheetAberto(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              fullWidth
              loading={salvando}
              loadingLabel="Salvando..."
              onClick={() => salvar(true)}
            >
              Confirmar e salvar
            </Button>
          </div>
        </div>
      </Sheet>

      <Sheet
        open={excluirSheetAberto}
        onClose={() => setExcluirSheetAberto(false)}
        title="Excluir veículo"
      >
        <div className="tt-veiculo-detalhe-form">
          {excluirPasso === 'confirmar' && (
            <p>Excluir {veiculo.apelido}? Isso não afeta reservas nem excursões passadas.</p>
          )}
          {excluirPasso === 'requer_confirmacao' && <p>{excluirMensagem}</p>}
          {excluirPasso === 'bloqueado' && <p>{excluirMensagem}</p>}

          {excluirErro && (
            <p className="tt-veiculo-detalhe-alert" role="alert">
              <span aria-hidden="true">⚠️</span> {excluirErro}
            </p>
          )}

          {excluirPasso === 'bloqueado' ? (
            <Button variant="secondary" fullWidth onClick={() => setExcluirSheetAberto(false)}>
              Entendi
            </Button>
          ) : (
            <div className="tt-veiculo-detalhe-sheet-actions">
              <Button variant="secondary" fullWidth onClick={() => setExcluirSheetAberto(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                fullWidth
                loading={excluindo}
                loadingLabel="Excluindo..."
                onClick={() => confirmarExclusao(excluirPasso === 'requer_confirmacao')}
              >
                {excluirPasso === 'requer_confirmacao' ? 'Confirmar exclusão' : 'Excluir veículo'}
              </Button>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}
