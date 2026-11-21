import type { CSSProperties, LiHTMLAttributes, OlHTMLAttributes, ReactNode, Ref } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import type { Tone } from "../actions/types";

export interface TimelineProps extends OlHTMLAttributes<HTMLOListElement> {
  /** `start`: hora y contenido tras la línea. `end`: la línea al final. `alternate`: a uno y otro lado (en estrecho, una columna). */
  align?: "start" | "end" | "alternate";
  /** Trazo de la línea entre puntos. */
  line?: "solid" | "dashed" | "dotted";
  /** Forma del punto por defecto de los elementos. */
  dot?: "circle" | "ring" | "square";
  size?: "sm" | "md";
  /** Entrada escalonada de los elementos (solo sin `prefers-reduced-motion`). */
  animated?: boolean;
  ref?: Ref<HTMLOListElement>;
  children?: ReactNode;
}

/** Lista ordenada de acontecimientos con línea, punto por elemento y hora (`<ol>`). */
export function Timeline({
  align = "start",
  line = "solid",
  dot = "circle",
  size = "md",
  animated,
  className,
  children,
  ...rest
}: TimelineProps) {
  return (
    <ol
      {...rest}
      className={cx("z-timeline-list", className)}
      data-align={align}
      data-line={line}
      data-dot={dot}
      data-size={size}
      data-animated={animated || undefined}
    >
      {children}
    </ol>
  );
}

export interface TimelineItemProps extends Omit<LiHTMLAttributes<HTMLLIElement>, "title"> {
  title: ReactNode;
  /** Instante en ISO (`2026-11-20T10:00`): va en `<time datetime>`. */
  time?: string;
  /** Texto visible de la hora. Por defecto, `time`. */
  timeLabel?: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  tone?: Tone;
  /** Forma del punto de este elemento (por defecto, la de la lista). */
  dot?: "circle" | "ring" | "square";
  /** `done` hecho, `current` en curso (aria-current="step"), `upcoming` pendiente (línea discontinua y atenuado). */
  status?: "done" | "current" | "upcoming";
  /** Orden de entrada en la animación escalonada (por defecto, ninguno). */
  index?: number;
  ref?: Ref<HTMLLIElement>;
  children?: ReactNode;
}

/** Elemento de Timeline: punto (o icono) en la línea, hora, título y descripción. */
export function TimelineItem({
  title,
  time,
  timeLabel,
  description,
  icon,
  tone,
  dot,
  status,
  index,
  className,
  style,
  children,
  ...rest
}: TimelineItemProps) {
  const vars = index !== undefined ? ({ "--z-timeline-i": index, ...style } as CSSProperties) : style;
  return (
    <li
      {...rest}
      className={cx("z-timeline-list__item", className)}
      data-tone={tone}
      data-dot={icon ? "icon" : dot}
      data-status={status}
      aria-current={status === "current" ? "step" : undefined}
      style={vars}
    >
      <span className="z-timeline-list__marker" aria-hidden="true">
        <span className="z-timeline-list__dot">{icon ? <Icon name={icon} size={14} /> : null}</span>
      </span>
      <div className="z-timeline-list__body">
        {time || timeLabel ? (
          time ? (
            <time className="z-timeline-list__time" dateTime={time}>
              {timeLabel ?? time}
            </time>
          ) : (
            <span className="z-timeline-list__time">{timeLabel}</span>
          )
        ) : null}
        <div className="z-timeline-list__title">{title}</div>
        {description ? <div className="z-timeline-list__description">{description}</div> : null}
        {children}
      </div>
    </li>
  );
}
