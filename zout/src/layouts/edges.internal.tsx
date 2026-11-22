"use client";
import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { trackScrollEdges } from "../edges";

/**
 * Lista con desplazamiento horizontal que marca en `data-scroll-edges` el lado con elementos ocultos, para que la
 * hoja lo difumine. Aparte para que el layout que la usa (SettingsLayout) siga siendo de solo marcado.
 */
export function ScrollEdgesList({ children, ...rest }: HTMLAttributes<HTMLUListElement> & { children?: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => (ref.current ? trackScrollEdges(ref.current) : undefined), []);
  return (
    <ul ref={ref} {...rest}>
      {children}
    </ul>
  );
}
