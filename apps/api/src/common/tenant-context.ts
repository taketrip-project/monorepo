import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de tenant por requisição (ADR 003 — isolamento multi-tenant).
 * Populado pelo `JwtAuthGuard` (módulo identity) a partir do JWT já validado
 * — NUNCA a partir de body/query da requisição. Repositórios e services de
 * QUALQUER módulo devem ler o tenant daqui.
 */
export interface TenantContext {
  organizacaoId: string;
  membroId: string;
  /** Id da sessão (refresh token) atual — usado pelo logout para revogar só ela. */
  sessaoId: string;
}

interface Store {
  tenant: TenantContext | null;
}

const storage = new AsyncLocalStorage<Store>();

/**
 * IMPORTANTE (armadilha real, verificada na prática): o escopo do
 * AsyncLocalStorage precisa ser aberto por um `run()` que envolva TODA a
 * cadeia de processamento da requisição — não dá para abrir com
 * `enterWith()` de dentro do guard depois de um `await`. Motivo: quando o
 * guard é chamado, o Nest já criou a Promise de `canActivate()` ANTES de
 * qualquer código do guard rodar; um `enterWith()` executado depois de um
 * `await` dentro do guard só é visto pelo que o PRÓPRIO guard ainda vai
 * fazer — o Node não propaga o contexto retroativamente para a Promise que
 * o chamador (Nest) já estava aguardando, então o controller/service
 * enxergariam `undefined`. Por isso o escopo é aberto por um middleware
 * (`TenantContextMiddleware`, aplicado globalmente antes de qualquer guard)
 * com `run()`, e o guard só MUTA o objeto de store já existente (`set`).
 */
export const TenantContextStorage = {
  /** Chamado pelo `TenantContextMiddleware`, uma vez por requisição. */
  run<T>(fn: () => T): T {
    return storage.run({ tenant: null }, fn);
  },

  /** Chamado pelo `JwtAuthGuard` depois de validar o JWT. */
  set(tenant: TenantContext): void {
    const store = storage.getStore();
    if (!store) {
      throw new Error(
        'TenantContext ausente: TenantContextMiddleware não aplicado nesta requisição (ver ADR 003).',
      );
    }
    store.tenant = tenant;
  },

  /** Lança se chamado fora de uma requisição autenticada — bug de wiring, não caso de negócio. */
  get(): TenantContext {
    const tenant = storage.getStore()?.tenant;
    if (!tenant) {
      throw new Error(
        'TenantContext ausente: código operacional rodando sem tenant autenticado (ver ADR 003).',
      );
    }
    return tenant;
  },

  getOrNull(): TenantContext | null {
    return storage.getStore()?.tenant ?? null;
  },
};
