import { Module } from '@nestjs/common';

/**
 * Módulo `notifications` (mensagens prontas de WhatsApp via deep-link
 * `wa.me` + e-mail via SES). Sem schema próprio no MVP — mensagens são
 * geradas a partir de dados de bookings/billing, nunca persistidas.
 * Bootstrap (item 1.0): só a estrutura existe ainda. Templates chegam em
 * H2.7, seguindo a skill `pix-cobranca`.
 */
@Module({})
export class NotificationsModule {}
