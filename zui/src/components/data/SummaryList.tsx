import type { HTMLAttributes, ReactNode, Ref } from "react";
import { formatMoney, summarizePrice, type MoneyOptions, type PriceLine, type PriceLineKind } from "../../core/money";
import { cx } from "../../cx";

export type { PriceLine, PriceLineKind };

export interface SummaryItem {
  label: ReactNode;
  /** Valor alineado al final de la fila (un importe ya formateado, una cantidad, un texto corto). */
  value: ReactNode;
  /** Texto secundario bajo la etiqueta. */
  hint?: ReactNode;
  /** `success` para un descuento, `danger` para un cargo de penalización, `muted` para lo informativo. */
  tone?: "default" | "muted" | "success" | "danger";
  /** Línea encima de la fila (separa un bloque del anterior). */
  separated?: boolean;
  /** Fila de total: más grande, con línea encima. */
  total?: boolean;
  key?: string | number;
}

export interface SummaryListProps extends Omit<HTMLAttributes<HTMLDListElement>, "title"> {
  items: ReadonlyArray<SummaryItem>;
  size?: "sm" | "md";
  ref?: Ref<HTMLDListElement>;
}

/** Lista clave–valor con los valores alineados al final y en cifras tabulares: resumen de un pedido, de un plan o de una reserva. */
export function SummaryList({ items, size = "md", className, ref, ...rest }: SummaryListProps) {
  return (
    <dl {...rest} ref={ref} className={cx("z-summary", className)} data-size={size}>
      {items.map((item, index) => (
        <div
          key={item.key ?? index}
          className="z-summary__row"
          data-tone={item.tone && item.tone !== "default" ? item.tone : undefined}
          data-separated={item.separated || undefined}
          data-total={item.total || undefined}
        >
          <dt className="z-summary__label">
            {item.label}
            {item.hint ? <span className="z-summary__hint">{item.hint}</span> : null}
          </dt>
          <dd className="z-summary__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface PriceBreakdownProps extends Omit<HTMLAttributes<HTMLDListElement>, "title"> {
  /** Filas: artículos, cargos, descuentos y créditos (restan siempre) e impuestos (importe o `rate` en %). */
  lines: ReadonlyArray<PriceLine>;
  /** Código ISO 4217. */
  currency: string;
  locale?: string;
  /** Cómo se escribe la moneda. Por defecto, símbolo. */
  currencyDisplay?: MoneyOptions["display"];
  /** Etiqueta del total. Por defecto, "Total". */
  totalLabel?: ReactNode;
  /** Muestra una fila de subtotal (artículos y cargos) antes de descuentos e impuestos. */
  subtotal?: boolean;
  subtotalLabel?: ReactNode;
  /** Texto bajo el total («Includes all fees»). */
  totalHint?: ReactNode;
  size?: "sm" | "md";
  ref?: Ref<HTMLDListElement>;
}

const TONE: Partial<Record<PriceLineKind, SummaryItem["tone"]>> = { discount: "success", credit: "success" };

/**
 * Desglose de precio: filas con importes alineados, descuentos con signo, impuestos por importe o porcentaje y total
 * destacado. Las sumas se hacen en unidades menores (céntimos): el total coincide siempre con las filas.
 */
export function PriceBreakdown({
  lines,
  currency,
  locale,
  currencyDisplay,
  totalLabel = "Total",
  subtotal: showSubtotal,
  subtotalLabel = "Subtotal",
  totalHint,
  size,
  ...rest
}: PriceBreakdownProps) {
  const summary = summarizePrice(lines, currency, locale);
  const money = (minor: number, sign = false) =>
    formatMoney(minor / 10 ** summary.digits, { currency, locale, display: currencyDisplay, signDisplay: sign ? "exceptZero" : "auto" });
  const items: SummaryItem[] = [];
  let firstAfterItems = true;
  for (const [index, line] of summary.lines.entries()) {
    const after = line.kind === "discount" || line.kind === "credit" || line.kind === "tax";
    if (after && firstAfterItems && showSubtotal) {
      items.push({ key: "subtotal", label: subtotalLabel, value: money(summary.subtotal), separated: true });
    }
    items.push({
      key: line.id ?? index,
      label: line.label,
      hint: line.hint,
      value: money(line.minor, line.kind === "discount" || line.kind === "credit"),
      tone: TONE[line.kind] ?? (line.kind === "tax" ? "muted" : undefined),
      separated: after && firstAfterItems && !showSubtotal,
    });
    if (after) firstAfterItems = false;
  }
  items.push({ key: "total", label: totalLabel, hint: totalHint, value: money(summary.total), total: true });
  return <SummaryList {...rest} size={size} items={items} />;
}
