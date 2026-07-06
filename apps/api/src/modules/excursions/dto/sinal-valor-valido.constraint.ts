import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

interface ComSinal {
  sinal_tipo?: 'percentual' | 'fixo';
}

/**
 * Regra do sinal (H1.5, `docs/api/excursions.yaml`): `sinal_valor` é sempre
 * um inteiro ≥ 0; quando `sinal_tipo` é `percentual` (ou omitido — o default
 * é percentual), também precisa ser ≤ 100. Implementado como validator
 * customizado (em vez de `@ValidateIf` + `@Max`) porque `@ValidateIf` no
 * class-validator desliga TODAS as validações da propriedade quando a
 * condição é falsa — o que também desligaria o `Min(0)` para `sinal_tipo:
 * fixo`, quando na verdade queremos `Min(0)` sempre e `Max(100)` só no caso
 * percentual.
 */
@ValidatorConstraint({ name: 'sinalValorValido', async: false })
export class SinalValorValidoConstraint implements ValidatorConstraintInterface {
  validate(sinalValor: unknown, args: ValidationArguments): boolean {
    if (sinalValor === undefined || sinalValor === null) return true; // @IsOptional cuida do resto.
    if (typeof sinalValor !== 'number' || !Number.isInteger(sinalValor) || sinalValor < 0) {
      return false;
    }
    const tipo = (args.object as ComSinal).sinal_tipo ?? 'percentual';
    if (tipo === 'percentual' && sinalValor > 100) return false;
    return true;
  }

  defaultMessage(): string {
    return 'sinal_valor deve ser um inteiro ≥ 0 (e ≤ 100 quando sinal_tipo for percentual).';
  }
}
