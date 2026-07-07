/**
 * Camada de acesso ao módulo bookings (docs/api/bookings.yaml): mapa de
 * poltronas, cadastro rápido, busca/edição de reserva, pagamento manual,
 * embarque, lista de embarque e lista imprimível. Cada função é uma chamada
 * fina sobre `apiFetch`/`apiFetchBlob` — nada de cache ou estado aqui, isso
 * é das telas.
 *
 * Poltrona é única por excursão, garantida no banco — um conflito responde
 * 409 `poltrona_ocupada` com `detalhes.poltronas_livres` de sugestão. Status
 * de pagamento nunca regride: transição inválida também responde 409. Quem
 * chama estas funções deve tratar `ApiError` com esses códigos.
 */
import { apiFetch, apiFetchBlob } from './client';

export type StatusReserva = 'ativa' | 'embarcada' | 'expirada' | 'cancelada';
export type StatusPagamento = 'pendente' | 'sinal_pago' | 'pago' | 'cancelado';
export type OrigemReserva = 'organizador' | 'pagina_publica';
export type FormaPagamento = 'dinheiro' | 'pix_manual' | 'pix_plataforma' | 'outro';
/** Estado de exibição de uma poltrona no mapa — combina reserva + pagamento num único valor. */
export type EstadoPoltrona = 'livre' | 'pendente' | 'sinal_pago' | 'pago' | 'embarcada' | 'bloqueada';

export interface Paginacao {
  pagina: number;
  por_pagina: number;
  total: number;
}

export interface Passageiro {
  id: string;
  nome: string;
  whatsapp: string;
  cpf: string | null;
}

export interface Reserva {
  id: string;
  excursao_id: string;
  poltrona: number;
  status: StatusReserva;
  status_pagamento: StatusPagamento;
  origem: OrigemReserva;
  forma_pagamento: FormaPagamento | null;
  valor_centavos: number;
  ponto_embarque_id: string | null;
  expira_em: string | null;
  embarcada_em: string | null;
  passageiro: Passageiro;
  criado_em: string;
}

export interface ReservasPaginadas {
  dados: Reserva[];
  paginacao: Paginacao;
}

export interface Poltrona {
  numero: number;
  estado: EstadoPoltrona;
  reserva_id: string | null;
  passageiro_nome: string | null;
}

export interface MapaPoltronas {
  excursao_id: string;
  layout: { fileiras: (number | null)[][] };
  poltronas: Poltrona[];
  /** SEMPRE calculado (capacidade − reservas ativas). */
  vagas: number;
  capacidade: number;
}

export interface ListaEmbarquePonto {
  id: string;
  local: string;
  horario: string;
  ordem: number;
}

export interface ListaEmbarquePassageiro {
  reserva_id: string;
  nome: string;
  poltrona: number;
  embarcada: boolean;
  embarcada_em: string | null;
}

export interface ListaEmbarqueGrupo {
  ponto_embarque: ListaEmbarquePonto;
  passageiros: ListaEmbarquePassageiro[];
}

export interface ListaEmbarque {
  excursao_id: string;
  embarcados: number;
  total: number;
  grupos: ListaEmbarqueGrupo[];
}

export interface CriarReservaInput {
  poltrona: number;
  nome: string;
  whatsapp: string;
  cpf?: string | null;
  forma_pagamento?: FormaPagamento | null;
  /** Omitido = default do servidor (preço da excursão). */
  valor_centavos?: number | null;
  ponto_embarque_id?: string | null;
}

export interface AtualizarReservaInput {
  poltrona?: number;
  ponto_embarque_id?: string | null;
  valor_centavos?: number;
  forma_pagamento?: FormaPagamento | null;
  nome?: string;
  cpf?: string | null;
}

export interface ListarReservasParams {
  busca?: string;
  statusPagamento?: StatusPagamento;
  pagina?: number;
  porPagina?: number;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== '') query.set(chave, String(valor));
  }
  const texto = query.toString();
  return texto ? `?${texto}` : '';
}

export function obterMapaPoltronas(excursaoId: string): Promise<MapaPoltronas> {
  return apiFetch<MapaPoltronas>(`/excursoes/${excursaoId}/mapa-poltronas`);
}

export function listarReservas(excursaoId: string, params: ListarReservasParams = {}): Promise<ReservasPaginadas> {
  const query = buildQuery({
    busca: params.busca,
    status_pagamento: params.statusPagamento,
    pagina: params.pagina ?? 1,
    por_pagina: params.porPagina ?? 20,
  });
  return apiFetch<ReservasPaginadas>(`/excursoes/${excursaoId}/reservas${query}`);
}

export function criarReserva(excursaoId: string, input: CriarReservaInput): Promise<Reserva> {
  return apiFetch<Reserva>(`/excursoes/${excursaoId}/reservas`, { method: 'POST', body: input });
}

export function obterListaEmbarque(excursaoId: string): Promise<ListaEmbarque> {
  return apiFetch<ListaEmbarque>(`/excursoes/${excursaoId}/lista-embarque`);
}

/** Baixa a lista de passageiros imprimível (fiscalização ANTT) já pronta para impressão/download. */
export function baixarListaImpressao(excursaoId: string, formato: 'pdf' | 'html' = 'pdf'): Promise<Blob> {
  return apiFetchBlob(`/excursoes/${excursaoId}/lista-passageiros/impressao?formato=${formato}`);
}

export function obterReserva(reservaId: string): Promise<Reserva> {
  return apiFetch<Reserva>(`/reservas/${reservaId}`);
}

export function atualizarReserva(reservaId: string, input: AtualizarReservaInput): Promise<Reserva> {
  return apiFetch<Reserva>(`/reservas/${reservaId}`, { method: 'PATCH', body: input });
}

export function atualizarStatusPagamento(
  reservaId: string,
  status: Exclude<StatusPagamento, 'pendente'>,
): Promise<Reserva> {
  return apiFetch<Reserva>(`/reservas/${reservaId}/status-pagamento`, { method: 'POST', body: { status } });
}

export function cancelarReserva(reservaId: string, motivo?: string | null): Promise<Reserva> {
  return apiFetch<Reserva>(`/reservas/${reservaId}/cancelar`, { method: 'POST', body: { motivo: motivo ?? null } });
}

export function marcarEmbarque(reservaId: string): Promise<Reserva> {
  return apiFetch<Reserva>(`/reservas/${reservaId}/embarque`, { method: 'POST' });
}

export function desfazerEmbarque(reservaId: string): Promise<Reserva> {
  return apiFetch<Reserva>(`/reservas/${reservaId}/embarque`, { method: 'DELETE' });
}

/** Lista com 0 ou 1 resultado — WhatsApp é único por organização. Usado para reaproveitar passageiro no cadastro rápido. */
export function buscarPassageiroPorWhatsapp(whatsapp: string): Promise<Passageiro[]> {
  return apiFetch<Passageiro[]>(`/passageiros?whatsapp=${encodeURIComponent(whatsapp)}`);
}
