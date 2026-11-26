"use client";
import type { Ref } from "react";
import { backToTopWidget, type BackToTopProps as CoreProps } from "../../core/back-to-top";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export interface BackToTopProps extends CoreProps {
  onClick?: () => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Volver arriba: aparece al pasar el umbral de desplazamiento, sube (suave salvo con movimiento reducido) y deja el
 * foco al principio. `sticky` al pie de su contenedor o `fixed` en la esquina de la ventana.
 */
export const BackToTop = withRef(function BackToTop({ onClick, id, className, ref, ...props }: BackToTopProps) {
  return useWidget(backToTopWidget, props, { id, className, ref, handlers: { click: onClick } });
});
