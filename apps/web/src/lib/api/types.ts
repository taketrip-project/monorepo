/**
 * Tipos mínimos do contrato de identity (docs/api/identity.yaml) usados
 * pelo cliente HTTP genérico. Os tipos completos de cada módulo (login,
 * registro, etc.) chegam junto com as telas que os consomem.
 */

export interface ApiTokens {
  access_token: string;
  refresh_token: string;
  expira_em_segundos: number;
}

export interface ApiErro {
  erro: {
    codigo: string;
    mensagem: string;
    detalhes?: unknown;
  };
}
