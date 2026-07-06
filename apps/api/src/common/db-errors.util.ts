interface ErroComCodigoPg {
  code?: string;
  constraint?: string;
  cause?: unknown;
}

/**
 * Ajuda a mapear violação de constraint UNIQUE do Postgres (código 23505,
 * via node-postgres) para um erro de negócio (ex.: `convite_ja_existe`) em
 * vez de deixar vazar como 500. Complementa (não substitui) o
 * check-antes-de-inserir feito no service — a constraint é a autoridade
 * final sob concorrência (TOCTOU).
 *
 * O Drizzle envolve o erro original do `pg` em `DrizzleQueryError`, expondo
 * o erro de verdade (com `code`/`constraint`) em `.cause` — por isso
 * checamos os dois níveis.
 */
export function isUniqueViolation(erro: unknown, constraint?: string): boolean {
  for (const candidato of [erro, (erro as ErroComCodigoPg)?.cause]) {
    const e = candidato as ErroComCodigoPg | null | undefined;
    if (e?.code === '23505') {
      return constraint ? e.constraint === constraint : true;
    }
  }
  return false;
}
