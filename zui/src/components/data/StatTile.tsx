"use client";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import type { Tone } from "../actions/types";

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  /** Texto secundario bajo el valor. */
  hint?: ReactNode;
  icon?: IconName;
  /** Variación respecto al periodo anterior (por ejemplo "+12%"). */
  delta?: ReactNode;
  deltaTone?: Tone;
  /** `glass` cristal, `solid` acento pleno, `soft` superficie tenue. */
  variant?: "glass" | "solid" | "soft";
  /** Convierte la tesela en botón. */
  onClick?: () => void;
  className?: string;
}

/** Tesela de indicador: etiqueta, valor destacado y contexto. */
export function StatTile({ label, value, hint, icon, delta, deltaTone = "neutral", variant = "glass", onClick, className }: StatTileProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={cx("z-stat", variant === "glass" && "z-liquid", className)} data-variant={variant} data-interactive={onClick ? true : undefined}>
      <span className="z-stat__head">
        <span className="z-stat__label">{label}</span>
        {icon ? (
          <span className="z-stat__icon">
            <Icon name={icon} size={14} />
          </span>
        ) : null}
      </span>
      <span className="z-stat__value">{value}</span>
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
