import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import type { Tone } from "../actions/types";

const TONE_ICON: Record<Tone, IconName> = {
  neutral: "information-circle",
  accent: "information-circle",
  info: "information-circle",
  success: "check-circle",
  warning: "exclamation-triangle",
  danger: "exclamation-circle",
};

export interface CalloutProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  tone?: Tone;
  title?: ReactNode;
  /** Sustituye el icono del tono; `null` lo quita. */
  icon?: IconName | null;
  children?: ReactNode;
}

/** Nota destacada dentro de un contenido (documentación, ayuda). Estática: no anuncia ni se cierra. */
export function Callout({ tone = "neutral", title, icon, className, children, ...rest }: CalloutProps) {
  const name = icon === null ? null : (icon ?? TONE_ICON[tone]);
  return (
    <aside role="note" {...rest} className={cx("z-callout", className)} data-tone={tone}>
      {name ? (
        <span className="z-callout__icon">
          <Icon name={name} size={16} />
        </span>
      ) : null}
      <div className="z-callout__body">
        {title ? <p className="z-callout__title">{title}</p> : null}
        {children}
      </div>
    </aside>
  );
}
