import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, SeatMap, type SeatMapLegendaItem, type SeatMapPoltrona } from '../../ui';
import { ApiError } from '../../lib/api/client';
import {
  obterExcursaoPublica,
  obterMapaPoltronasPublico,
  type ExcursaoPublica,
  type MapaPoltronasPublico,
} from '../../lib/api/publico';
import { formatDataCurta, formatHora, formatMoeda } from '../../lib/format';
import { TIPO_EXCURSAO_LABEL } from '../excursoes/excursaoLabels';
import { PublicoLayout } from './PublicoLayout';
import { ReservaFormSheet } from './ReservaFormSheet';
import './publico.css';

/** Estados reduzidos do mapa público (docs/api/publico.yaml) — sem pendente/pago, sem nomes. */
const LEGENDA_PUBLICA: SeatMapLegendaItem[] = [
  { bucket: 'empty', label: 'Livre' },
  { bucket: 'paid', label: 'Ocupada' },
  { bucket: 'blocked', label: 'Bloqueada' },
];

type ErroCarregamento =
  | { tipo: 'indisponivel' }
  | { tipo: 'muitas_tentativas'; retryAfterSeconds?: number }
  | { tipo: 'rede' };

/**
 * Página pública da excursão (H3.1) + reserva do passageiro (H3.2) —
 * rota /e/{codigo} (mesmo padrão da `url_publica` que o organizador
 * compartilha no WhatsApp/Instagram). Sem login: detalhes, pontos de
 * embarque, mapa de poltronas e o formulário de reserva num Sheet.
 */
export function ExcursaoPublicaPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();

  const [excursao, setExcursao] = useState<ExcursaoPublica | null>(null);
  const [mapa, setMapa] = useState<MapaPoltronasPublico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<ErroCarregamento | null>(null);

  const [selecionada, setSelecionada] = useState<number | null>(null);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [sheetKey, setSheetKey] = useState(0);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!codigo) return;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const [dadosExcursao, dadosMapa] = await Promise.all([
          obterExcursaoPublica(codigo),
          obterMapaPoltronasPublico(codigo),
        ]);
        if (cancelado) return;
        setExcursao(dadosExcursao);
        setMapa(dadosMapa);
      } catch (error) {
        if (cancelado) return;
        if (error instanceof ApiError && error.status === 404) {
          setErro({ tipo: 'indisponivel' });
        } else if (error instanceof ApiError && error.codigo === 'muitas_tentativas') {
          setErro({ tipo: 'muitas_tentativas', retryAfterSeconds: error.retryAfterSeconds });
        } else {
          setErro({ tipo: 'rede' });
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [codigo, tentativa]);

  const tentarDeNovo = () => setTentativa((t) => t + 1);

  useEffect(() => {
    if (excursao) document.title = `${excursao.destino} · taketrip`;
  }, [excursao]);

  const atualizarMapa = useCallback(async () => {
    if (!codigo) return;
    try {
      setMapa(await obterMapaPoltronasPublico(codigo));
    } catch {
      // Atualização de conveniência após conflito — se falhar, o mapa antigo fica.
    }
  }, [codigo]);

  const aoTocarPoltrona = (poltrona: SeatMapPoltrona) => {
    if (poltrona.estado !== 'livre') return;
    setSelecionada((atual) => (atual === poltrona.numero ? null : poltrona.numero));
  };

  const abrirReserva = () => {
    setSheetKey((k) => k + 1);
    setSheetAberto(true);
  };

  const aoConflitoPoltrona = () => {
    setSelecionada(null);
    atualizarMapa();
  };

  if (carregando) {
    return (
      <PublicoLayout>
        <p className="tt-publico-mute" role="status">
          Carregando excursão...
        </p>
      </PublicoLayout>
    );
  }

  if (erro || !excursao || !mapa) {
    return (
      <PublicoLayout>
        <div className="tt-publico-vazio">
          {erro?.tipo === 'indisponivel' ? (
            <>
              <span className="tt-publico-vazio-icone" aria-hidden="true">
                🚌
              </span>
              <h1 className="tt-publico-vazio-titulo">Excursão indisponível</h1>
              <p className="tt-publico-mute">
                Este link não está mais ativo. Confira com quem te mandou se a excursão ainda está aberta.
              </p>
            </>
          ) : erro?.tipo === 'muitas_tentativas' ? (
            <>
              <span className="tt-publico-vazio-icone" aria-hidden="true">
                ⏳
              </span>
              <h1 className="tt-publico-vazio-titulo">Muita gente acessando</h1>
              <p className="tt-publico-mute">
                {erro.retryAfterSeconds
                  ? `Espere ${erro.retryAfterSeconds}s e tente de novo.`
                  : 'Espere um pouquinho e tente de novo.'}
              </p>
              <Button variant="secondary" onClick={tentarDeNovo}>
                Tentar de novo
              </Button>
            </>
          ) : (
            <>
              <span className="tt-publico-vazio-icone" aria-hidden="true">
                📡
              </span>
              <h1 className="tt-publico-vazio-titulo">Sem conexão</h1>
              <p className="tt-publico-mute">Não conseguimos carregar a excursão. Confira sua internet.</p>
              <Button variant="secondary" onClick={tentarDeNovo}>
                Tentar de novo
              </Button>
            </>
          )}
        </div>
      </PublicoLayout>
    );
  }

  return (
    <PublicoLayout>
      {excursao.fotos.length > 0 && (
        <div className="tt-publico-fotos">
          {excursao.fotos.map((url, indice) => (
            <img key={url} className="tt-publico-foto" src={url} alt={`Foto ${indice + 1} de ${excursao.destino}`} />
          ))}
        </div>
      )}

      <header className="tt-publico-header">
        <div className="tt-publico-badges">
          <Badge shape="chip">{TIPO_EXCURSAO_LABEL[excursao.tipo]}</Badge>
          {excursao.aceita_reserva ? (
            <Badge tone="success" icon={<span aria-hidden="true">●</span>}>
              {excursao.vagas} {excursao.vagas === 1 ? 'vaga' : 'vagas'}
            </Badge>
          ) : (
            <Badge tone="warning" icon={<span aria-hidden="true">●</span>}>
              Lotada
            </Badge>
          )}
        </div>
        <h1 className="tt-publico-destino">{excursao.destino}</h1>
        {excursao.evento_ancora && <p className="tt-publico-sub">{excursao.evento_ancora}</p>}
        <p className="tt-publico-sub">por {excursao.organizacao_nome}</p>
      </header>

      <section className="tt-publico-card" aria-label="Datas e valores">
        <div className="tt-publico-linha">
          <span className="tt-publico-linha-label">Saída</span>
          <span className="tt-publico-linha-valor">
            {formatDataCurta(excursao.data_saida)} · {formatHora(excursao.data_saida)}
          </span>
        </div>
        <div className="tt-publico-linha">
          <span className="tt-publico-linha-label">Retorno</span>
          <span className="tt-publico-linha-valor">
            {formatDataCurta(excursao.data_retorno)} · {formatHora(excursao.data_retorno)}
          </span>
        </div>
        <div className="tt-publico-linha">
          <span className="tt-publico-linha-label">Valor por pessoa</span>
          <span className="tt-publico-linha-valor">{formatMoeda(excursao.preco_centavos)}</span>
        </div>
        {excursao.sinal_centavos > 0 && excursao.sinal_centavos < excursao.preco_centavos && (
          <div className="tt-publico-linha">
            <span className="tt-publico-linha-label">Sinal para garantir</span>
            <span className="tt-publico-linha-valor">{formatMoeda(excursao.sinal_centavos)}</span>
          </div>
        )}
      </section>

      {excursao.descricao && (
        <section className="tt-publico-card" aria-label="Sobre a excursão">
          <h2 className="tt-publico-card-title">Sobre a excursão</h2>
          <p className="tt-publico-descricao">{excursao.descricao}</p>
        </section>
      )}

      {excursao.pontos_embarque.length > 0 && (
        <section className="tt-publico-card" aria-label="Pontos de embarque">
          <h2 className="tt-publico-card-title">Pontos de embarque</h2>
          <ul className="tt-publico-pontos">
            {[...excursao.pontos_embarque]
              .sort((a, b) => a.ordem - b.ordem)
              .map((ponto) => (
                <li key={`${ponto.ordem}-${ponto.local}`} className="tt-publico-ponto">
                  <span className="tt-publico-ponto-local">{ponto.local}</span>
                  <span className="tt-publico-ponto-horario">{formatHora(ponto.horario)}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="tt-publico-card" aria-label="Escolha sua poltrona">
        <h2 className="tt-publico-card-title">
          {excursao.aceita_reserva ? 'Escolha sua poltrona' : 'Poltronas'}
        </h2>
        {!excursao.aceita_reserva && (
          <p className="tt-publico-alert tt-publico-alert--warning" role="status">
            <span aria-hidden="true">🚌</span> Essa excursão lotou! Fale com o organizador para entrar na
            lista de espera.
          </p>
        )}
        <SeatMap
          fileiras={mapa.layout.fileiras}
          poltronas={mapa.poltronas}
          selecionada={selecionada}
          onSeatClick={excursao.aceita_reserva ? aoTocarPoltrona : undefined}
          legendaItens={LEGENDA_PUBLICA}
        />
      </section>

      {excursao.aceita_reserva && (
        <div className="tt-publico-cta">
          <div className="tt-publico-cta-inner">
            <div className="tt-publico-cta-preco">
              <span className="tt-publico-cta-preco-valor">{formatMoeda(excursao.preco_centavos)}</span>
              {excursao.sinal_centavos > 0 && excursao.sinal_centavos < excursao.preco_centavos && (
                <span className="tt-publico-cta-preco-sub">
                  sinal de <span className="tt-mono">{formatMoeda(excursao.sinal_centavos)}</span>
                </span>
              )}
            </div>
            <Button size="lg" disabled={selecionada === null} onClick={abrirReserva}>
              {selecionada === null ? (
                'Escolha uma poltrona'
              ) : (
                <>
                  Reservar poltrona <span className="tt-mono">{selecionada}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <ReservaFormSheet
        key={sheetKey}
        open={sheetAberto}
        onClose={() => setSheetAberto(false)}
        codigo={excursao.codigo}
        poltrona={selecionada}
        precoCentavos={excursao.preco_centavos}
        sinalCentavos={excursao.sinal_centavos}
        onCriada={(reserva) => navigate(`/r/${reserva.reserva_id}`)}
        onConflitoPoltrona={aoConflitoPoltrona}
      />
    </PublicoLayout>
  );
}
