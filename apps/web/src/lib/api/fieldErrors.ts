/**
 * Extrai erros por campo do `detalhes` de um ErroValidacao (422). O contrato
 * (docs/api/identity.yaml) só garante "detalhes.campos lista os erros por
 * campo em pt-BR" sem fixar o formato exato — aceitamos tanto um mapa
 * `{ campo: mensagem }` quanto uma lista `[{ campo, mensagem }]`. Se o
 * formato vier diferente do esperado, retorna vazio (quem chama cai no
 * fallback de mensagem genérica) em vez de quebrar a tela.
 */
export function extractFieldErrors(detalhes: unknown): Record<string, string> {
  if (!detalhes || typeof detalhes !== 'object') return {};
  const campos = (detalhes as { campos?: unknown }).campos;
  if (!campos) return {};

  if (Array.isArray(campos)) {
    const out: Record<string, string> = {};
    for (const item of campos) {
      if (item && typeof item === 'object' && 'campo' in item && 'mensagem' in item) {
        const campo = (item as { campo: unknown }).campo;
        const mensagem = (item as { mensagem: unknown }).mensagem;
        if (typeof campo === 'string' && typeof mensagem === 'string') {
          out[campo] = mensagem;
        }
      }
    }
    return out;
  }

  if (typeof campos === 'object') {
    const out: Record<string, string> = {};
    for (const [campo, mensagem] of Object.entries(campos as Record<string, unknown>)) {
      if (typeof mensagem === 'string') out[campo] = mensagem;
    }
    return out;
  }

  return {};
}
