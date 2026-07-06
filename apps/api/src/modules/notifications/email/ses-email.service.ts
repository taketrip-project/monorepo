import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { EmailService, EmailMensagem } from './email.service';

/**
 * Implementação real via Amazon SES.
 *
 * PRECISA em produção: credenciais AWS válidas (variáveis padrão do SDK —
 * `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` ou role da instância/task) e
 * `SES_REMETENTE` verificado no SES (região em `SES_REGION`).
 *
 * Em ambientes sem essas credenciais (dev local, CI, testes), o envio vira
 * apenas um log de aviso — nunca lança erro, para não bloquear cadastro,
 * convite ou redefinição de senha por falta de infra de e-mail (MVP).
 */
@Injectable()
export class SesEmailService extends EmailService {
  private readonly logger = new Logger(SesEmailService.name);
  private readonly client: SESClient;

  constructor(private readonly config: ConfigService) {
    super();
    this.client = new SESClient({
      region: this.config.get<string>('SES_REGION') ?? 'us-east-1',
    });
  }

  async enviar(mensagem: EmailMensagem): Promise<void> {
    const remetente = this.config.get<string>('SES_REMETENTE');
    if (!remetente) {
      this.logger.warn(
        `SES_REMETENTE não configurado — e-mail para ${mensagem.para} NÃO enviado ` +
          `(esperado em dev/CI). Assunto: "${mensagem.assunto}".`,
      );
      return;
    }

    await this.client.send(
      new SendEmailCommand({
        Source: remetente,
        Destination: { ToAddresses: [mensagem.para] },
        Message: {
          Subject: { Data: mensagem.assunto, Charset: 'UTF-8' },
          Body: {
            Text: { Data: mensagem.corpoTexto, Charset: 'UTF-8' },
            ...(mensagem.corpoHtml
              ? { Html: { Data: mensagem.corpoHtml, Charset: 'UTF-8' } }
              : {}),
          },
        },
      }),
    );
  }
}
