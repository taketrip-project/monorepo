/**
 * Testes de integração: batem em Postgres real (docker compose).
 * Requerem DATABASE_URL_TEST configurada (ver .env.example) e migrations
 * aplicadas na base de teste antes de rodar (ver README, "Testes").
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/integration/.*\\.integration-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/integration/jest.setup.ts'],
  testTimeout: 20000,
};
