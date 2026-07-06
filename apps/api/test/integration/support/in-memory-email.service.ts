import { Injectable } from '@nestjs/common';
import {
  EmailService,
  type EmailMensagem,
} from '../../../src/modules/notifications/email/email.service';

/**
 * Fake de `EmailService` para testes de integração: captura as mensagens em
 * memória em vez de bater no SES de verdade (backend-engineer.md: "não
 * bloqueie os testes por falta de SES"). Os testes de esqueci-senha/convite
 * precisam do token em claro, que só existe no corpo do e-mail — por isso
 * o fake registra as mensagens completas.
 */
@Injectable()
export class InMemoryEmailService extends EmailService {
  readonly mensagens: EmailMensagem[] = [];

  async enviar(mensagem: EmailMensagem): Promise<void> {
    this.mensagens.push(mensagem);
  }

  extrairToken(mensagemIndex = this.mensagens.length - 1): string {
    const mensagem = this.mensagens[mensagemIndex];
    const match = mensagem.corpoTexto.match(/token=([^\s]+)/);
    if (!match) {
      throw new Error('Nenhum token encontrado no corpo do e-mail capturado.');
    }
    return match[1];
  }

  limpar(): void {
    this.mensagens.length = 0;
  }
}
