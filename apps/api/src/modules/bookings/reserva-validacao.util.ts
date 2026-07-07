import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/domain-exception';
import type { StatusExcursao } from '../excursions/estado-excursao.util';

/** Formato mínimo exigido do veículo para validar poltrona (evita acoplar ao tipo Drizzle inteiro). */
export interface VeiculoPoltronas {
  quantidadePoltronas: number;
  poltronasBloqueadas: number[];
}

/**
 * Excursão em qualquer um destes estados não aceita NENHUMA reserva nova
 * (H1.9, `docs/api/bookings.yaml`: 409 `excursao_nao_aceita_reserva`).
 * `publicada`, `lotada` e `em_andamento` aceitam — `lotada` só bloqueia via
 * poltrona (a poltrona única garante 409 `poltrona_ocupada` de qualquer
 * forma, já que 0 vagas = toda poltrona válida já ocupada); `em_andamento`
 * não tem regra explícita no backlog para bloquear reserva de última hora,
 * então segue liberado.
 */
const ESTADOS_SEM_RESERVA: readonly StatusExcursao[] = ['rascunho', 'cancelada', 'concluida'];

export function validarExcursaoAceitaReserva(status: StatusExcursao): void {
  if (ESTADOS_SEM_RESERVA.includes(status)) {
    throw new DomainException(
      HttpStatus.CONFLICT,
      'excursao_nao_aceita_reserva',
      `Não é possível reservar poltrona em uma excursão "${status}".`,
    );
  }
}

/** 409 `poltrona_inexistente` | `poltrona_bloqueada` — validado no servidor, nunca confiando no cliente. */
export function validarPoltronaDoVeiculo(poltrona: number, veiculo: VeiculoPoltronas): void {
  if (poltrona < 1 || poltrona > veiculo.quantidadePoltronas) {
    throw new DomainException(
      HttpStatus.CONFLICT,
      'poltrona_inexistente',
      `Esta excursão não tem a poltrona ${poltrona} (o veículo tem ${veiculo.quantidadePoltronas} poltronas).`,
    );
  }
  if (veiculo.poltronasBloqueadas.includes(poltrona)) {
    throw new DomainException(
      HttpStatus.CONFLICT,
      'poltrona_bloqueada',
      `A poltrona ${poltrona} está bloqueada neste veículo.`,
    );
  }
}
