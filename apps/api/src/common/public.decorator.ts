import { SetMetadata } from '@nestjs/common';

/**
 * Marca uma rota como pública (ADR 003): o `JwtAuthGuard` global não exige
 * JWT nela. Uso restrito às rotas com `security: []` no OpenAPI (registro,
 * login, refresh, esqueci-senha, redefinir-senha, aceitar-convite) e a
 * futuros endpoints públicos explícitos (página da excursão, webhook PIX).
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
