import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/domain-exception';
import { tipoVeiculoEnum, type LayoutVeiculo } from './schema';

export type TipoVeiculo = (typeof tipoVeiculoEnum.enumValues)[number];

/**
 * Faixas de poltronas por tipo (H1.4, `docs/backlog.md` 1.2):
 * van 15–16 · micro-ônibus 24–33 · ônibus 42–50. Fora da faixa é 422,
 * validado no servidor independente do que o cliente mandar (o DTO só
 * garante o range genérico 15–50 do contrato).
 */
export const FAIXA_POLTRONAS: Record<TipoVeiculo, { min: number; max: number }> = {
  van: { min: 15, max: 16 },
  micro_onibus: { min: 24, max: 33 },
  onibus: { min: 42, max: 50 },
};

/** 422 `validacao` se `quantidade` estiver fora da faixa do `tipo`. */
export function validarFaixaPoltronas(tipo: TipoVeiculo, quantidade: number): void {
  const faixa = FAIXA_POLTRONAS[tipo];
  if (quantidade < faixa.min || quantidade > faixa.max) {
    throw new DomainException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'validacao',
      `Quantidade de poltronas fora da faixa para ${tipo} (${faixa.min}–${faixa.max}).`,
      {
        campos: [
          {
            campo: 'quantidade_poltronas',
            mensagens: [`Deve estar entre ${faixa.min} e ${faixa.max} para o tipo ${tipo}.`],
          },
        ],
      },
    );
  }
}

/** 422 `validacao` se alguma poltrona bloqueada estiver fora de 1..quantidade. */
export function validarPoltronasNoLayout(poltronas: number[], quantidade: number): void {
  const foraDaFaixa = poltronas.filter((p) => p < 1 || p > quantidade);
  if (foraDaFaixa.length > 0) {
    throw new DomainException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'validacao',
      'Poltrona bloqueada fora da faixa do layout do veículo.',
      {
        campos: [
          {
            campo: 'poltronas_bloqueadas',
            mensagens: [`Poltronas fora do layout (1–${quantidade}): ${foraDaFaixa.join(', ')}.`],
          },
        ],
      },
    );
  }
}

interface ConfigFileira {
  porFileira: number;
  esquerda: number;
  direita: number;
}

/** micro-ônibus/ônibus: 2 + corredor + 2 — padrão descrito no comentário de `schema.ts`. */
const CONFIG_ONIBUS: ConfigFileira = { porFileira: 4, esquerda: 2, direita: 2 };

/**
 * van: 1 + corredor + 2 (3 poltronas/fileira). Decisão de produto registrada
 * aqui porque o backlog não especifica o layout exato da van: é a
 * configuração mais comum de van executiva 15/16 lugares no Brasil
 * (ex.: Sprinter/Master com poltronas 1+2), reaproveitando a mesma ideia de
 * "corredor ao meio" do padrão de ônibus.
 */
const CONFIG_VAN: ConfigFileira = { porFileira: 3, esquerda: 1, direita: 2 };

/**
 * Gera o layout padrão a partir de (tipo, quantidade). Função pura e
 * determinística — usada tanto no preview (`GET /veiculos/layout-padrao`,
 * que NUNCA salva nada) quanto no cadastro real (POST/PATCH persistem o
 * resultado). Numeração sequencial por fileira, esquerda→direita, pulando
 * o corredor (`null`). Quando a quantidade não fecha fileiras completas, a
 * fileira final é compacta (banco traseiro sem corredor) — comum em
 * configurações reais de ônibus rodoviário.
 */
export function gerarLayout(tipo: TipoVeiculo, quantidade: number): LayoutVeiculo {
  const config = tipo === 'van' ? CONFIG_VAN : CONFIG_ONIBUS;
  return { fileiras: gerarFileiras(quantidade, config) };
}

function gerarFileiras(quantidade: number, config: ConfigFileira): (number | null)[][] {
  const fileiras: (number | null)[][] = [];
  let numero = 1;
  let restante = quantidade;

  while (restante > 0) {
    const nesta = Math.min(config.porFileira, restante);
    if (nesta === config.porFileira) {
      const ladoEsquerdo = Array.from({ length: config.esquerda }, () => numero++);
      const ladoDireito = Array.from({ length: config.direita }, () => numero++);
      fileiras.push([...ladoEsquerdo, null, ...ladoDireito]);
    } else {
      // Fileira final compacta: sobra menor que uma fileira cheia.
      fileiras.push(Array.from({ length: nesta }, () => numero++));
    }
    restante -= nesta;
  }

  return fileiras;
}
