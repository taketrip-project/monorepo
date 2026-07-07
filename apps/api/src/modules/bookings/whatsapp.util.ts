import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/domain-exception';

/**
 * Normaliza WhatsApp para o formato persistido em `passageiro.whatsapp`
 * (E.164 só dígitos, sem `+`, ex.: `5511999998888` — ver comentário do
 * schema). DECISÃO DO backend-engineer (produto é Brasil-only no MVP,
 * `.claude/skills/dominio-excursoes/SKILL.md`): assume código do país +55
 * quando o cliente manda só DDD + número.
 *
 * Regras (nesta ordem):
 * 1. Remove tudo que não é dígito (aceita `(11) 99999-8888`, `+55 11...`, etc.).
 * 2. Já vem com "55" na frente e o tamanho bate com DDD+fixo (12) ou
 *    DDD+celular (13): mantém como está.
 * 3. Vem sem código do país (DDD+fixo = 10 ou DDD+celular = 11 dígitos):
 *    prefixa "55".
 * 4. Qualquer outro formato: 422 `validacao` — não tentamos adivinhar
 *    números de outros países nesta fase.
 */
export function normalizarWhatsapp(bruto: string): string {
  const digitos = (bruto ?? '').replace(/\D/g, '');

  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) {
    return digitos;
  }

  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }

  throw new DomainException(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'validacao',
    'WhatsApp inválido. Informe DDD + número (ex.: 11999998888).',
    {
      campos: [
        {
          campo: 'whatsapp',
          mensagens: ['Informe um número de WhatsApp válido, com DDD.'],
        },
      ],
    },
  );
}
