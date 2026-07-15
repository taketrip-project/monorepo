import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../../lib/api/client';
import { baixarListaImpressao, type Reserva } from '../../../lib/api/bookings';
import { obterExcursao, type Excursao } from '../../../lib/api/excursions';
import { CadastroRapidoSheet } from './passageiros/CadastroRapidoSheet';
import { EmbarqueView } from './passageiros/EmbarqueView';
import { MapaPoltronasView } from './passageiros/MapaPoltronasView';
import { ReservasListaView } from './passageiros/ReservasListaView';
import './excursaoDetalhe.css';
import './passageiros/passageiros.css';

type ViewKey = 'lista' | 'mapa' | 'embarque';

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'lista', label: 'Lista' },
  { key: 'mapa', label: 'Mapa' },
  { key: 'embarque', label: 'Embarque' },
];

/** View inicial endereçável por URL (`?visao=embarque`) — usada pelo atalho "Lista de embarque" do Início (H1.14). */
function viewInicial(param: string | null): ViewKey {
  return VIEWS.some((view) => view.key === param) ? (param as ViewKey) : 'lista';
}

interface PassageirosTabProps {
  excursaoId: string;
  precoDefaultCentavos: number;
  /** Reflete vagas/pagos/pendentes atualizados no card-resumo do topo, sem recarregar a página inteira. */
  onExcursaoAtualizada: (patch: Partial<Excursao>) => void;
}

/**
 * Aba "Passageiros" (H1.8–H1.13): três views internas — Lista (busca +
 * filtro, H1.11), Mapa (toque numa vaga livre reserva, H1.8) e Embarque
 * (check-in de 1 toque, H1.12). O cadastro rápido (H1.9) é compartilhado
 * entre Lista e Mapa e vive aqui, no orquestrador — só o Mapa oferece a
 * vaga pré-selecionada (frontend-guidelines §8).
 */
export function PassageirosTab({ excursaoId, precoDefaultCentavos, onExcursaoAtualizada }: PassageirosTabProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<ViewKey>(() => viewInicial(searchParams.get('visao')));
  const [refreshKey, setRefreshKey] = useState(0);

  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [poltronaCadastro, setPoltronaCadastro] = useState<number | null>(null);
  // Muda a cada abertura -> força a CadastroRapidoSheet remontar com estado limpo,
  // sem precisar de um efeito de reset dentro dela.
  const [cadastroOpenId, setCadastroOpenId] = useState(0);

  const [imprimindo, setImprimindo] = useState(false);
  const [erroImprimir, setErroImprimir] = useState<string | null>(null);

  const abrirFicha = (reservaId: string) => {
    navigate(`/excursoes/${excursaoId}/reservas/${reservaId}`);
  };

  const abrirCadastro = (poltrona: number) => {
    setCadastroOpenId((atual) => atual + 1);
    setPoltronaCadastro(poltrona);
    setCadastroAberto(true);
  };

  const aoCriarReserva = async (_reserva: Reserva) => {
    setCadastroAberto(false);
    setPoltronaCadastro(null);
    // Sucesso esperado (cadastro é a ação mais repetida do app) é silencioso:
    // fecha a sheet e deixa mapa/lista refletirem a mudança sozinhos.
    setRefreshKey((k) => k + 1);
    try {
      const atualizada = await obterExcursao(excursaoId);
      onExcursaoAtualizada(atualizada);
    } catch {
      // O card-resumo do topo só fica desatualizado até a próxima visita à tela — não é bloqueante.
    }
  };

  const imprimirLista = async () => {
    setImprimindo(true);
    setErroImprimir(null);
    const novaAba = window.open('', '_blank');
    try {
      const blob = await baixarListaImpressao(excursaoId, 'pdf');
      const url = URL.createObjectURL(blob);
      if (novaAba) {
        novaAba.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    } catch (error) {
      novaAba?.close();
      setErroImprimir(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos gerar a lista agora. Tente de novo.',
      );
    } finally {
      setImprimindo(false);
    }
  };

  return (
    <div className="tt-excursao-detalhe-tab-content">
      <div className="tt-excursao-detalhe-tabs" role="tablist" aria-label="Ver passageiros como">
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={view === item.key}
            className={[
              'tt-excursao-detalhe-tab',
              view === item.key ? 'tt-excursao-detalhe-tab--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setView(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {erroImprimir && (
        <p className="tt-excursao-detalhe-alert" role="alert">
          <span aria-hidden="true">⚠️</span> {erroImprimir}
        </p>
      )}

      {view === 'lista' && (
        <ReservasListaView
          excursaoId={excursaoId}
          onAbrirFicha={abrirFicha}
          onImprimir={imprimirLista}
          imprimindo={imprimindo}
          refreshKey={refreshKey}
        />
      )}

      {view === 'mapa' && (
        <MapaPoltronasView
          excursaoId={excursaoId}
          onAbrirCadastro={abrirCadastro}
          onAbrirFicha={abrirFicha}
          refreshKey={refreshKey}
        />
      )}

      {view === 'embarque' && <EmbarqueView excursaoId={excursaoId} refreshKey={refreshKey} />}

      <CadastroRapidoSheet
        key={cadastroOpenId}
        open={cadastroAberto}
        onClose={() => setCadastroAberto(false)}
        excursaoId={excursaoId}
        poltrona={poltronaCadastro}
        precoDefaultCentavos={precoDefaultCentavos}
        onCriada={aoCriarReserva}
      />
    </div>
  );
}
