import { Module } from '@nestjs/common';

/**
 * Módulo `billing` (configuração PIX, cobrança, webhook, alertas).
 * TERRITÓRIO EXCLUSIVO DO billing-specialist — nenhum outro agente edita
 * arquivos dentro desta pasta além deste bootstrap inicial (item 1.0),
 * que só cria a estrutura e move o schema (schema.ts). Implementação chega
 * na fase 2, gated pela aprovação do provedor PIX (docs/decisions/005),
 * seguindo `docs/api/billing.yaml`.
 */
@Module({})
export class BillingModule {}
