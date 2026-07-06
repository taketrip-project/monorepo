-- Executado uma única vez, na primeira subida do volume do container.
-- Cria a base de testes de integração ao lado da base de dev, e habilita
-- a extensão `unaccent` usada pela busca de passageiro tolerante a acento
-- (H1.11 — ver comentário em apps/api/src/modules/bookings/schema.ts).

CREATE DATABASE taketrip_test;

\c taketrip
CREATE EXTENSION IF NOT EXISTS unaccent;

\c taketrip_test
CREATE EXTENSION IF NOT EXISTS unaccent;
