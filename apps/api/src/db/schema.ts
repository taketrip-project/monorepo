/**
 * Barril de schema Drizzle: re-exporta o schema.ts de cada módulo.
 * É o único arquivo que `drizzle-kit` (ver drizzle.config.ts) e o client de
 * banco (db.provider.ts) enxergam — módulos não importam banco entre si,
 * só tipos/tabelas de schema.
 */
export * from '../modules/identity/schema';
export * from '../modules/fleet/schema';
export * from '../modules/excursions/schema';
export * from '../modules/bookings/schema';
export * from '../modules/billing/schema';
