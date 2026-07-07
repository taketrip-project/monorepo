/**
 * Camada de acesso ao módulo excursions (docs/api/excursions.yaml): ciclo de
 * vida da excursão, pontos de embarque, fotos, checklist legal e o
 * dashboard Início. Cada função é uma chamada fina sobre `apiFetch` — nada
 * de cache ou estado aqui, isso é das telas.
 *
 * `vagas`/`pagos`/`pendentes` vêm SEMPRE calculados pelo servidor (hoje um
 * stub, já que o módulo bookings ainda não existe) — o frontend só exibe.
 */
import { apiFetch } from './client';

export type StatusExcursao = 'rascunho' | 'publicada' | 'lotada' | 'em_andamento' | 'concluida' | 'cancelada';
export type TipoExcursao = 'bate_volta' | 'pernoite';
export type SinalTipo = 'percentual' | 'fixo';
export type FiltroExcursoes = 'proximas' | 'hoje' | 'concluidas' | 'rascunho';

export interface Paginacao {
  pagina: number;
  por_pagina: number;
  total: number;
}

export interface ExcursaoCard {
  id: string;
  status: StatusExcursao;
  destino: string;
  evento_ancora: string | null;
  data_saida: string;
  tipo: TipoExcursao;
  /** capacidade − reservas ativas (calculado no servidor). */
  vagas: number;
  capacidade: number;
  pagos: number;
  pendentes: number;
  foto_capa_url: string | null;
}

export interface ChecklistLegal {
  licenca_antt: boolean;
  seguro_passageiros: boolean;
  lista_impressa: boolean;
}

export interface Viabilidade {
  custo_total_centavos: number;
  ponto_equilibrio_pagos: number;
  pagos_atuais: number;
}

export interface PontoEmbarque {
  id: string;
  local: string;
  horario: string;
  ordem: number;
}

export interface Foto {
  id: string;
  url: string;
  ordem: number;
}

export interface Excursao extends ExcursaoCard {
  data_retorno: string;
  preco_centavos: number;
  sinal_tipo: SinalTipo;
  sinal_valor: number;
  /** Sinal já resolvido em centavos (percentual aplicado com floor). */
  sinal_centavos: number;
  descricao: string | null;
  veiculo_id: string;
  motivo_cancelamento: string | null;
  codigo_publico: string;
  url_publica: string;
  custo_total_centavos: number | null;
  viabilidade: Viabilidade | null;
  checklist_legal: ChecklistLegal;
  fotos: Foto[];
  pontos_embarque: PontoEmbarque[];
  criado_em: string;
}

export interface ExcursoesPaginadas {
  dados: ExcursaoCard[];
  paginacao: Paginacao;
}

export interface ExcursaoEntradaInput {
  destino: string;
  evento_ancora?: string | null;
  data_saida: string;
  data_retorno: string;
  tipo: TipoExcursao;
  veiculo_id: string;
  preco_centavos: number;
  sinal_tipo?: SinalTipo;
  sinal_valor?: number;
  descricao?: string | null;
}

export interface AtualizarExcursaoInput extends ExcursaoEntradaInput {
  /** Viabilidade (H3.4) — informativo, nunca bloqueia. */
  custo_total_centavos?: number | null;
}

export interface PontoEmbarqueEntradaInput {
  local: string;
  horario: string;
}

export interface PendenciaEstorno {
  id: string;
  reserva_id: string;
  valor_centavos: number;
}

export interface CancelarExcursaoResultado {
  excursao: Excursao;
  pendencias_estorno: PendenciaEstorno[];
}

export interface InicioResponse {
  proxima_excursao: ExcursaoCard | null;
}

export function listarExcursoes(
  filtro: FiltroExcursoes = 'proximas',
  pagina = 1,
  porPagina = 20,
): Promise<ExcursoesPaginadas> {
  return apiFetch<ExcursoesPaginadas>(
    `/excursoes?filtro=${filtro}&pagina=${pagina}&por_pagina=${porPagina}`,
  );
}

export function obterExcursao(excursaoId: string): Promise<Excursao> {
  return apiFetch<Excursao>(`/excursoes/${excursaoId}`);
}

export function criarExcursao(input: ExcursaoEntradaInput): Promise<Excursao> {
  return apiFetch<Excursao>('/excursoes', { method: 'POST', body: input });
}

export function atualizarExcursao(excursaoId: string, input: AtualizarExcursaoInput): Promise<Excursao> {
  return apiFetch<Excursao>(`/excursoes/${excursaoId}`, { method: 'PATCH', body: input });
}

export function excluirExcursao(excursaoId: string): Promise<void> {
  return apiFetch<void>(`/excursoes/${excursaoId}`, { method: 'DELETE' });
}

export function publicarExcursao(excursaoId: string): Promise<Excursao> {
  return apiFetch<Excursao>(`/excursoes/${excursaoId}/publicar`, { method: 'POST' });
}

export function cancelarExcursao(excursaoId: string, motivo: string): Promise<CancelarExcursaoResultado> {
  return apiFetch<CancelarExcursaoResultado>(`/excursoes/${excursaoId}/cancelar`, {
    method: 'POST',
    body: { motivo },
  });
}

export function listarPontosEmbarque(excursaoId: string): Promise<PontoEmbarque[]> {
  return apiFetch<PontoEmbarque[]>(`/excursoes/${excursaoId}/pontos-embarque`);
}

export function adicionarPontoEmbarque(
  excursaoId: string,
  input: PontoEmbarqueEntradaInput,
): Promise<PontoEmbarque> {
  return apiFetch<PontoEmbarque>(`/excursoes/${excursaoId}/pontos-embarque`, {
    method: 'POST',
    body: input,
  });
}

export function editarPontoEmbarque(
  excursaoId: string,
  pontoId: string,
  input: PontoEmbarqueEntradaInput,
): Promise<PontoEmbarque> {
  return apiFetch<PontoEmbarque>(`/excursoes/${excursaoId}/pontos-embarque/${pontoId}`, {
    method: 'PATCH',
    body: input,
  });
}

export function removerPontoEmbarque(excursaoId: string, pontoId: string): Promise<void> {
  return apiFetch<void>(`/excursoes/${excursaoId}/pontos-embarque/${pontoId}`, { method: 'DELETE' });
}

export function reordenarPontosEmbarque(excursaoId: string, ordem: string[]): Promise<PontoEmbarque[]> {
  return apiFetch<PontoEmbarque[]>(`/excursoes/${excursaoId}/pontos-embarque`, {
    method: 'PUT',
    body: { ordem },
  });
}

export function enviarFoto(excursaoId: string, arquivo: File): Promise<Foto> {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  return apiFetch<Foto>(`/excursoes/${excursaoId}/fotos`, { method: 'POST', body: formData });
}

export function removerFoto(excursaoId: string, fotoId: string): Promise<void> {
  return apiFetch<void>(`/excursoes/${excursaoId}/fotos/${fotoId}`, { method: 'DELETE' });
}

export function atualizarChecklistLegal(
  excursaoId: string,
  input: Partial<ChecklistLegal>,
): Promise<ChecklistLegal> {
  return apiFetch<ChecklistLegal>(`/excursoes/${excursaoId}/checklist-legal`, {
    method: 'PATCH',
    body: input,
  });
}

export function obterInicio(): Promise<InicioResponse> {
  return apiFetch<InicioResponse>('/inicio');
}
