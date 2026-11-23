import type { HTMLAttributes, ReactNode, Ref } from "react";
import { formatMoney, type MoneyOptions } from "../../core/money";
import { cx } from "../../cx";

export interface PriceTagProps extends HTMLAttributes<HTMLSpanElement> {
  amount: number;
  /** Código ISO 4217. */
  currency: string;
  locale?: string;
  /** Precio anterior, tachado delante del actual. */
  previous?: number;
  /** Unidad tras el precio («/ night», «per month»). */
  unit?: ReactNode;
  /** Prefijo para lectores del precio anterior. Por defecto, "Previous price:". */
  previousLabel?: string;
  /** Prefijo del precio actual cuando hay anterior. Por defecto, "Current price:". */
  currentLabel?: string;
  currencyDisplay?: MoneyOptions["display"];
  /** Sin decimales cuando el importe es entero. */
  trimZeros?: boolean;
  size?: "sm" | "md" | "lg";
  ref?: Ref<HTMLSpanElement>;
}

/** Precio con moneda, precio anterior tachado y unidad. */
export function PriceTag({
  amount,
  currency,
  locale,
  previous,
  unit,
  previousLabel = "Previous price:",
  currentLabel = "Current price:",
  currencyDisplay,
  trimZeros,
  size = "md",
  className,
  ref,
  ...rest
}: PriceTagProps) {
  const o = { currency, locale, display: currencyDisplay, trimZeros };
  const was = previous !== undefined && Number.isFinite(previous) && previous !== amount;
  return (
    <span
      {...rest}
      ref={ref}
      className={cx("z-price", className)}
      data-size={size}
      data-discounted={was && previous > amount ? "" : undefined}
    >
      {was ? (
        <s className="z-price__previous">
          <span className="z-sr-only">{previousLabel} </span>
          {formatMoney(previous, o)}
        </s>
      ) : null}
      <span className="z-price__current">
        {was ? <span className="z-sr-only">{currentLabel} </span> : null}
        {formatMoney(amount, o)}
      </span>
      {unit ? <span className="z-price__unit">{unit}</span> : null}
    </span>
  );
}
