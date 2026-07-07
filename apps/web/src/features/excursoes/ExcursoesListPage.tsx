import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ExcursionCard, FAB } from '../../ui';
import { ApiError } from '../../lib/api/client';
import { listarExcursoes, type ExcursaoCard, type FiltroExcursoes } from '../../lib/api/excursions';
import { excursaoParaCardProps } from './excursaoCard';
import { FILTROS_EXCURSOES, FILTRO_LABEL } from './excursaoLabels';
import './ExcursoesListPage.css';

const POR_PAGINA = 20;

const MENSAGEM_VAZIO: Record<FiltroExcursoes, string> = {
  proximas: 'Nenhuma excursão por aí ainda. Toque em "Nova excursão" para começar.',
  hoje: 'Nenhuma excursão hoje.',
  concluidas: 'Nenhuma excursão concluída ainda.',
  rascunho: 'Nenhum rascunho por aqui.',
};

/** Lista de excursões da organização (H1.7): abas de filtro + FAB de criação. */
export function ExcursoesListPage() {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<FiltroExcursoes>('proximas');
  const [excursoes, setExcursoes] = useState<ExcursaoCard[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [erroPaginar, setErroPaginar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setCarregando(true);
      setErroCarregar(null);
      try {
        const resposta = await listarExcursoes(filtro, 1, POR_PAGINA);
        if (cancelado) return;
        setExcursoes(resposta.dados);
        setPagina(resposta.paginacao.pagina);
        setTotal(resposta.paginacao.total);
      } catch (error) {
        if (cancelado) return;
        setErroCarregar(
          error instanceof ApiError ? error.mensagem : 'Não conseguimos carregar as excursões.',
        );
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [filtro]);

  const carregarMais = async () => {
    setErroPaginar(null);
    setCarregandoMais(true);
    try {
      const proximaPagina = pagina + 1;
      const resposta = await listarExcursoes(filtro, proximaPagina, POR_PAGINA);
      setExcursoes((atual) => [...atual, ...resposta.dados]);
      setPagina(resposta.paginacao.pagina);
      setTotal(resposta.paginacao.total);
    } catch (error) {
      setErroPaginar(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos carregar mais excursões.',
      );
    } finally {
      setCarregandoMais(false);
    }
  };

  const temMais = excursoes.length < total;

  return (
    <div className="tt-excursoes-page">
      <h1 className="tt-excursoes-title">Excursões</h1>

      <div className="tt-excursoes-tabs" role="tablist" aria-label="Filtrar excursões">
        {FILTROS_EXCURSOES.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={filtro === item}
            className={['tt-excursoes-tab', filtro === item ? 'tt-excursoes-tab--active' : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => setFiltro(item)}
          >
            {FILTRO_LABEL[item]}
          </button>
        ))}
      </div>

      {carregando && <p className="tt-excursoes-mute">Carregando...</p>}

      {!carregando && erroCarregar && (
        <p className="tt-excursoes-alert" role="alert">
          <span aria-hidden="true">⚠️</span> {erroCarregar}
        </p>
      )}

      {!carregando && !erroCarregar && excursoes.length === 0 && (
        <p className="tt-excursoes-mute">{MENSAGEM_VAZIO[filtro]}</p>
      )}

      {!carregando && !erroCarregar && excursoes.length > 0 && (
        <>
          <div className="tt-excursoes-list">
            {excursoes.map((excursao) => (
              <ExcursionCard
                key={excursao.id}
                {...excursaoParaCardProps(excursao)}
                onClick={() => navigate(`/excursoes/${excursao.id}`)}
              />
            ))}
          </div>

          {erroPaginar && (
            <p className="tt-excursoes-alert" role="alert">
              <span aria-hidden="true">⚠️</span> {erroPaginar}
            </p>
          )}

          {temMais && (
            <Button
              variant="secondary"
              fullWidth
              loading={carregandoMais}
              loadingLabel="Carregando..."
              onClick={carregarMais}
            >
              Carregar mais
            </Button>
          )}
        </>
      )}

      <FAB label="Nova excursão" icon="+" onClick={() => navigate('/excursoes/nova')} />
    </div>
  );
}
