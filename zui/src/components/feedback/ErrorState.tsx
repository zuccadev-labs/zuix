"use client";
import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { Button } from "../actions/Button";

export interface ErrorStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: IconName;
  title?: ReactNode;
  message?: ReactNode;
  /** Muestra el botón de reintento. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Acciones adicionales junto al reintento. */
  actions?: ReactNode;
  /** Ocupa el alto de la ventana y centra el contenido. */
  fullScreen?: boolean;
  headingLevel?: 2 | 3 | 4;
}

/** Estado de error recuperable, con reintento opcional. */
export function ErrorState({
  icon = "exclamation-triangle",
  title = "Something went wrong",
  message = "The content could not be loaded. Try again in a moment.",
  onRetry,
  retryLabel = "Try again",
  actions,
  fullScreen,
  headingLevel = 3,
  className,
  ...rest
}: ErrorStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div {...rest} className={cx("z-empty", "z-empty--error", className)} data-fullscreen={fullScreen || undefined} role="alert">
      <span className="z-empty__icon">
        <Icon name={icon} size={28} />
      </span>
      <Heading className="z-empty__title">{title}</Heading>
      {message ? <p className="z-empty__description">{message}</p> : null}
      {onRetry || actions ? (
        <div className="z-empty__action">
          {onRetry ? (
            <Button variant="primary" icon="arrow-refresh" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
