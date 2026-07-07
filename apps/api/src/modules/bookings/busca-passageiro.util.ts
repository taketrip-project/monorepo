import { sql, type SQL } from 'drizzle-orm';
import { passageiro } from './schema';

/** Escapa curingas de LIKE (`%`, `_`, `\`) para o termo digitado ser tratado como literal. */
function escaparLike(termo: string): string {
  return termo.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Busca de passageiro tolerante a acento/caixa (H1.11): usa a MESMA
 * expressão do índice funcional `passageiro_org_nome_unaccent_idx`
 * (`lower(immutable_unaccent(nome))`, criado na migration — ver
 * `migrations.integration-spec.ts`) nos dois lados da comparação, para que
 * `maria == María == MARIA` e o planner reconheça a expressão do índice.
 * Continua um `LIKE '%...%'` (contém, não só prefixo) porque a meta de
 * performance (≤200ms, H1.11) é folgada demais para o volume real do
 * domínio — uma excursão "cheia" tem ~50 passageiros — para exigir só
 * busca por prefixo.
 */
export function condicaoNomeTolerante(termo: string): SQL {
  const padrao = `%${escaparLike(termo)}%`;
  return sql`lower(immutable_unaccent(${passageiro.nome})) LIKE lower(immutable_unaccent(${padrao})) ESCAPE '\\'`;
}

/** `busca` é só dígitos → também tenta casar por número de poltrona exato (H1.11). */
export function buscaEhNumerica(busca: string): boolean {
  return /^\d+$/.test(busca);
}
