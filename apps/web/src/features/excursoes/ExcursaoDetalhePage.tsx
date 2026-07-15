import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, ExcursionCard, Input, Sheet, useToast } from '../../ui';
import { ApiError } from '../../lib/api/client';
import {
  cancelarExcursao,
  excluirExcursao,
  obterExcursao,
  publicarExcursao,
  type Excursao,
  type PendenciaEstorno,
} from '../../lib/api/excursions';
import { listarVeiculos, type Veiculo } from '../../lib/api/fleet';
import { formatMoeda } from '../../lib/format';
import { excursaoParaCardProps } from './excursaoCard';
import { ChecklistLegalTab } from './excursaoDetalhe/ChecklistLegalTab';
import { DetalhesTab } from './excursaoDetalhe/DetalhesTab';
import { FotosTab } from './excursaoDetalhe/FotosTab';
import { PassageirosTab } from './excursaoDetalhe/PassageirosTab';
import { PontosEmbarqueTab } from './excursaoDetalhe/PontosEmbarqueTab';
import './excursaoDetalhe/excursaoDetalhe.css';

type TabKey = 'detalhes' | 'passageiros' | 'pontos' | 'fotos' | 'checklist';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'detalhes', label: 'Detalhes' },
  { key: 'passageiros', label: 'Passageiros' },
  { key: 'pontos', label: 'Pontos de embarque' },
  { key: 'fotos', label: 'Fotos' },
  { key: 'checklist', label: 'Checklist legal' },
];

/** Aba inicial endereçável por URL (`?aba=passageiros`) — permite atalhos de 1 toque, como o do Início pro embarque (H1.14). */
function tabInicial(param: string | null): TabKey {
  return TABS.some((tab) => tab.key === param) ? (param as TabKey) : 'detalhes';
}

/**
 * Detalhe da excursão (H1.5–H1.7, H3.4, H3.5). Este componente cuida só do
 * que é transversal às abas — carregar a excursão, a aba ativa, e o ciclo
 * de vida que não pertence a uma aba específica (Publicar, Cancelar,
 * Excluir). Cada aba (Detalhes/Pontos/Fotos/Checklist) é um subcomponente
 * com seu próprio estado local, que notifica este componente quando a
 * excursão muda via callbacks `on*Atualizad@s` — sem estado global.
 */
export function ExcursaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { mostrarToast } = useToast();

  const [excursao, setExcursao] = useState<Excursao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(() => tabInicial(searchParams.get('aba')));

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);

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

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      setErroCarregar(null);
      try {
        const [dados, veic] = await Promise.all([obterExcursao(id), listarVeiculos(1, 100)]);
        if (cancelado) return;
        setExcursao(dados);
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

  /** Mescla uma atualização parcial na excursão carregada (header/card-resumo refletem na hora). */
  const atualizarExcursaoParcial = (patch: Partial<Excursao>) => {
    setExcursao((atual) => (atual ? { ...atual, ...patch } : atual));
  };

  const publicar = async () => {
    if (!id) return;
    setPublicarErro(null);
    setPublicando(true);
    try {
      const atualizada = await publicarExcursao(id);
      setExcursao(atualizada);
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
      setExcursao(resultado.excursao);
      setPendenciasEstorno(resultado.pendencias_estorno);
      // Cancelar é raro e irreversível — sucesso "surpreendente" merece toast
      // (frontend-guidelines §8), diferente do sucesso silencioso de ações
      // repetidas. Quando há pendência de estorno, a sheet permanece aberta
      // mostrando a lista; o toast complementa, não substitui essa exibição.
      mostrarToast('Excursão cancelada.');
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
        <DetalhesTab excursao={excursao} veiculos={veiculos} onSalvo={setExcursao} />
      )}

      {activeTab === 'passageiros' && (
        <PassageirosTab
          excursaoId={excursao.id}
          precoDefaultCentavos={excursao.preco_centavos}
          onExcursaoAtualizada={atualizarExcursaoParcial}
        />
      )}

      {activeTab === 'pontos' && (
        <PontosEmbarqueTab
          excursaoId={excursao.id}
          pontos={excursao.pontos_embarque}
          onPontosAtualizados={(pontos) => atualizarExcursaoParcial({ pontos_embarque: pontos })}
        />
      )}

      {activeTab === 'fotos' && (
        <FotosTab
          excursaoId={excursao.id}
          destino={excursao.destino}
          fotos={excursao.fotos}
          onFotosAtualizadas={(fotos) => atualizarExcursaoParcial({ fotos })}
        />
      )}

      {activeTab === 'checklist' && (
        <ChecklistLegalTab
          excursaoId={excursao.id}
          checklist={excursao.checklist_legal}
          onChecklistAtualizado={(checklist) => atualizarExcursaoParcial({ checklist_legal: checklist })}
        />
      )}

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
    </div>
  );
}
