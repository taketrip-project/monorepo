import type { veiculo } from './schema';

/**
 * Converte linha Drizzle (camelCase) para o formato do schema OpenAPI
 * (snake_case, `docs/api/fleet.yaml`). `capacidade` é sempre CALCULADA aqui
 * — nunca lida de coluna própria (H1.4: capacidade é derivada).
 */
export function mapVeiculo(row: typeof veiculo.$inferSelect) {
  return {
    id: row.id,
    apelido: row.apelido,
    placa: row.placa,
    tipo: row.tipo,
    quantidade_poltronas: row.quantidadePoltronas,
    capacidade: row.quantidadePoltronas - row.poltronasBloqueadas.length,
    layout: row.layout,
    poltronas_bloqueadas: row.poltronasBloqueadas,
    criado_em: row.criadoEm.toISOString(),
  };
}
