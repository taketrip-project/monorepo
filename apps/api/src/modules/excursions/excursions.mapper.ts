import type { ArquivoStorageService } from './storage/arquivo-storage.service';
import type { excursao, fotoExcursao, pontoEmbarque } from './schema';
import { resolverSinalCentavos } from './sinal.util';
import type { Viabilidade } from './viabilidade.util';

type ExcursaoRow = typeof excursao.$inferSelect;
type FotoRow = typeof fotoExcursao.$inferSelect;
type PontoRow = typeof pontoEmbarque.$inferSelect;

/** Contadores SEMPRE calculados (nunca lidos de coluna) — ver `contador-reservas.service.ts`. */
export interface ContadoresExcursao {
  capacidade: number;
  vagas: number;
  pagos: number;
  pendentes: number;
}

/** `ExcursaoCard` de `docs/api/excursions.yaml` — usado em listagens e em `/inicio`. */
export function mapExcursaoCard(
  row: ExcursaoRow,
  calc: ContadoresExcursao,
  fotoCapaUrl: string | null,
) {
  return {
    id: row.id,
    status: row.status,
    destino: row.destino,
    evento_ancora: row.eventoAncora,
    data_saida: row.dataSaida.toISOString(),
    tipo: row.tipo,
    vagas: calc.vagas,
    capacidade: calc.capacidade,
    pagos: calc.pagos,
    pendentes: calc.pendentes,
    foto_capa_url: fotoCapaUrl,
  };
}

export function mapPontoEmbarque(row: PontoRow) {
  return {
    id: row.id,
    local: row.local,
    horario: row.horario.toISOString(),
    ordem: row.ordem,
  };
}

/** Fábrica: fecha sobre `storage` para resolver a URL a partir da chave persistida. */
export function mapFotoFactory(storage: ArquivoStorageService) {
  return (row: FotoRow) => ({
    id: row.id,
    url: storage.urlPublica(row.s3Key),
    ordem: row.ordem,
  });
}

export interface DadosExcursaoCompleta {
  urlPublicaBase: string;
  fotos: ReturnType<ReturnType<typeof mapFotoFactory>>[];
  pontosEmbarque: ReturnType<typeof mapPontoEmbarque>[];
  viabilidade: Viabilidade | null;
}

/** `Excursao` de `docs/api/excursions.yaml` — detalhe completo (GET por id, criar, publicar, cancelar...). */
export function mapExcursao(
  row: ExcursaoRow,
  calc: ContadoresExcursao,
  fotoCapaUrl: string | null,
  dados: DadosExcursaoCompleta,
) {
  return {
    ...mapExcursaoCard(row, calc, fotoCapaUrl),
    data_retorno: row.dataRetorno.toISOString(),
    preco_centavos: row.precoCentavos,
    sinal_tipo: row.sinalTipo,
    sinal_valor: row.sinalValor,
    sinal_centavos: resolverSinalCentavos(row.precoCentavos, row.sinalTipo, row.sinalValor),
    descricao: row.descricao,
    veiculo_id: row.veiculoId,
    motivo_cancelamento: row.motivoCancelamento,
    codigo_publico: row.codigoPublico,
    url_publica: `${dados.urlPublicaBase}/${row.codigoPublico}`,
    custo_total_centavos: row.custoTotalCentavos,
    viabilidade: dados.viabilidade,
    checklist_legal: {
      licenca_antt: row.checklistLicencaAntt,
      seguro_passageiros: row.checklistSeguroPassageiros,
      lista_impressa: row.checklistListaImpressa,
    },
    fotos: dados.fotos,
    pontos_embarque: dados.pontosEmbarque,
    criado_em: row.criadoEm.toISOString(),
  };
}
