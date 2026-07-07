/**
 * Camada de acesso ao módulo fleet (docs/api/fleet.yaml): veículos e layout
 * de poltronas. Cada função é uma chamada fina sobre `apiFetch` — nada de
 * cache ou estado aqui, isso é das telas. `capacidade` sempre vem pronta do
 * servidor (derivada de quantidade_poltronas − poltronas bloqueadas) — nunca
 * recalculada no client.
 */
import { apiFetch } from './client';

export type TipoVeiculo = 'van' | 'micro_onibus' | 'onibus';

export interface Layout {
  /** Matriz de fileiras; `null` é corredor/vazio. */
  fileiras: (number | null)[][];
}

export interface Veiculo {
  id: string;
  apelido: string;
  placa: string;
  tipo: TipoVeiculo;
  quantidade_poltronas: number;
  capacidade: number;
  layout: Layout;
  poltronas_bloqueadas: number[];
  criado_em: string;
}

export interface Paginacao {
  pagina: number;
  por_pagina: number;
  total: number;
}

export interface VeiculosPaginados {
  dados: Veiculo[];
  paginacao: Paginacao;
}

export interface VeiculoEntradaInput {
  apelido: string;
  placa: string;
  tipo: TipoVeiculo;
  quantidade_poltronas: number;
}

export interface AtualizarVeiculoInput extends VeiculoEntradaInput {
  poltronas_bloqueadas?: number[];
  /** Obrigatório `true` quando o veículo está vinculado a excursão publicada. */
  confirmar?: boolean;
}

export function listarVeiculos(pagina = 1, porPagina = 20): Promise<VeiculosPaginados> {
  return apiFetch<VeiculosPaginados>(`/veiculos?pagina=${pagina}&por_pagina=${porPagina}`);
}

export function obterVeiculo(veiculoId: string): Promise<Veiculo> {
  return apiFetch<Veiculo>(`/veiculos/${veiculoId}`);
}

export function criarVeiculo(input: VeiculoEntradaInput): Promise<Veiculo> {
  return apiFetch<Veiculo>('/veiculos', { method: 'POST', body: input });
}

export function atualizarVeiculo(veiculoId: string, input: AtualizarVeiculoInput): Promise<Veiculo> {
  return apiFetch<Veiculo>(`/veiculos/${veiculoId}`, { method: 'PATCH', body: input });
}

export function excluirVeiculo(veiculoId: string, confirmar = false): Promise<void> {
  const query = confirmar ? '?confirmar=true' : '';
  return apiFetch<void>(`/veiculos/${veiculoId}${query}`, { method: 'DELETE' });
}

export function obterLayoutPadrao(tipo: TipoVeiculo, quantidadePoltronas: number): Promise<Layout> {
  return apiFetch<Layout>(`/veiculos/layout-padrao?tipo=${tipo}&quantidade_poltronas=${quantidadePoltronas}`);
}
