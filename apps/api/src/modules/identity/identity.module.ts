import { Module } from '@nestjs/common';

/**
 * Módulo `identity` (conta, organização/tenant, membros, sessões, convites).
 * Bootstrap (item 1.0): só a estrutura e o schema (schema.ts) existem ainda.
 * Controllers/services chegam nas histórias H1.1–H1.3, seguindo
 * `docs/api/identity.yaml`.
 */
@Module({})
export class IdentityModule {}
