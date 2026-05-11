// Pure helpers for relative-coord arithmetic. Synchronous, no Effect needed
// (§1.5.5 — don't wrap pure transforms in Effect).

export const toAbsolute = (rel: number, dimension: number): number =>
  rel * dimension;

export const toRelative = (abs: number, dimension: number): number =>
  dimension > 0 ? abs / dimension : 0;

export const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
