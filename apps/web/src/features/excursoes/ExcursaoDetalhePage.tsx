import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, ExcursionCard, Input, Sheet } from '../../ui';
import { ApiError } from '../../lib/api/client';
import {
  atualizarChecklistLegal,
  atualizarExcursao,
  adicionarPontoEmbarque,
  cancelarExcursao,
  editarPontoEmbarque,
  enviarFoto,
  excluirExcursao,
  obterExcursao,
  publicarExcursao,
  removerFoto,
  removerPontoEmbarque,
  reordenarPontosEmbarque,
  type ChecklistLegal,
  type Excursao,
  type Foto,
  type PendenciaEstorno,
  type PontoEmbarque,
  type SinalTipo,
  type TipoExcursao,
} from '../../lib/api/excursions';
import { listarVeiculos, type Veiculo } from '../../lib/api/fleet';
import { extractFieldErrors } from '../../lib/api/fieldErrors';
import { formatDataCurta, formatHora, formatMoeda } from '../../lib/format';
import { excursaoParaCardProps } from './excursaoCard';
import { toDatetimeLocalValue } from './datetimeLocal';
import { SINAIS_TIPO, SINAL_TIPO_LABEL, TIPOS_EXCURSAO, TIPO_EXCURSAO_LABEL } from './excursaoLabels';
import './ExcursaoDetalhePage.css';

type TabKey = 'detalhes' | 'pontos' | 'fotos' | 'checklist';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'detalhes', label: 'Detalhes' },
  { key: 'pontos', label: 'Pontos de embarque' },
  { key: 'fotos', label: 'Fotos' },
  { key: 'checklist', label: 'Checklist legal' },
];

const CHECKLIST_ITEMS: { campo: keyof ChecklistLegal; label: string }[] = [
  { campo: 'licenca_antt', label: 'Licença ANTT de viagem' },
  { campo: 'seguro_passageiros', label: 'Seguro de passageiros' },
  { campo: 'lista_impressa', label: 'Lista de passageiros impressa' },
];

/** Detalhe da excursão (H1.5–H1.7, H3.4, H3.5): dados, ciclo de vida, pontos, fotos e checklist. */
export function ExcursaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [excursao, setExcursao] = useState<Excursao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('detalhes');

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);

  // Formulário de edição
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
  const [custoTotalReais, setCustoTotalReais] = useState('');

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

  // Publicar
  const [publicando, setPublicando] = useState(false);
  const [publicarErro, setPublicarErro] = useState<string | null>(null);

  // Cancelar
  const [cancelarSheetAberto, setCancelarSheetAberto] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [motivoError, setMotivoError] = useState<string | undefined>();
  const [cancelando, setCancelando] = useState(false);
  const [cancelarErro, setCancelarErro] = useState<string | null>(null);
  const [pendenciasEstorno, setPendenciasEstorno] = useState<PendenciaEstorno[] | null>(null);

  // Excluir
  const [excluirSheetAberto, setExcluirSheetAberto] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [excluirErro, setExcluirErro] = useState<string | null>(null);

  // Pontos de embarque
  const [pontos, setPontos] = useState<PontoEmbarque[]>([]);
  const [pontoSheetAberto, setPontoSheetAberto] = useState(false);
  const [pontoEditando, setPontoEditando] = useState<PontoEmbarque | null>(null);
  const [pontoLocal, setPontoLocal] = useState('');
  const [pontoHorario, setPontoHorario] = useState('');
  const [pontoLocalError, setPontoLocalError] = useState<string | undefined>();
  const [pontoHorarioError, setPontoHorarioError] = useState<string | undefined>();
  const [pontoFormError, setPontoFormError] = useState<string | null>(null);
  const [salvandoPonto, setSalvandoPonto] = useState(false);
  const [pontoParaRemover, setPontoParaRemover] = useState<PontoEmbarque | null>(null);
  const [removendoPonto, setRemovendoPonto] = useState(false);
  const [removerPontoErro, setRemoverPontoErro] = useState<string | null>(null);
  const [reordenandoPontoId, setReordenandoPontoId] = useState<string | null>(null);
  const [reordenarErro, setReordenarErro] = useState<string | null>(null);

  // Fotos
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [fotoErro, setFotoErro] = useState<string | null>(null);
  const [removendoFotoId, setRemovendoFotoId] = useState<string | null>(null);

  // Checklist legal
  const [checklist, setChecklist] = useState<ChecklistLegal>({
    licenca_antt: false,
    seguro_passageiros: false,
    lista_impressa: false,
  });
  const [checklistErro, setChecklistErro] = useState<string | null>(null);
  const [salvandoChecklistCampo, setSalvandoChecklistCampo] = useState<keyof ChecklistLegal | null>(null);

  function aplicarExcursao(dados: Excursao) {
    setExcursao(dados);
    setDestino(dados.destino);
    setEventoAncora(dados.evento_ancora ?? '');
    setDataSaida(toDatetimeLocalValue(dados.data_saida));
    setDataRetorno(toDatetimeLocalValue(dados.data_retorno));
    setTipo(dados.tipo);
    setVeiculoId(dados.veiculo_id);
    setPrecoReais((dados.preco_centavos / 100).toFixed(2));
    setSinalTipo(dados.sinal_tipo);
    if (dados.sinal_tipo === 'percentual') {
      setSinalPercentual(String(dados.sinal_valor));
    } else {
      setSinalFixoReais((dados.sinal_valor / 100).toFixed(2));
    }
    setDescricao(dados.descricao ?? '');
    setCustoTotalReais(dados.custo_total_centavos != null ? (dados.custo_total_centavos / 100).toFixed(2) : '');
    setPontos([...dados.pontos_embarque].sort((a, b) => a.ordem - b.ordem));
    setFotos([...dados.fotos].sort((a, b) => a.ordem - b.ordem));
    setChecklist(dados.checklist_legal);
  }

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      setErroCarregar(null);
      try {
        const [dados, veic] = await Promise.all([obterExcursao(id), listarVeiculos(1, 100)]);
        if (cancelado) return;
        aplicarExcursao(dados);
        setVeiculos(veic.dados);
      } catch (error) {
        if (cancelado) return;
        setErroCarregar(
          error instanceof ApiError ? error.mensagem : 'Não conseguimos carregar esta excursão.',
        );
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

  const validarEdicao = (): boolean => {
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

  const salvarEdicao = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!id || !validarEdicao()) return;

    setSalvando(true);
    try {
      const custoTotal =
        custoTotalReais.trim() === '' ? null : Math.round(Number.parseFloat(custoTotalReais) * 100);
      const atualizada = await atualizarExcursao(id, {
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
      aplicarExcursao(atualizada);
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

  const publicar = async () => {
    if (!id) return;
    setPublicarErro(null);
    setPublicando(true);
    try {
      const atualizada = await publicarExcursao(id);
      aplicarExcursao(atualizada);
    } catch (error) {
      if (error instanceof ApiError && error.codigo === 'sem_ponto_embarque') {
        setPublicarErro(error.mensagem);
        setActiveTab('pontos');
      } else if (error instanceof ApiError) {
        setPublicarErro(error.mensagem);
      } else {
        setPublicarErro('Não conseguimos publicar agora. Tente de novo.');
      }
    } finally {
      setPublicando(false);
    }
  };

  const abrirCancelar = () => {
    setMotivoCancelamento('');
    setMotivoError(undefined);
    setCancelarErro(null);
    setPendenciasEstorno(null);
    setCancelarSheetAberto(true);
  };

  const confirmarCancelamento = async () => {
    if (!id) return;
    const motivo = motivoCancelamento.trim();
    if (motivo.length < 3 || motivo.length > 500) {
      setMotivoError('O motivo precisa ter entre 3 e 500 caracteres.');
      return;
    }
    setMotivoError(undefined);
    setCancelarErro(null);
    setCancelando(true);
    try {
      const resultado = await cancelarExcursao(id, motivo);
      aplicarExcursao(resultado.excursao);
      setPendenciasEstorno(resultado.pendencias_estorno);
      if (resultado.pendencias_estorno.length === 0) {
        setCancelarSheetAberto(false);
      }
    } catch (error) {
      setCancelarErro(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos cancelar agora. Tente de novo.',
      );
    } finally {
      setCancelando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!id) return;
    setExcluindo(true);
    setExcluirErro(null);
    try {
      await excluirExcursao(id);
      navigate('/excursoes', { replace: true });
    } catch (error) {
      setExcluirErro(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos excluir agora. Tente de novo.',
      );
    } finally {
      setExcluindo(false);
    }
  };

  const abrirAdicionarPonto = () => {
    setPontoEditando(null);
    setPontoLocal('');
    setPontoHorario('');
    setPontoLocalError(undefined);
    setPontoHorarioError(undefined);
    setPontoFormError(null);
    setPontoSheetAberto(true);
  };

  const abrirEditarPonto = (ponto: PontoEmbarque) => {
    setPontoEditando(ponto);
    setPontoLocal(ponto.local);
    setPontoHorario(toDatetimeLocalValue(ponto.horario));
    setPontoLocalError(undefined);
    setPontoHorarioError(undefined);
    setPontoFormError(null);
    setPontoSheetAberto(true);
  };

  const salvarPonto = async (event: FormEvent) => {
    event.preventDefault();
    if (!id) return;
    let ok = true;
    if (!pontoLocal.trim()) {
      setPontoLocalError('Digite o local do embarque.');
      ok = false;
    } else {
      setPontoLocalError(undefined);
    }
    if (!pontoHorario) {
      setPontoHorarioError('Escolha o horário.');
      ok = false;
    } else {
      setPontoHorarioError(undefined);
    }
    if (!ok) return;

    setSalvandoPonto(true);
    setPontoFormError(null);
    try {
      const input = { local: pontoLocal.trim(), horario: new Date(pontoHorario).toISOString() };
      const salvoPonto = pontoEditando
        ? await editarPontoEmbarque(id, pontoEditando.id, input)
        : await adicionarPontoEmbarque(id, input);
      setPontos((atual) => {
        const semEsse = atual.filter((p) => p.id !== salvoPonto.id);
        return [...semEsse, salvoPonto].sort((a, b) => a.ordem - b.ordem);
      });
      setPontoSheetAberto(false);
    } catch (error) {
      if (error instanceof ApiError && error.codigo === 'validacao') {
        const campos = extractFieldErrors(error.detalhes);
        let algumCampo = false;
        if (campos.local) {
          setPontoLocalError(campos.local);
          algumCampo = true;
        }
        if (campos.horario) {
          setPontoHorarioError(campos.horario);
          algumCampo = true;
        }
        if (!algumCampo) setPontoFormError(error.mensagem);
      } else if (error instanceof ApiError) {
        setPontoFormError(error.mensagem);
      } else {
        setPontoFormError('Não conseguimos salvar agora. Tente de novo.');
      }
    } finally {
      setSalvandoPonto(false);
    }
  };

  const confirmarRemoverPonto = async () => {
    if (!id || !pontoParaRemover) return;
    setRemovendoPonto(true);
    setRemoverPontoErro(null);
    try {
      await removerPontoEmbarque(id, pontoParaRemover.id);
      setPontos((atual) => atual.filter((p) => p.id !== pontoParaRemover.id));
      setPontoParaRemover(null);
    } catch (error) {
      setRemoverPontoErro(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos remover agora. Tente de novo.',
      );
    } finally {
      setRemovendoPonto(false);
    }
  };

  const moverPonto = async (ponto: PontoEmbarque, direcao: -1 | 1) => {
    if (!id) return;
    const indice = pontos.findIndex((p) => p.id === ponto.id);
    const novoIndice = indice + direcao;
    if (indice < 0 || novoIndice < 0 || novoIndice >= pontos.length) return;

    const reordenados = [...pontos];
    const [movido] = reordenados.splice(indice, 1);
    reordenados.splice(novoIndice, 0, movido);

    setReordenandoPontoId(ponto.id);
    setReordenarErro(null);
    try {
      const atualizados = await reordenarPontosEmbarque(
        id,
        reordenados.map((p) => p.id),
      );
      setPontos([...atualizados].sort((a, b) => a.ordem - b.ordem));
    } catch (error) {
      setReordenarErro(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos reordenar agora. Tente de novo.',
      );
    } finally {
      setReordenandoPontoId(null);
    }
  };

  const onArquivoFoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0];
    event.target.value = '';
    if (!id || !arquivo) return;
    setFotoErro(null);
    setEnviandoFoto(true);
    try {
      const foto = await enviarFoto(id, arquivo);
      setFotos((atual) => [...atual, foto].sort((a, b) => a.ordem - b.ordem));
    } catch (error) {
      setFotoErro(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos enviar a foto agora. Tente de novo.',
      );
    } finally {
      setEnviandoFoto(false);
    }
  };

  const removerFotoClick = async (foto: Foto) => {
    if (!id) return;
    setFotoErro(null);
    setRemovendoFotoId(foto.id);
    try {
      await removerFoto(id, foto.id);
      setFotos((atual) => atual.filter((f) => f.id !== foto.id));
    } catch (error) {
      setFotoErro(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos remover a foto agora. Tente de novo.',
      );
    } finally {
      setRemovendoFotoId(null);
    }
  };

  const alternarChecklist = async (campo: keyof ChecklistLegal) => {
    if (!id) return;
    const valorAnterior = checklist[campo];
    setChecklist((atual) => ({ ...atual, [campo]: !valorAnterior }));
    setChecklistErro(null);
    setSalvandoChecklistCampo(campo);
    try {
      const atualizado = await atualizarChecklistLegal(id, { [campo]: !valorAnterior });
      setChecklist(atualizado);
    } catch (error) {
      setChecklist((atual) => ({ ...atual, [campo]: valorAnterior }));
      setChecklistErro(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos salvar agora. Tente de novo.',
      );
    } finally {
      setSalvandoChecklistCampo(null);
    }
  };

  if (carregando) {
    return (
      <div className="tt-excursao-detalhe-page">
        <h1 className="tt-excursao-detalhe-title">Excursão</h1>
        <p className="tt-excursao-detalhe-mute">Carregando...</p>
      </div>
    );
  }

  if (erroCarregar || !excursao) {
    return (
      <div className="tt-excursao-detalhe-page">
        <h1 className="tt-excursao-detalhe-title">Excursão</h1>
        <p className="tt-excursao-detalhe-alert" role="alert">
          <span aria-hidden="true">⚠️</span> {erroCarregar ?? 'Excursão não encontrada.'}
        </p>
      </div>
    );
  }

  const podeCancelar = !['em_andamento', 'concluida', 'cancelada'].includes(excursao.status);
  const podeExcluir = excursao.status === 'rascunho';
  const podePublicar = excursao.status === 'rascunho';
  const menorOrdemFoto = fotos.length > 0 ? Math.min(...fotos.map((f) => f.ordem)) : null;

  return (
    <div className="tt-excursao-detalhe-page">
      <ExcursionCard {...excursaoParaCardProps(excursao)} />

      {podePublicar && (
        <div className="tt-excursao-detalhe-publicar">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={publicando}
            loadingLabel="Publicando..."
            onClick={publicar}
          >
            Publicar excursão
          </Button>
          {publicarErro && (
            <p className="tt-excursao-detalhe-alert" role="alert">
              <span aria-hidden="true">⚠️</span> {publicarErro}
            </p>
          )}
        </div>
      )}

      {excursao.status === 'cancelada' && excursao.motivo_cancelamento && (
        <p className="tt-excursao-detalhe-mute">Motivo do cancelamento: {excursao.motivo_cancelamento}</p>
      )}

      <div className="tt-excursao-detalhe-tabs" role="tablist" aria-label="Seções da excursão">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={[
              'tt-excursao-detalhe-tab',
              activeTab === tab.key ? 'tt-excursao-detalhe-tab--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'detalhes' && (
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

          <form className="tt-excursao-detalhe-form" onSubmit={salvarEdicao} noValidate>
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
                Empata com <span className="tt-mono">{excursao.viabilidade.ponto_equilibrio_pagos}</span> pagos ·
                hoje: <span className="tt-mono">{excursao.viabilidade.pagos_atuais}</span> pagos
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

          {podeCancelar && (
            <Button variant="danger" fullWidth size="lg" onClick={abrirCancelar}>
              Cancelar excursão
            </Button>
          )}
          {podeExcluir && (
            <Button variant="danger" fullWidth size="lg" onClick={() => setExcluirSheetAberto(true)}>
              Excluir rascunho
            </Button>
          )}
        </div>
      )}

      {activeTab === 'pontos' && (
        <div className="tt-excursao-detalhe-tab-content">
          {pontos.length === 0 && (
            <p className="tt-excursao-detalhe-mute">Nenhum ponto de embarque ainda. Adicione pelo menos um.</p>
          )}

          {reordenarErro && (
            <p className="tt-excursao-detalhe-alert" role="alert">
              <span aria-hidden="true">⚠️</span> {reordenarErro}
            </p>
          )}

          <div className="tt-excursao-detalhe-pontos-list">
            {pontos.map((ponto, index) => (
              <div key={ponto.id} className="tt-excursao-detalhe-ponto-row">
                <div className="tt-excursao-detalhe-ponto-info">
                  <span className="tt-excursao-detalhe-ponto-local">{ponto.local}</span>
                  <span className="tt-excursao-detalhe-ponto-horario tt-mono">{formatHora(ponto.horario)}</span>
                </div>
                <div className="tt-excursao-detalhe-ponto-actions">
                  <button
                    type="button"
                    className="tt-excursao-detalhe-icon-btn"
                    aria-label={`Mover ${ponto.local} para cima`}
                    disabled={index === 0 || reordenandoPontoId !== null}
                    onClick={() => moverPonto(ponto, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="tt-excursao-detalhe-icon-btn"
                    aria-label={`Mover ${ponto.local} para baixo`}
                    disabled={index === pontos.length - 1 || reordenandoPontoId !== null}
                    onClick={() => moverPonto(ponto, 1)}
                  >
                    ↓
                  </button>
                  <Button variant="ghost" size="md" onClick={() => abrirEditarPonto(ponto)}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      setPontoParaRemover(ponto);
                      setRemoverPontoErro(null);
                    }}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button variant="secondary" fullWidth onClick={abrirAdicionarPonto}>
            Adicionar ponto de embarque
          </Button>
        </div>
      )}

      {activeTab === 'fotos' && (
        <div className="tt-excursao-detalhe-tab-content">
          {fotoErro && (
            <p className="tt-excursao-detalhe-alert" role="alert">
              <span aria-hidden="true">⚠️</span> {fotoErro}
            </p>
          )}

          {fotos.length === 0 ? (
            <p className="tt-excursao-detalhe-mute">Nenhuma foto ainda.</p>
          ) : (
            <div className="tt-excursao-detalhe-fotos-grid">
              {fotos.map((foto) => (
                <div key={foto.id} className="tt-excursao-detalhe-foto-item">
                  <img src={foto.url} alt={`Foto de ${excursao.destino}`} className="tt-excursao-detalhe-foto-img" />
                  {foto.ordem === menorOrdemFoto && (
                    <Badge tone="mute" className="tt-excursao-detalhe-foto-capa">
                      Capa
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="md"
                    fullWidth
                    loading={removendoFotoId === foto.id}
                    loadingLabel="Removendo..."
                    onClick={() => removerFotoClick(foto)}
                  >
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="tt-excursao-detalhe-upload">
            <label className="tt-excursao-detalhe-upload-label" htmlFor="upload-foto">
              {enviandoFoto ? 'Enviando...' : 'Adicionar foto'}
            </label>
            <input
              id="upload-foto"
              className="tt-excursao-detalhe-upload-input"
              type="file"
              accept="image/*"
              disabled={enviandoFoto}
              onChange={onArquivoFoto}
            />
          </div>
        </div>
      )}

      {activeTab === 'checklist' && (
        <div className="tt-excursao-detalhe-tab-content">
          <p className="tt-excursao-detalhe-mute">
            É só um lembrete — nada aqui trava a publicação ou qualquer outra ação.
          </p>
          <div className="tt-excursao-detalhe-checklist">
            {CHECKLIST_ITEMS.map((item) => (
              <label key={item.campo} className="tt-excursao-detalhe-checklist-item">
                <input
                  type="checkbox"
                  checked={checklist[item.campo]}
                  disabled={salvandoChecklistCampo === item.campo}
                  onChange={() => alternarChecklist(item.campo)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
          {checklistErro && (
            <p className="tt-excursao-detalhe-alert" role="alert">
              <span aria-hidden="true">⚠️</span> {checklistErro}
            </p>
          )}
        </div>
      )}

      <Sheet open={cancelarSheetAberto} onClose={() => setCancelarSheetAberto(false)} title="Cancelar excursão">
        <div className="tt-excursao-detalhe-sheet-form">
          {pendenciasEstorno === null ? (
            <>
              <p>
                Isso cancela a excursão pra todo mundo. Reservas pagas geram pendência de estorno — o estorno em si
                é manual, fora do sistema.
              </p>
              <Input
                label="Motivo do cancelamento"
                value={motivoCancelamento}
                onChange={(event) => setMotivoCancelamento(event.target.value)}
                error={motivoError}
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
                  Cancelar excursão
                </Button>
              </div>
            </>
          ) : (
            <>
              <p>Excursão cancelada.</p>
              {pendenciasEstorno.length > 0 ? (
                <>
                  <p>Pendências de estorno (resolva manualmente, fora do sistema):</p>
                  <ul className="tt-excursao-detalhe-pendencias">
                    {pendenciasEstorno.map((pendencia) => (
                      <li key={pendencia.id} className="tt-mono">
                        {formatMoeda(pendencia.valor_centavos)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>Sem reservas pagas — nenhuma pendência de estorno.</p>
              )}
              <Button variant="secondary" fullWidth onClick={() => setCancelarSheetAberto(false)}>
                Entendi
              </Button>
            </>
          )}
        </div>
      </Sheet>

      <Sheet open={excluirSheetAberto} onClose={() => setExcluirSheetAberto(false)} title="Excluir rascunho">
        <div className="tt-excursao-detalhe-sheet-form">
          <p>Excluir o rascunho de {excursao.destino}? Essa ação não pode ser desfeita.</p>
          {excluirErro && (
            <p className="tt-excursao-detalhe-alert" role="alert">
              <span aria-hidden="true">⚠️</span> {excluirErro}
            </p>
          )}
          <div className="tt-excursao-detalhe-sheet-actions">
            <Button variant="secondary" fullWidth onClick={() => setExcluirSheetAberto(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              fullWidth
              loading={excluindo}
              loadingLabel="Excluindo..."
              onClick={confirmarExclusao}
            >
              Excluir rascunho
            </Button>
          </div>
        </div>
      </Sheet>

      <Sheet
        open={pontoSheetAberto}
        onClose={() => setPontoSheetAberto(false)}
        title={pontoEditando ? 'Editar ponto de embarque' : 'Adicionar ponto de embarque'}
      >
        <form className="tt-excursao-detalhe-sheet-form" onSubmit={salvarPonto} noValidate>
          <Input
            label="Local"
            maxLength={200}
            value={pontoLocal}
            onChange={(event) => setPontoLocal(event.target.value)}
            error={pontoLocalError}
          />
          <Input
            label="Horário"
            type="datetime-local"
            value={pontoHorario}
            onChange={(event) => setPontoHorario(event.target.value)}
            error={pontoHorarioError}
          />
          {pontoFormError && (
            <p className="tt-excursao-detalhe-alert" role="alert">
              <span aria-hidden="true">⚠️</span> {pontoFormError}
            </p>
          )}
          <Button type="submit" fullWidth loading={salvandoPonto} loadingLabel="Salvando...">
            {pontoEditando ? 'Salvar ponto' : 'Adicionar ponto'}
          </Button>
        </form>
      </Sheet>

      <Sheet
        open={pontoParaRemover !== null}
        onClose={() => {
          setPontoParaRemover(null);
          setRemoverPontoErro(null);
        }}
        title="Remover ponto de embarque"
      >
        <div className="tt-excursao-detalhe-sheet-form">
          <p>Remover o ponto "{pontoParaRemover?.local}"?</p>
          {removerPontoErro && (
            <p className="tt-excursao-detalhe-alert" role="alert">
              <span aria-hidden="true">⚠️</span> {removerPontoErro}
            </p>
          )}
          <div className="tt-excursao-detalhe-sheet-actions">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setPontoParaRemover(null);
                setRemoverPontoErro(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              fullWidth
              loading={removendoPonto}
              loadingLabel="Removendo..."
              onClick={confirmarRemoverPonto}
            >
              Remover ponto
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
