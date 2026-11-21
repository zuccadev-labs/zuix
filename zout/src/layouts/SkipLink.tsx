"use client";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { cx } from "../cx";
import { skipTo } from "../site";

export interface SkipLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /** Id del destino (el `main` o su primer titular), sin `#`. */
  target?: string;
  children?: ReactNode;
}

/**
 * Enlace para saltar los bloques que se repiten (cabecera, navegación) e ir al contenido. Invisible hasta que recibe
 * el foco con Tab; al seguirlo, el foco entra en el destino aunque este no sea enfocable.
 */
export function SkipLink({ target = "main", children = "Skip to content", className, onClick, ...rest }: SkipLinkProps) {
  return (
    <a
      {...rest}
      className={cx("z-skiplink", className)}
      href={`#${target}`}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented && skipTo(event.currentTarget)) event.preventDefault();
      }}
    >
      {children}
    </a>
  );
}
