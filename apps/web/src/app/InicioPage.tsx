import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ExcursionCard } from '../ui';
import { ApiError } from '../lib/api/client';
import { obterInicio, type ExcursaoCard } from '../lib/api/excursions';
import { excursaoParaCardProps } from '../features/excursoes/excursaoCard';
import './InicioPage.css';

/** Dashboard mínimo (H1.14): a próxima excursão em um golpe de vista. */
export function InicioPage() {
  const navigate = useNavigate();
  const [proximaExcursao, setProximaExcursao] = useState<ExcursaoCard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const resposta = await obterInicio();
        if (cancelado) return;
        setProximaExcursao(resposta.proxima_excursao);
      } catch (error) {
        if (cancelado) return;
        setErroCarregar(
          error instanceof ApiError ? error.mensagem : 'Não conseguimos carregar seu painel.',
        );
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="tt-inicio-page">
      <h1 className="tt-inicio-title">Início</h1>

      {carregando && <p className="tt-inicio-mute">Carregando...</p>}

      {!carregando && erroCarregar && (
        <p className="tt-inicio-alert" role="alert">
          <span aria-hidden="true">⚠️</span> {erroCarregar}
        </p>
      )}

      {!carregando && !erroCarregar && proximaExcursao && (
        <>
          <p className="tt-inicio-mute">Sua próxima excursão</p>
          <ExcursionCard
            {...excursaoParaCardProps(proximaExcursao)}
            onClick={() => navigate(`/excursoes/${proximaExcursao.id}`)}
          />
        </>
      )}

      {!carregando && !erroCarregar && !proximaExcursao && (
        <div className="tt-inicio-vazio">
          <p className="tt-inicio-vazio-texto">Nenhuma excursão por aí ainda, que tal criar a primeira?</p>
          <Button size="lg" fullWidth onClick={() => navigate('/excursoes/nova')}>
            Criar excursão
          </Button>
        </div>
      )}
    </div>
  );
}
