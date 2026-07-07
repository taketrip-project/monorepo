/** Uma poltrona ocupada hoje (reserva `ativa` ou `embarcada`) — o que o mapa precisa saber dela. */
export interface OcupacaoPoltrona {
  reservaId: string;
  status: 'ativa' | 'embarcada';
  statusPagamento: 'pendente' | 'sinal_pago' | 'pago';
  passageiroNome: string;
}

export type EstadoPoltrona = 'livre' | 'pendente' | 'sinal_pago' | 'pago' | 'embarcada' | 'bloqueada';

export interface PoltronaMapa {
  numero: number;
  estado: EstadoPoltrona;
  reserva_id: string | null;
  passageiro_nome: string | null;
}

/**
 * Estado visual de uma poltrona (H1.8, `docs/api/bookings.yaml`). Prioridade:
 * bloqueada (regra do veículo, fleet) vence qualquer ocupação — na prática
 * nunca deveria haver reserva ativa em poltrona bloqueada (o cadastro barra
 * isso, 409 `poltrona_bloqueada`), mas a prioridade aqui é defensiva.
 */
export function montarPoltronaMapa(
  numero: number,
  bloqueada: boolean,
  ocupacao: OcupacaoPoltrona | undefined,
): PoltronaMapa {
  if (bloqueada) {
    return { numero, estado: 'bloqueada', reserva_id: null, passageiro_nome: null };
  }
  if (!ocupacao) {
    return { numero, estado: 'livre', reserva_id: null, passageiro_nome: null };
  }
  const estado: EstadoPoltrona = ocupacao.status === 'embarcada' ? 'embarcada' : ocupacao.statusPagamento;
  return {
    numero,
    estado,
    reserva_id: ocupacao.reservaId,
    passageiro_nome: ocupacao.passageiroNome,
  };
}

/**
 * Sugestão de poltronas livres para a resposta 409 `poltrona_ocupada`
 * (H1.9). Limitada a `limite` itens — não há necessidade de listar todas as
 * dezenas de poltronas livres de um ônibus vazio numa mensagem de erro.
 */
export function poltronasLivres(
  quantidadePoltronas: number,
  poltronasBloqueadas: number[],
  poltronasOcupadas: number[],
  limite = 20,
): number[] {
  const bloqueadas = new Set(poltronasBloqueadas);
  const ocupadas = new Set(poltronasOcupadas);
  const livres: number[] = [];
  for (let p = 1; p <= quantidadePoltronas && livres.length < limite; p++) {
    if (!bloqueadas.has(p) && !ocupadas.has(p)) livres.push(p);
  }
  return livres;
}
