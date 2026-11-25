import type { ReactNode, Ref, TableHTMLAttributes } from "react";
import { cx } from "../../cx";
import { ScrollEdges } from "./edges.internal";
import { withRef } from "../../react-compat";

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  density?: "compact" | "comfortable";
  /** Marco de tarjeta alrededor de la tabla. */
  framed?: boolean;
  /** Filas alternas con fondo. */
  striped?: boolean;
  /** Resalta la fila bajo el puntero. */
  hoverable?: boolean;
  /** Cabecera fija al desplazar dentro del contenedor. */
  stickyHeader?: boolean;
  /** Reparto fijo de columnas; el texto largo se corta con puntos suspensivos. */
  fixed?: boolean;
  /** Título de la tabla para lectores de pantalla y, si se quiere, visible. */
  caption?: ReactNode;
  captionHidden?: boolean;
  /** Clase del contenedor con desplazamiento. */
  wrapperClassName?: string;
  ref?: Ref<HTMLTableElement>;
}

/** Tabla con estilo. Dentro se usa el marcado nativo: thead, tbody, tr, th y td. */
export const Table = withRef(function Table({
  density = "comfortable",
  framed = true,
  striped,
  hoverable,
  stickyHeader,
  fixed,
  caption,
  captionHidden,
  wrapperClassName,
  className,
  children,
  ...rest
}: TableProps) {
  return (
    // El borde que esconde columnas se difumina (data-scroll-edges): en estrecho, la tabla se ve cortada a propósito.
    <ScrollEdges className={cx("z-table-wrap", wrapperClassName)} data-framed={framed || undefined}>
      <table
        {...rest}
        className={cx("z-table", className)}
        data-density={density}
        data-striped={striped || undefined}
        data-hoverable={hoverable || undefined}
        data-sticky={stickyHeader || undefined}
        data-fixed={fixed || undefined}
      >
        {caption ? <caption className={cx("z-table__caption", captionHidden && "z-sr-only")}>{caption}</caption> : null}
        {children}
      </table>
    </ScrollEdges>
  );
});
