import type { HTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

export interface CardBannerProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Mensaje de la cinta (puede incluir un Countdown). */
  message: ReactNode;
  icon?: IconName;
  /** Color de la cinta: relleno pleno del tono con texto claro. */
  tone?: "accent" | "success" | "info" | "warning" | "danger";
  /** Por dónde asoma la cinta, detrás de la tarjeta. */
  position?: "top" | "bottom";
  /** La tarjeta. */
  children: ReactNode;
}

/** Cinta de color que asoma por detrás de una tarjeta, arriba o abajo, con un mensaje (cuenta atrás, disponibilidad). */
export function CardBanner({ message, icon, tone = "success", position = "bottom", className, children, ...rest }: CardBannerProps) {
  const strip = (
    <div className="z-card-banner__strip">
      {icon ? (
        <span className="z-card-banner__icon" aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
      ) : null}
      <span className="z-card-banner__message">{message}</span>
    </div>
  );
  return (
    <div {...rest} className={cx("z-card-banner", className)} data-position={position} data-tone={tone}>
      {position === "top" ? strip : null}
      <div className="z-card-banner__card">{children}</div>
      {position === "bottom" ? strip : null}
    </div>
  );
}
