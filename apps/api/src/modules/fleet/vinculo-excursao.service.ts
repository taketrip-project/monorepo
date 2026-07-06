import { Injectable } from '@nestjs/common';

/**
 * Ponto de extensão para as checagens de vínculo entre veículo e
 * excursões/reservas exigidas por H1.4 (`docs/api/fleet.yaml`):
 * - editar/excluir veículo com excursão PUBLICADA vinculada exige
 *   `confirmar: true` (senão 409 `veiculo_em_uso_requer_confirmacao`);
 * - excluir veículo com excursão FUTURA publicada é sempre bloqueado
 *   (409 `veiculo_com_excursao_futura`, não contorna com `confirmar`);
 * - reduzir poltronas ou bloquear poltrona com reserva ATIVA é sempre
 *   bloqueado (409 `poltrona_com_reserva`).
 *
 * Os módulos `excursions` e `bookings` ainda não existem nesta fase do
 * backlog (chegam depois na Fase 1) — por isso esta classe é um STUB que
 * hoje sempre responde "sem vínculo" / "sem reserva", deixando editar e
 * excluir veículo livres. `FleetService` só depende desta interface, nunca
 * de tabelas de excursions/bookings diretamente — quando esses módulos
 * existirem, troque só os corpos dos métodos abaixo (ou o provider
 * registrado em `fleet.module.ts`) para consultar de verdade:
 * - `possuiExcursaoPublicada`/`possuiExcursaoFuturaPublicada`: SELECT em
 *   `excursao` por `veiculo_id` + `organizacao_id`, `status = 'publicada'`
 *   (futura: `data_saida > now()`);
 * - `poltronasComReservaAtiva`: SELECT em `reserva` (join por `excursao`
 *   do veículo) com `status IN ('ativa', 'embarcada')` e `poltrona = ANY(...)`.
 * Nenhuma tabela/dependência fake foi criada — só este ponto de extensão.
 */
@Injectable()
export class VinculoExcursaoService {
  /** Veículo tem alguma excursão publicada vinculada (passada ou futura)? */
  async possuiExcursaoPublicada(_veiculoId: string): Promise<boolean> {
    return false;
  }

  /** Veículo tem excursão FUTURA (`data_saida` no futuro) publicada vinculada? */
  async possuiExcursaoFuturaPublicada(_veiculoId: string): Promise<boolean> {
    return false;
  }

  /**
   * Dentre as poltronas informadas (recém-bloqueadas ou que deixariam de
   * existir por redução de capacidade), quais têm reserva ativa hoje?
   * Retorna a sublista que conflita — vazio quando nenhuma conflita.
   */
  async poltronasComReservaAtiva(_veiculoId: string, _poltronas: number[]): Promise<number[]> {
    return [];
  }
}
