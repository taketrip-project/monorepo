import { loadEnv } from '../src/config/load-env';
import { createDatabase } from '../src/db/db.provider';

loadEnv();
import { organizacao, membro } from '../src/modules/identity/schema';
import { veiculo, type LayoutVeiculo } from '../src/modules/fleet/schema';
import { excursao, pontoEmbarque } from '../src/modules/excursions/schema';

/**
 * Seed mínimo de desenvolvimento: uma organização operacional com veículo e
 * excursão em rascunho, e uma segunda organização vazia — só para permitir
 * conferir manualmente o isolamento multi-tenant (docs/backlog.md, regra
 * transversal) já no bootstrap.
 *
 * NÃO é hash real de senha (argon2id chega com a implementação de H1.1 —
 * autenticação ainda não existe neste bootstrap). O valor abaixo é só um
 * placeholder para satisfazer a coluna NOT NULL.
 */
const SENHA_HASH_PLACEHOLDER = 'seed-placeholder-sem-hash-real-ver-adr-004';

function gerarLayoutMicroOnibus(quantidadePoltronas: number): LayoutVeiculo {
  const fileiras: (number | null)[][] = [];
  let proxima = 1;
  while (proxima <= quantidadePoltronas) {
    fileiras.push([proxima, proxima + 1, null, proxima + 2, proxima + 3]);
    proxima += 4;
  }
  return { fileiras };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não configurada. Copie .env.example para .env.');
  }

  const { db, pool } = createDatabase(connectionString);

  console.log('Semeando dados de desenvolvimento...');

  const [orgDemo] = await db
    .insert(organizacao)
    .values({ nome: 'Excursões Bootstrap' })
    .returning();

  const [orgVazia] = await db
    .insert(organizacao)
    .values({ nome: 'Organização de Teste de Isolamento (vazia)' })
    .returning();

  await db.insert(membro).values({
    organizacaoId: orgDemo.id,
    nome: 'Organizador Demo',
    email: 'organizador@demo.taketrip.dev',
    senhaHash: SENHA_HASH_PLACEHOLDER,
  });

  const quantidadePoltronas = 32;
  const [van] = await db
    .insert(veiculo)
    .values({
      organizacaoId: orgDemo.id,
      apelido: 'Micro-ônibus Azul',
      placa: 'ABC1D23',
      tipo: 'micro_onibus',
      quantidadePoltronas,
      layout: gerarLayoutMicroOnibus(quantidadePoltronas),
      poltronasBloqueadas: [1], // ex.: poltrona do guia
    })
    .returning();

  const dataSaida = new Date();
  dataSaida.setDate(dataSaida.getDate() + 14);
  const dataRetorno = new Date(dataSaida);
  dataRetorno.setDate(dataRetorno.getDate() + 1);

  const [excursaoDemo] = await db
    .insert(excursao)
    .values({
      organizacaoId: orgDemo.id,
      veiculoId: van.id,
      destino: 'Praia do Rosa',
      eventoAncora: null,
      dataSaida,
      dataRetorno,
      tipo: 'pernoite',
      precoCentavos: 18000,
      sinalTipo: 'percentual',
      sinalValor: 50,
      descricao: 'Fim de semana na Praia do Rosa, saída direto da agência.',
      status: 'rascunho',
      codigoPublico: 'praiadorosa14',
    })
    .returning();

  await db.insert(pontoEmbarque).values([
    {
      organizacaoId: orgDemo.id,
      excursaoId: excursaoDemo.id,
      local: 'Terminal Rodoviário Central',
      horario: (() => {
        const h = new Date(dataSaida);
        h.setHours(6, 0, 0, 0);
        return h;
      })(),
      ordem: 1,
    },
    {
      organizacaoId: orgDemo.id,
      excursaoId: excursaoDemo.id,
      local: 'Praça da Matriz',
      horario: (() => {
        const h = new Date(dataSaida);
        h.setHours(6, 20, 0, 0);
        return h;
      })(),
      ordem: 2,
    },
  ]);

  console.log('Seed concluído:');
  console.log(`  organização demo: ${orgDemo.id} (${orgDemo.nome})`);
  console.log(`  organização vazia (isolamento): ${orgVazia.id} (${orgVazia.nome})`);
  console.log(`  veículo: ${van.id}`);
  console.log(`  excursão: ${excursaoDemo.id} (rascunho, código público: praiadorosa14)`);

  await pool.end();
}

main().catch((err) => {
  console.error('Falha ao semear dados:', err);
  process.exit(1);
});
