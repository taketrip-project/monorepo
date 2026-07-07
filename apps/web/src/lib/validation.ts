const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validação client-side básica — só UX; a fonte da verdade é sempre a resposta da API. */
export function isEmailValido(valor: string): boolean {
  return EMAIL_RE.test(valor.trim());
}
