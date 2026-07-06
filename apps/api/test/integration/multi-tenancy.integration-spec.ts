import { sql } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import { createDatabase, type Database } from '../../src/db/db.provider';
import { organizacao, membro } from '../../src/modules/identity/schema';

/**
 * Teste de integração contra Postgres real (ver README, seção "Testes").
 * Cobre o critério transversal de multi-tenancy do backlog (linha 7):
 * toda listagem/busca/escrita da org A retorna/afeta zero registros da org B.
 * Este é o único comportamento de negócio que já existe no bootstrap (a
 * constraint + o padrão de query escopada) — os módulos de domínio ainda
 * não têm services/controllers.
 */
describe('multi-tenancy: isolamento por organizacao_id (banco real)', () => {
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

  beforeEach(async () => {
    // Base de teste isolada: limpa entre execuções para não acumular fixtures.
    await db.execute(sql`TRUNCATE TABLE organizacao CASCADE`);
  });

  it('cria organização e membro, e a migration aplicou o schema corretamente', async () => {
    const [org] = await db
      .insert(organizacao)
      .values({ nome: 'Agência de Teste' })
      .returning();

    expect(org.id).toBeDefined();
    expect(org.prazoExpiracaoReservaHoras).toBe(48);
    expect(org.sinalDefaultPercentual).toBe(50);

    const [membroCriado] = await db
      .insert(membro)
      .values({
        organizacaoId: org.id,
        nome: 'Fulano',
        email: 'fulano@teste.dev',
        senhaHash: 'hash-fake',
      })
      .returning();

    expect(membroCriado.organizacaoId).toBe(org.id);
  });

  it('caminho feliz: listagem da org A não retorna nenhum registro da org B', async () => {
    const [orgA] = await db.insert(organizacao).values({ nome: 'Org A' }).returning();
    const [orgB] = await db.insert(organizacao).values({ nome: 'Org B' }).returning();

    await db.insert(membro).values([
      { organizacaoId: orgA.id, nome: 'Membro A1', email: 'a1@teste.dev', senhaHash: 'x' },
      { organizacaoId: orgA.id, nome: 'Membro A2', email: 'a2@teste.dev', senhaHash: 'x' },
      { organizacaoId: orgB.id, nome: 'Membro B1', email: 'b1@teste.dev', senhaHash: 'x' },
    ]);

    const membrosDaOrgA = await db
      .select()
      .from(membro)
      .where(eq(membro.organizacaoId, orgA.id));

    expect(membrosDaOrgA).toHaveLength(2);
    expect(membrosDaOrgA.every((m) => m.organizacaoId === orgA.id)).toBe(true);
    expect(membrosDaOrgA.some((m) => m.organizacaoId === orgB.id)).toBe(false);
  });

  it('caso de borda: update/delete por id sempre casado com organizacao_id não afeta outro tenant', async () => {
    const [orgA] = await db.insert(organizacao).values({ nome: 'Org A' }).returning();
    const [orgB] = await db.insert(organizacao).values({ nome: 'Org B' }).returning();

    const [membroB] = await db
      .insert(membro)
      .values({ organizacaoId: orgB.id, nome: 'Membro B', email: 'b@teste.dev', senhaHash: 'x' })
      .returning();

    // Tenta "vazar": alguém com contexto da org A tentando mexer no id de um
    // membro que na verdade pertence à org B. A cláusula composta garante 0 linhas afetadas.
    const resultado = await db
      .update(membro)
      .set({ nome: 'Nome Vazado' })
      .where(and(eq(membro.id, membroB.id), eq(membro.organizacaoId, orgA.id)))
      .returning();

    expect(resultado).toHaveLength(0);

    const [membroBIntacto] = await db
      .select()
      .from(membro)
      .where(eq(membro.id, membroB.id));

    expect(membroBIntacto.nome).toBe('Membro B');
  });
});
