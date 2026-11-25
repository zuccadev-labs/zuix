import type { ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { deltaOf, type ProgressGoalLabels } from "../../core/dashboard-trees";
import { formatValue, type DeltaLabels, type DeltaPositive } from "../../core/metric";
import { cx } from "../../cx";
import { AnimatedNumber } from "../charts/AnimatedNumber";
import { Sparkline, type SparklineProps } from "../charts/Sparkline";
import { Skeleton } from "../feedback/Skeleton";
import { DeltaBadge } from "./DeltaBadge";
import { ProgressGoal } from "./ProgressGoal";

export interface MetricCardLabels {
  /** Sin datos para el periodo. */
  empty: string;
  /** No se pudo cargar. */
  error: string;
  /** Nombre de la meta bajo el valor. */
  target: string;
  /** Periodo visible junto a la variación: «vs {period}». */
  versus: string;
}

const METRIC_CARD_LABELS: MetricCardLabels = {
  empty: "No data for this period",
  error: "Couldn't load this metric",
  target: "Goal",
  versus: "vs {period}",
};

export interface MetricCardProps {
  label: string;
  /** Valor: un número (pasa por `format`) o un texto ya formateado. */
  value?: number | string | null;
  format?: Intl.NumberFormatOptions;
  /** Un valor numérico cuenta del anterior al nuevo al cambiar (AnimatedNumber); sin cuenta con movimiento reducido. */
  animate?: boolean;
  /** Valor del periodo anterior: calcula la variación. */
  previous?: number;
  /** Variación ya calculada, como fracción (0.124 = 12,4 %). */
  delta?: number;
  /** Lo que es bueno: que suba (por defecto) o que baje. */
  positive?: DeltaPositive;
  /** Periodo de comparación («last month»): se ve como «vs last month» y entra en la frase de la variación. */
  period?: string;
  /** Serie del minigráfico. */
  trend?: ReadonlyArray<number | null>;
  trendType?: SparklineProps["type"];
  /** Color de serie 1–8 del minigráfico. */
  color?: number;
  /** Meta: barra de avance hacia ella bajo el valor. */
  target?: number;
  /** Fracción del periodo transcurrida (0…1) para el ritmo hacia la meta. */
  elapsed?: number;
  /** Nota bajo el valor. */
  hint?: ReactNode;
  icon?: IconName;
  state?: "ready" | "loading" | "empty" | "error";
  /** Destino: la etiqueta es un enlace que cubre la tarjeta. */
  href?: string;
  /** Acciones en la cabecera (un IconButton o un Menu). Van por encima del enlace. */
  actions?: ReactNode;
  /** `glass` cristal (por defecto), `soft` superficie tenue, `solid` acento pleno, `plain` sin marco (dentro de MetricGroup). */
  variant?: "glass" | "soft" | "solid" | "plain";
  size?: "sm" | "md";
  locale?: string;
  labels?: Partial<MetricCardLabels> & { delta?: Partial<DeltaLabels>; goal?: Partial<ProgressGoalLabels> };
  className?: string;
  id?: string;
}

/**
 * Tarjeta de KPI: etiqueta, valor, variación frente al periodo anterior (con su sentido dicho en texto), minigráfico,
 * meta con ritmo, nota y acciones; estados de carga (hueso con `aria-busy`, sin anunciar), vacío y error.
 */
export function MetricCard({
  label,
  value,
  format,
  animate = false,
  previous,
  delta,
  positive = "up",
  period,
  trend,
  trendType = "area",
  color,
  target,
  elapsed,
  hint,
  icon,
  state = "ready",
  href,
  actions,
  variant = "glass",
  size = "md",
  locale,
  labels: labelsProp,
  className,
  id,
}: MetricCardProps) {
  const labels = { ...METRIC_CARD_LABELS, ...labelsProp };
  const d = deltaOf({ value: typeof value === "number" ? value : undefined, previous, delta, positive });
  const shown = formatValue(value, locale, format);
  const ready = state === "ready";
  const name = href ? (
    <a className="z-metric__label z-metric__link" href={href}>
      {label}
    </a>
  ) : (
    <span className="z-metric__label">{label}</span>
  );
  return (
    <article
      id={id}
      className={cx("z-metric", variant === "glass" && "z-liquid", className)}
      aria-label={label}
      aria-busy={state === "loading" || undefined}
      data-variant={variant}
      data-state={state}
      data-size={size === "sm" ? "sm" : undefined}
      data-sentiment={ready && d ? d.sentiment : undefined}
      data-interactive={href ? "" : undefined}
    >
      <header className="z-metric__head">
        {icon ? (
          <span className="z-metric__icon" aria-hidden="true">
            <Icon name={icon} size={16} />
          </span>
        ) : null}
        {name}
        {actions ? <span className="z-metric__actions">{actions}</span> : null}
      </header>
      {state === "loading" ? (
        <div className="z-metric__main" aria-hidden="true">
          <Skeleton className="z-metric__bone" width="52%" height={30} />
          <Skeleton className="z-metric__bone" width="36%" height={14} />
        </div>
      ) : state === "empty" || state === "error" ? (
        <p className="z-metric__message" data-tone={state === "error" ? "danger" : undefined}>
          <Icon name={state === "error" ? "exclamation-triangle" : "chart-bar"} size={14} />
          {state === "error" ? labels.error : labels.empty}
        </p>
      ) : (
        <div className="z-metric__main">
          <data className="z-metric__value" value={typeof value === "number" ? value : undefined}>
            {animate && typeof value === "number" ? <AnimatedNumber value={value} format={format} locale={locale} /> : shown}
          </data>
          {d ? (
            <span className="z-metric__delta">
              <DeltaBadge
                value={typeof value === "number" ? value : undefined}
                previous={previous}
                delta={delta}
                positive={positive}
                period={period}
                locale={locale}
                size={size === "sm" ? "sm" : "md"}
                labels={labelsProp?.delta}
              />
              {period ? (
                <span className="z-metric__period" aria-hidden="true">
                  {labels.versus.replace("{period}", period)}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      )}
      {ready && trend?.length ? (
        <Sparkline
          className="z-metric__trend"
          type={trendType}
          values={trend}
          color={color}
          label={label}
          locale={locale}
          valueFormat={format}
        />
      ) : null}
      {ready && typeof target === "number" && typeof value === "number" ? (
        <ProgressGoal
          className="z-metric__goal"
          size="sm"
          label={labels.target}
          value={value}
          target={target}
          elapsed={elapsed}
          valueFormat={format}
          locale={locale}
          labels={labelsProp?.goal}
        />
      ) : null}
      {hint && ready ? <p className="z-metric__hint">{hint}</p> : null}
      {state === "loading" ? <Skeleton className="z-metric__bone" height={36} variant="rounded" /> : null}
    </article>
  );
}
