/**
 * Camada de acesso aos endpoints PÚBLICOS (docs/api/publico.yaml): página da
 * excursão (H3.1) e reserva do passageiro pelo link (H3.2). Todas as chamadas
 * usam `auth: false` — o passageiro é anônimo, não existe JWT nem refresh; o
 * tenant é resolvido no servidor pela chave de capacidade (`codigo` da
 * excursão ou o UUID da reserva, que funciona como token de posse).
 *
 * Rate limit por IP (429 `muitas_tentativas` + Retry-After): leituras 30/min,
 * criação de reserva 5/min, consulta de situação 60/min. Quem chama trata o
 * 429 com mensagem amigável — nunca retry automático agressivo.
 */
import { apiFetch } from './client';

/** Estados REDUZIDOS do mapa público — o passageiro nunca vê pendente/pago nem nomes. */
export type EstadoPoltronaPublica = 'livre' | 'ocupada' | 'bloqueada';
export type TipoPagamentoPublico = 'sinal' | 'integral';

export interface PontoEmbarquePublico {
  local: string;
  horario: string;
  ordem: number;
}

export interface ExcursaoPublica {
  codigo: string;
  destino: string;
  evento_ancora: string | null;
  data_saida: string;
  data_retorno: string;
  tipo: 'bate_volta' | 'pernoite';
  preco_centavos: number;
  /** Valor do sinal já resolvido em centavos (percentual/fixo é conta do servidor). */
  sinal_centavos: number;
  descricao: string | null;
  fotos: string[];
  /** SEMPRE calculado no servidor (capacidade − reservas ativas). */
  vagas: number;
  capacidade: number;
  /** false quando lotada — desabilita a reserva sem o front conhecer o enum de status. */
  aceita_reserva: boolean;
  organizacao_nome: string;
  pontos_embarque: PontoEmbarquePublico[];
}

export interface MapaPoltronasPublico {
  layout: { fileiras: (number | null)[][] };
  poltronas: { numero: number; estado: EstadoPoltronaPublica }[];
}

export interface CobrancaPublica {
  valor_centavos: number;
  tipo: TipoPagamentoPublico;
  copia_e_cola: string;
  qr_code_base64: string;
  expira_em: string;
}

/**
 * Corpo de POST /publico/excursoes/{codigo}/reservas. NÃO existe
 * `valor_centavos` nem `forma_pagamento` aqui (decisão de segurança, ADR
 * 008): o passageiro só escolhe sinal|integral e o servidor calcula o valor.
 * `ponto_embarque_id` existe no DTO do servidor, mas a resposta pública não
 * expõe ids de ponto de embarque — o campo fica de fora do fluxo público.
 */
export interface CriarReservaPublicaInput {
  poltrona: number;
  nome: string;
  whatsapp: string;
  cpf?: string | null;
  tipo_pagamento: TipoPagamentoPublico;
}

export interface ReservaPublicaCriada {
  /** Guarde — é o link de acompanhamento do passageiro (/r/{reserva_id}). */
  reserva_id: string;
  poltrona: number;
  status_pagamento: 'pendente';
  expira_em: string | null;
  /** null enquanto a organização não tem PIX na plataforma (decisão 006). */
  cobranca: CobrancaPublica | null;
  instrucoes: string;
}

export interface SituacaoReservaPublica {
  reserva_id: string;
  poltrona: number;
  status: 'ativa' | 'embarcada' | 'expirada' | 'cancelada';
  status_pagamento: 'pendente' | 'sinal_pago' | 'pago' | 'cancelado';
  destino: string;
  data_saida: string;
  expira_em: string | null;
  cobranca: CobrancaPublica | null;
  instrucoes: string | null;
}

export function obterExcursaoPublica(codigo: string): Promise<ExcursaoPublica> {
  return apiFetch<ExcursaoPublica>(`/publico/excursoes/${encodeURIComponent(codigo)}`, { auth: false });
}

export function obterMapaPoltronasPublico(codigo: string): Promise<MapaPoltronasPublico> {
  return apiFetch<MapaPoltronasPublico>(`/publico/excursoes/${encodeURIComponent(codigo)}/mapa-poltronas`, {
    auth: false,
  });
}

export function criarReservaPublica(codigo: string, input: CriarReservaPublicaInput): Promise<ReservaPublicaCriada> {
  return apiFetch<ReservaPublicaCriada>(`/publico/excursoes/${encodeURIComponent(codigo)}/reservas`, {
    method: 'POST',
    body: input,
    auth: false,
  });
}

export function obterSituacaoReservaPublica(reservaId: string): Promise<SituacaoReservaPublica> {
  return apiFetch<SituacaoReservaPublica>(`/publico/reservas/${encodeURIComponent(reservaId)}`, { auth: false });
}
