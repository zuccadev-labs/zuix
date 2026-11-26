"use client";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import type { Tone } from "../actions/types";
import { Sparkline, type SparklineProps } from "../charts/Sparkline";

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  /** Texto secundario bajo el valor. */
  hint?: ReactNode;
  icon?: IconName;
  /** Variación respecto al periodo anterior (por ejemplo "+12%"). */
  delta?: ReactNode;
  deltaTone?: Tone;
  /** `glass` cristal, `solid` acento pleno, `soft` superficie tenue, `elevated` opaca con elevación por capas. */
  variant?: "glass" | "solid" | "soft" | "elevated";
  /** Color de la ficha del icono. */
  tone?: "accent" | "info" | "success" | "warning" | "danger";
  /** `inline`: icono a la derecha de la etiqueta; `stacked`: el icono en ficha arriba y la etiqueta debajo. */
  layout?: "inline" | "stacked";
  /** Serie del minigráfico (tendencia) bajo el valor. */
  trend?: ReadonlyArray<number | null>;
  /** Forma, color y nombre del minigráfico. Por defecto, área con el color 1 y la etiqueta como nombre. */
  trendProps?: Omit<SparklineProps, "values">;
  /** Convierte la tesela en botón. */
  onClick?: () => void;
  className?: string;
}

/** Tesela de indicador: etiqueta, valor destacado y contexto. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  delta,
  deltaTone = "neutral",
  variant = "glass",
  tone,
  layout = "inline",
  trend,
  trendProps,
  onClick,
  className,
}: StatTileProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cx("z-stat", variant === "glass" && "z-liquid", className)}
      data-variant={variant}
      data-tone={tone}
      data-layout={layout === "stacked" ? layout : undefined}
      data-interactive={onClick ? true : undefined}
    >
      <span className="z-stat__head">
        <span className="z-stat__label">{label}</span>
        {icon ? (
          <span className="z-stat__icon">
            <Icon name={icon} size={14} />
          </span>
        ) : null}
      </span>
      <span className="z-stat__value">{value}</span>
      {trend?.length ? (
        <Sparkline
          type="area"
          label={typeof label === "string" ? label : undefined}
          {...trendProps}
          values={trend}
          className={cx("z-stat__trend", trendProps?.className)}
        />
      ) : null}
      {hint || delta ? (
        <span className="z-stat__foot">
          {delta ? (
            <span className="z-stat__delta" data-tone={deltaTone}>
              {delta}
            </span>
          ) : null}
          {hint ? <span className="z-stat__hint">{hint}</span> : null}
        </span>
      ) : null}
    </Tag>
  );
}
