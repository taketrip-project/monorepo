export interface EmailMensagem {
  para: string;
  assunto: string;
  corpoTexto: string;
  corpoHtml?: string;
}

/**
 * Abstração de envio de e-mail. Services de outros módulos (identity:
 * convite e redefinição de senha — H1.2/H1.3) dependem desta interface,
 * nunca do SDK da AWS diretamente — troca de provedor fica barata e testes
 * injetam um fake em vez de bater no SES de verdade.
 */
export abstract class EmailService {
  abstract enviar(mensagem: EmailMensagem): Promise<void>;
}
