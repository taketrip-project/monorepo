import { Module } from '@nestjs/common';
import { EmailService } from './email/email.service';
import { SesEmailService } from './email/ses-email.service';

/**
 * Módulo `notifications` (mensagens prontas de WhatsApp via deep-link
 * `wa.me` + e-mail via SES). Sem schema próprio no MVP — mensagens são
 * geradas a partir de dados de outros módulos, nunca persistidas.
 *
 * `EmailService` é usado por identity (convite — H1.3, redefinição de
 * senha — H1.2). Deep-link `wa.me` chega em H2.7, seguindo a skill
 * `pix-cobranca`.
 */
@Module({
  providers: [{ provide: EmailService, useClass: SesEmailService }],
  exports: [EmailService],
})
export class NotificationsModule {}
