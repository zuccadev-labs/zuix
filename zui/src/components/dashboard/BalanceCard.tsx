import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { moneyFormat } from "../../core/money";
import { cx } from "../../cx";
import { Sparkline } from "../charts/Sparkline";

export interface BalanceAction {
  id: string;
  label: string;
  icon: IconName;
  onClick?: () => void;
  /** Destino: la acción es un enlace. */
  href?: string;
}

export interface BalanceCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Nombre del saldo («Total balance»). */
  label: string;
  value: number;
  currency: string;
  locale?: string;
  /** Variación del periodo, como fracción (0.084 = 8,4 %). */
  delta?: number;
  /** Texto junto a la variación («+$6,540.20 this month»). */
  deltaText?: ReactNode;
  /** Serie del gráfico bajo el saldo. */
  trend?: ReadonlyArray<number | null>;
  /** Cabecera: titular, avatar o selector de moneda. */
  header?: ReactNode;
  /** Acciones rápidas (enviar, pedir, recargar). */
  actions?: readonly BalanceAction[];
  headingLevel?: 2 | 3 | 4;
}

/** Tarjeta de saldo con el degradado de la marca: cifra grande (decimales atenuados), variación, gráfico y acciones. */
export function BalanceCard({
  label,
  value,
  currency,
  locale,
  delta,
  deltaText,
  trend,
  header,
  actions,
  headingLevel = 2,
  className,
  ...rest
}: BalanceCardProps) {
  const H = `h${headingLevel}` as "h2";
  const parts = moneyFormat({ currency, locale }).formatToParts(value);
  const cut = parts.findIndex((p) => p.type === "decimal");
  const whole = (cut < 0 ? parts : parts.slice(0, cut)).map((p) => p.value).join("");
  const fraction =
    cut < 0
      ? ""
      : parts
          .slice(cut)
          .map((p) => p.value)
          .join("");
  const pct =
    delta === undefined
      ? null
      : new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2, signDisplay: "exceptZero" }).format(delta);
  return (
    <article {...rest} className={cx("z-balance-card", className)} aria-label={label}>
      {header ? <div className="z-balance-card__header">{header}</div> : null}
      <H className="z-balance-card__label">{label}</H>
      <data className="z-balance-card__value" value={value}>
        {whole}
        {fraction ? <span className="z-balance-card__fraction">{fraction}</span> : null}
      </data>
      {pct || deltaText ? (
        <p className="z-balance-card__delta">
          {pct ? (
            <span className="z-balance-card__chip">
              <Icon name={delta !== undefined && delta < 0 ? "arrow-down-left" : "arrow-up-right"} size={12} />
              {pct}
            </span>
          ) : null}
          {deltaText}
        </p>
      ) : null}
      {trend?.length ? <Sparkline className="z-balance-card__trend" type="area" values={trend} label={label} locale={locale} /> : null}
      {actions?.length ? (
        <ul className="z-balance-card__actions">
          {actions.map((a) => (
            <li key={a.id}>
              {a.href ? (
                <a className="z-balance-card__action" href={a.href}>
                  <span className="z-balance-card__action-icon" aria-hidden="true">
                    <Icon name={a.icon} size={18} />
                  </span>
                  {a.label}
                </a>
              ) : (
                <button type="button" className="z-balance-card__action" onClick={a.onClick}>
                  <span className="z-balance-card__action-icon" aria-hidden="true">
                    <Icon name={a.icon} size={18} />
                  </span>
                  {a.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
