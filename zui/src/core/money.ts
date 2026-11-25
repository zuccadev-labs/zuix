// Importes de SummaryList, PriceBreakdown y PriceTag: formato de moneda con `Intl.NumberFormat` y sumas exactas. Las
// cuentas se hacen en unidades menores enteras (céntimos, o yenes, que no tienen decimales): 0,1 + 0,2 no da
// 0,30000000000000004 y el total es siempre la suma de las filas que se ven. Sin documento.

import { safeLocale } from "./date";

export interface MoneyOptions {
  /** Código ISO 4217 (`EUR`, `USD`, `JPY`). */
  currency: string;
  locale?: string;
  /** Cómo se escribe la moneda: símbolo (`€`), símbolo corto (`$` en vez de `US$`), código o nombre. */
  display?: "symbol" | "narrowSymbol" | "code" | "name";
  /** `exceptZero`: un descuento sale con su signo menos y un cargo con el más. */
  signDisplay?: "auto" | "always" | "exceptZero" | "never";
  /** Sin decimales cuando el importe es entero (`€120` en vez de `€120.00`). */
  trimZeros?: boolean;
}

const formats = new Map<string, Intl.NumberFormat>();

/** Formateador de moneda cacheado. Una moneda que `Intl` no conoce cae al formato numérico con el código delante. */
export function moneyFormat(o: MoneyOptions, fractionDigits?: number): Intl.NumberFormat {
  const locale = safeLocale(o.locale);
  const key = `${locale ?? ""}|${o.currency}|${o.display ?? ""}|${o.signDisplay ?? ""}|${fractionDigits ?? ""}`;
  let f = formats.get(key);
  if (!f) {
    const digits = fractionDigits === undefined ? {} : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits };
    try {
      f = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: o.currency,
        currencyDisplay: o.display ?? "symbol",
        signDisplay: o.signDisplay ?? "auto",
        ...digits,
      });
    } catch {
      f = new Intl.NumberFormat(locale, { signDisplay: o.signDisplay ?? "auto", ...digits });
    }
    formats.set(key, f);
  }
  return f;
}

/** Decimales de la moneda (2 en EUR y USD, 0 en JPY, 3 en KWD). */
export function currencyDigits(currency: string, locale?: string): number {
  return moneyFormat({ currency, locale }).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Importe → unidades menores enteras. Redondeo a la mitad lejos de cero, como en una factura. */
export function toMinor(amount: number, digits: number): number {
  if (!Number.isFinite(amount)) return 0;
  const factor = 10 ** digits;
  // `toPrecision` quita el ruido binario (1.005 * 100 = 100.49999…) antes de redondear.
  const scaled = Number((Math.abs(amount) * factor).toPrecision(15));
  return Math.sign(amount) * Math.round(scaled) || 0;
}

export const fromMinor = (minor: number, digits: number) => minor / 10 ** digits;

/** Importe con su moneda (`€1,234.50`). Con `trimZeros`, un entero va sin decimales. */
export function formatMoney(amount: number, o: MoneyOptions): string {
  const digits = currencyDigits(o.currency, o.locale);
  const minor = toMinor(amount, digits);
  const whole = minor % 10 ** digits === 0;
  const value = fromMinor(minor, digits);
  const f = o.trimZeros && whole ? moneyFormat(o, 0) : moneyFormat(o);
  // Sin moneda conocida por `Intl` el formateador es numérico: se antepone el código para no perder la unidad.
  const text = f.format(value);
  return f.resolvedOptions().style === "currency" ? text : `${o.currency} ${text}`;
}

export type PriceLineKind = "item" | "discount" | "tax" | "fee" | "credit";

export interface PriceLine {
  id?: string;
  label: string;
  /** Importe en unidades de la moneda. En un descuento o un crédito da igual el signo: siempre resta. */
  amount?: number;
  /** Impuesto como porcentaje (21 = 21 %) de la base: artículos, cargos y descuentos anteriores. Sustituye a `amount`. */
  rate?: number;
  kind?: PriceLineKind;
  /** Texto secundario bajo la etiqueta («3 nights × €120»). */
  hint?: string;
}

export interface ResolvedLine extends PriceLine {
  kind: PriceLineKind;
  /** Importe con signo, en unidades menores. */
  minor: number;
}

export interface PriceSummary {
  lines: ResolvedLine[];
  /** Suma de artículos y cargos (antes de descuentos e impuestos), en unidades menores. */
  subtotal: number;
  discounts: number;
  taxes: number;
  total: number;
  digits: number;
}

const SUBTRACTS = new Set<PriceLineKind>(["discount", "credit"]);

/**
 * Resuelve las filas de un desglose: signo de descuentos y créditos, impuestos por porcentaje sobre la base acumulada
 * hasta esa fila y total. Todo en unidades menores: el total es exactamente la suma de las filas mostradas.
 */
export function summarizePrice(lines: readonly PriceLine[], currency: string, locale?: string): PriceSummary {
  const digits = currencyDigits(currency, locale);
  let base = 0;
  let subtotal = 0;
  let discounts = 0;
  let taxes = 0;
  const out: ResolvedLine[] = [];
  for (const line of lines) {
    const kind: PriceLineKind = line.kind ?? "item";
    let minor: number;
    if (kind === "tax" && line.rate !== undefined && Number.isFinite(line.rate)) {
      minor = Math.round((base * line.rate) / 100);
    } else {
      const raw = toMinor(line.amount ?? 0, digits);
      minor = SUBTRACTS.has(kind) ? -Math.abs(raw) : raw;
    }
    minor ||= 0;
    if (kind === "tax") taxes += minor;
    else if (SUBTRACTS.has(kind)) discounts += minor;
    else subtotal += minor;
    if (kind !== "tax") base += minor;
    out.push({ ...line, kind, minor });
  }
  return { lines: out, subtotal, discounts, taxes, total: subtotal + discounts + taxes, digits };
}
