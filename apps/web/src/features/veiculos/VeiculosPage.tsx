import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FAB, ListRow } from '../../ui';
import { ApiError } from '../../lib/api/client';
import { listarVeiculos, type Veiculo } from '../../lib/api/fleet';
import { TIPO_VEICULO_LABEL } from './tipoVeiculo';
import './VeiculosPage.css';

const POR_PAGINA = 20;

function avatarPorTipo(veiculo: Veiculo): string {
  return veiculo.tipo === 'van' ? '🚐' : '🚌';
}

export function VeiculosPage() {
  const navigate = useNavigate();
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [erroPaginar, setErroPaginar] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const resposta = await listarVeiculos(1, POR_PAGINA);
        if (cancelado) return;
        setVeiculos(resposta.dados);
        setPagina(resposta.paginacao.pagina);
        setTotal(resposta.paginacao.total);
      } catch (error) {
        if (cancelado) return;
        setErroCarregar(
          error instanceof ApiError ? error.mensagem : 'Não conseguimos carregar os veículos.',
        );
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const carregarMais = async () => {
    setErroPaginar(null);
    setCarregandoMais(true);
    try {
      const proximaPagina = pagina + 1;
      const resposta = await listarVeiculos(proximaPagina, POR_PAGINA);
      setVeiculos((atual) => [...atual, ...resposta.dados]);
      setPagina(resposta.paginacao.pagina);
      setTotal(resposta.paginacao.total);
    } catch (error) {
      setErroPaginar(
        error instanceof ApiError ? error.mensagem : 'Não conseguimos carregar mais veículos.',
      );
    } finally {
      setCarregandoMais(false);
    }
  };

  if (carregando) {
    return (
      <div className="tt-veiculos-page">
        <h1 className="tt-veiculos-title">Veículos</h1>
        <p className="tt-veiculos-mute">Carregando...</p>
      </div>
    );
  }

  if (erroCarregar) {
    return (
      <div className="tt-veiculos-page">
        <h1 className="tt-veiculos-title">Veículos</h1>
        <p className="tt-veiculos-alert tt-veiculos-alert--danger" role="alert">
          <span aria-hidden="true">⚠️</span> {erroCarregar}
        </p>
      </div>
    );
  }

  const temMais = veiculos.length < total;

  return (
    <div className="tt-veiculos-page">
      <h1 className="tt-veiculos-title">Veículos</h1>

      {veiculos.length === 0 ? (
        <p className="tt-veiculos-mute">
          Nenhum veículo cadastrado ainda. Toque em "Novo veículo" para começar.
        </p>
      ) : (
        <>
          <div className="tt-veiculos-list">
            {veiculos.map((veiculo) => (
              <ListRow
                key={veiculo.id}
                avatar={avatarPorTipo(veiculo)}
                title={veiculo.apelido}
                subtitle={`${veiculo.placa} · ${TIPO_VEICULO_LABEL[veiculo.tipo]} · ${veiculo.capacidade} vagas`}
                onClick={() => navigate(`/veiculos/${veiculo.id}`)}
              />
            ))}
          </div>

          {erroPaginar && (
            <p className="tt-veiculos-alert tt-veiculos-alert--danger" role="alert">
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

      <FAB label="Novo veículo" icon="+" onClick={() => navigate('/veiculos/novo')} />
    </div>
  );
}
