"use client";
import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { trackScrollEdges } from "../../core/edges";

/**
 * Contenedor con desplazamiento horizontal que marca en `data-scroll-edges` el lado con contenido oculto, para que
 * la hoja lo difumine. Vive aparte para que el componente que lo usa (Table) siga siendo de solo marcado.
 */
export function ScrollEdges({ children, ...rest }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? trackScrollEdges(ref.current) : undefined), []);
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
}
