import { UnprocessableEntityException, ValidationError } from '@nestjs/common';

/**
 * `exceptionFactory` do `ValidationPipe` global (ver `main.ts`): converte os
 * erros do class-validator para o formato ÚNICO de erro da API
 * (`codigo: 'validacao'`, `detalhes.campos`) em vez do 400 default do Nest.
 */
export function paraErroDeValidacao(erros: ValidationError[]): UnprocessableEntityException {
  return new UnprocessableEntityException({
    erro: {
      codigo: 'validacao',
      mensagem: 'Existem campos inválidos no formulário.',
      detalhes: { campos: formatarCampos(erros) },
    },
  });
}

function formatarCampos(
  erros: ValidationError[],
): Array<{ campo: string; mensagens: string[] }> {
  return erros.map((erro) => ({
    campo: erro.property,
    mensagens: Object.values(erro.constraints ?? {}),
  }));
}
