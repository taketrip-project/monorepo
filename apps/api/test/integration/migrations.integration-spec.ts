import { sql } from 'drizzle-orm';
import { createDatabase, type Database } from '../../src/db/db.provider';

/**
 * Teste de integração contra Postgres real (ver README, seção "Testes").
 *
 * A migration `apps/api/drizzle/0000_complete_whirlwind.sql` inclui trechos
 * manuais que o drizzle-kit não conhece (não aparecem em
 * `drizzle/meta/0000_snapshot.json` nem em nenhum `schema.ts`): a extensão
 * `unaccent`, a função `immutable_unaccent` e o índice funcional
 * `passageiro_org_nome_unaccent_idx`, necessários para a busca de passageiro
 * tolerante a acento/caixa (H1.11, ver docs/backlog.md). Como esses objetos
 * não estão no snapshot, nada detectaria hoje se alguém removesse esse
 * trecho num merge/edit futuro da migration — este teste é a rede de
 * segurança para isso.
 *
 * Assume que as migrations já foram aplicadas na base de teste (mesma
 * premissa do `multi-tenancy.integration-spec.ts` e do pipeline de CI: lint
 * → migrations → testes).
 */
describe('migrations: objetos manuais de busca tolerante a acento (unaccent)', () => {
  let db: Database;
  let pool: { end: () => Promise<void> };

  beforeAll(() => {
    const connectionString = process.env.DATABASE_URL_TEST;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL_TEST não configurada. Copie .env.example para .env e rode `npm run db:migrate` apontando para a base de teste (ver README).',
      );
    }
    const created = createDatabase(connectionString);
    db = created.db;
    pool = created.pool;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('caminho feliz: extensão unaccent, função immutable_unaccent e índice funcional existem depois da migration', async () => {
    const extensao = await db.execute<{ extname: string }>(
      sql`SELECT extname FROM pg_extension WHERE extname = 'unaccent'`,
    );
    expect(extensao.rows).toHaveLength(1);

    const funcao = await db.execute<{ proname: string; provolatile: string }>(
      sql`SELECT proname, provolatile FROM pg_proc WHERE proname = 'immutable_unaccent'`,
    );
    expect(funcao.rows).toHaveLength(1);
    // 'i' = IMMUTABLE — precisa continuar assim para poder ser usada no índice.
    expect(funcao.rows[0].provolatile).toBe('i');

    const indice = await db.execute<{ indexname: string; indexdef: string }>(
      sql`SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'passageiro_org_nome_unaccent_idx' AND tablename = 'passageiro'`,
    );
    expect(indice.rows).toHaveLength(1);
    expect(indice.rows[0].indexdef).toContain('immutable_unaccent');
  });

  it('caso de borda: immutable_unaccent remove acentos e normaliza como o índice espera', async () => {
    const resultado = await db.execute<{ sem_acento: string }>(
      sql`SELECT lower(immutable_unaccent('São João Del Rêi')) AS sem_acento`,
    );

    expect(resultado.rows[0].sem_acento).toBe('sao joao del rei');
  });
});
