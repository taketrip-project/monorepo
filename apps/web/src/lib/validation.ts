const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validação client-side básica — só UX; a fonte da verdade é sempre a resposta da API. */
export function isEmailValido(valor: string): boolean {
  return EMAIL_RE.test(valor.trim());
}

/**
 * Validação client-side básica de WhatsApp — só UX (checa dígitos
 * suficientes para DDD + número). A normalização para E.164 é sempre feita
 * no servidor (docs/api/bookings.yaml).
 */
export function isWhatsappValido(valor: string): boolean {
  const digitos = valor.replace(/\D/g, '');
  return digitos.length >= 10 && digitos.length <= 13;
}
