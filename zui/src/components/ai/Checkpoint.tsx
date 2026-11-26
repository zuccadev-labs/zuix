"use client";
import { useId, type HTMLAttributes } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface CheckpointProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Nombre del punto («Checkpoint», «Before refactor»). */
  label?: string;
  /** Hora ya formateada («10:42»). */
  time?: string;
  /** Instante para `<time datetime>` (ISO). */
  dateTime?: string;
  /** Línea bajo el nombre (qué había en ese punto). */
  description?: string;
  /** Ya restaurado: el botón queda desactivado y lo dice. */
  restored?: boolean;
  /** Restaurar la conversación (y lo que dependa de ella) a este punto. */
  onRestore?: () => void;
  restoreLabel?: string;
  restoredLabel?: string;
  disabled?: boolean;
}

/**
 * Punto de restauración en una conversación: una divisoria con su nombre, hora y el botón de restaurar. El botón
 * se nombra con el punto («Restore, Before refactor»): en una conversación larga hay varios.
 */
export function Checkpoint({
  label = "Checkpoint",
  time,
  dateTime,
  description,
  restored = false,
  onRestore,
  restoreLabel = "Restore",
  restoredLabel = "Restored",
  disabled,
  className,
  ...rest
}: CheckpointProps) {
  const nameId = `${useId().replace(/:/g, "")}-name`;
  return (
    <div {...rest} className={cx("z-checkpoint", className)} role="group" aria-labelledby={nameId} data-restored={restored ? "" : undefined}>
      <span className="z-checkpoint__rule" aria-hidden="true" />
      <span className="z-checkpoint__badge">
        <Icon name="bookmark" size={14} />
        <span className="z-checkpoint__label" id={nameId}>
          {label}
        </span>
        {time ? (
          <time className="z-checkpoint__time" dateTime={dateTime}>
            {time}
          </time>
        ) : null}
      </span>
      {description ? <span className="z-checkpoint__description">{description}</span> : null}
      <button
        type="button"
        className="z-btn z-btn--ghost z-checkpoint__restore"
        data-size="sm"
        aria-describedby={nameId}
        disabled={disabled || restored}
        onClick={onRestore}
      >
        <Icon name={restored ? "check" : "arrow-uturn-up-left"} size={14} />
        {restored ? restoredLabel : restoreLabel}
      </button>
      <span className="z-checkpoint__rule" aria-hidden="true" />
    </div>
  );
}
