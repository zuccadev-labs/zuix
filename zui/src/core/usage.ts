// Uso de una ventana de contexto y su coste: proporción, nivel de aviso (80 % y 95 % por defecto), tokens en forma
// compacta («12.4K») y coste en moneda con los decimales que pide una cifra pequeña. Puro.

export type UsageLevel = "ok" | "warning" | "danger";

export const usageRatio = (used: number, limit: number) =>
  limit > 0 && Number.isFinite(used) ? Math.max(0, Math.min(1, used / limit)) : 0;

export function usageLevel(ratio: number, warnAt = 0.8, dangerAt = 0.95): UsageLevel {
  if (ratio >= dangerAt) return "danger";
  if (ratio >= warnAt) return "warning";
  return "ok";
}

const number = (locale: string | undefined, options: Intl.NumberFormatOptions) => {
  try {
    return new Intl.NumberFormat(locale, options);
  } catch {
    return new Intl.NumberFormat(undefined, options);
  }
};

/** Tokens compactos: 980, 12.4K, 1.2M. */
export const compactTokens = (n: number, locale?: string) =>
  number(locale, { notation: "compact", maximumFractionDigits: n >= 1000 && n < 100_000 ? 1 : 0 }).format(Math.max(0, n || 0));

/** Coste: con dos decimales, o hasta cuatro significativos si es menos de un céntimo. */
export function formatCost(value: number, currency = "USD", locale?: string): string {
  const v = Math.max(0, value || 0);
  const small = v > 0 && v < 0.01;
  return number(locale, small ? { style: "currency", currency, maximumSignificantDigits: 2 } : { style: "currency", currency }).format(v);
}

/** Porcentaje entero de un ratio, con el formato del locale («82 %»). */
export const percentText = (ratio: number, locale?: string) => number(locale, { style: "percent", maximumFractionDigits: 0 }).format(ratio);
