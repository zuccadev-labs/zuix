"use client";
import type { ReactNode } from "react";
import { DataTable, type DataTableColumn, type DataTableProps } from "@zuccadev-labs/zuix-zui";
import { cx } from "../cx";
import type { AdaptiveMap } from "../adaptive";
import type { MeasureMode } from "../adaptive-runtime";
import { AdaptiveSwitch } from "./AdaptiveSwitch";

export interface AdaptiveTableProps<T> extends DataTableProps<T> {
  /**
   * Variante por clase: `table` o `cards`. Por defecto, tarjetas en compacto y tabla desde medio.
   */
  adaptive?: AdaptiveMap;
  /** Título de cada tarjeta. Por defecto, la primera columna. */
  cardTitle?: (row: T, index: number) => ReactNode;
  /** Nivel del encabezado del título de la tarjeta. Por defecto 3. */
  cardHeadingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Nombre accesible de la lista de tarjetas. Por defecto, el `caption` de la tabla. */
  cardsLabel?: string;
  measure?: MeasureMode;
}

const DEFAULT_ADAPTIVE: AdaptiveMap = { compact: { variant: "cards" }, medium: { variant: "table" } };

function cellOf<T>(column: DataTableColumn<T>, row: T, index: number): ReactNode {
  if (column.render) return column.render(row, index);
  const value = column.accessor?.(row);
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

/**
 * Tabla de datos que, en compacto, pasa a una lista de tarjetas: el título de cada fila y sus campos como lista de
 * definiciones. Las mismas filas y columnas en las dos variantes; la tabla es un `DataTable` con todas sus props.
 */
export function AdaptiveTable<T>({
  adaptive = DEFAULT_ADAPTIVE,
  cardTitle,
  cardHeadingLevel = 3,
  cardsLabel,
  measure,
  ...table
}: AdaptiveTableProps<T>) {
  const { rows, columns, rowKey, isRowSelected, caption, className } = table;
  const Heading = `h${cardHeadingLevel}` as "h3";
  const [first, ...rest] = columns;
  const title = (row: T, i: number) => (cardTitle ? cardTitle(row, i) : first ? cellOf(first, row, i) : null);
  const fields = cardTitle ? columns : rest;
  const name = cardsLabel ?? (typeof caption === "string" ? caption : undefined);
  return (
    <AdaptiveSwitch
      className={cx("z-adaptive-table", className)}
      adaptive={adaptive}
      fallback="table"
      measure={measure}
      variants={{
        table: <DataTable<T> {...table} className={undefined} />,
        cards: (
          <ul className="z-adaptive-cards" aria-label={name}>
            {rows.map((row, i) => (
              <li key={rowKey(row, i)} className="z-adaptive-card" data-selected={isRowSelected?.(row) ? "" : undefined}>
                <Heading className="z-adaptive-card__title">{title(row, i)}</Heading>
                <dl className="z-adaptive-card__fields">
                  {fields.map((column) => (
                    <div key={column.key} className="z-adaptive-card__field">
                      <dt>{column.header}</dt>
                      <dd>{cellOf(column, row, i)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        ),
      }}
    />
  );
}
