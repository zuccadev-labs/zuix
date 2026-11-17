"use client";
import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { compare, isDate } from "../../core/compare";
import { cx } from "../../cx";
import { Table, type TableProps } from "./Table";

export type SortDirection = "asc" | "desc";
export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  /** Contenido de la celda. Por defecto, el valor de `accessor`. */
  render?: (row: T, index: number) => ReactNode;
  /** Valor para ordenar (y para mostrar si no hay `render`). */
  accessor?: (row: T) => string | number | boolean | Date | null | undefined;
  /** Permite ordenar por la columna; requiere `accessor`. */
  sortable?: boolean;
  align?: "start" | "center" | "end";
  /** Ancho de columna (cualquier longitud CSS). */
  width?: string;
  mono?: boolean;
}

export interface DataTableProps<T>
  extends Pick<
    TableProps,
    "density" | "framed" | "striped" | "stickyHeader" | "fixed" | "caption" | "captionHidden" | "className" | "wrapperClassName"
  > {
  rows: ReadonlyArray<T>;
  columns: ReadonlyArray<DataTableColumn<T>>;
  rowKey: (row: T, index: number) => string | number;
  /** Orden controlado. Sin él, la tabla ordena por su cuenta. */
  sort?: SortState | null;
  defaultSort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  /** Con orden controlado en servidor: no reordena las filas recibidas. */
  manualSort?: boolean;
  onRowClick?: (row: T, index: number) => void;
  /** Marca filas como resaltadas. */
  isRowSelected?: (row: T) => boolean;
  /** Contenido cuando no hay filas. */
  empty?: ReactNode;
  /** Texto para lectores de pantalla en las cabeceras ordenables. */
  sortLabel?: string;
}

/** Tabla de datos genérica sobre el tipo de fila, con columnas ordenables. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  sort,
  defaultSort = null,
  onSortChange,
  manualSort,
  onRowClick,
  isRowSelected,
  empty = "No data",
  sortLabel = "Sort",
  ...tableProps
}: DataTableProps<T>) {
  const [inner, setInner] = useState<SortState | null>(defaultSort);
  const active = sort === undefined ? inner : sort;

  const sorted = useMemo(() => {
    if (!active || manualSort) return rows;
    const column = columns.find((c) => c.key === active.key);
    const accessor = column?.accessor;
    if (!accessor) return rows;
    const factor = active.direction === "asc" ? 1 : -1;
    // Orden estable: el índice original desempata.
    return rows
      .map((row, index) => ({ row, index }))
      .sort((x, y) => {
        const a = accessor(x.row);
        const b = accessor(y.row);
        // Los vacíos quedan al final en ambos sentidos.
        if (a == null || b == null) return compare(a, b) || x.index - y.index;
        return compare(a, b) * factor || x.index - y.index;
      })
      .map((entry) => entry.row);
  }, [rows, columns, active, manualSort]);

  // Ciclo: ascendente, descendente, sin orden.
  const toggleSort = (key: string) => {
    const next: SortState | null =
      active?.key !== key ? { key, direction: "asc" } : active.direction === "asc" ? { key, direction: "desc" } : null;
    setInner(next);
    onSortChange?.(next);
  };
  const onRowKey = (event: KeyboardEvent<HTMLTableRowElement>, row: T, index: number) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick?.(row, index);
    }
  };

  return (
    <Table {...tableProps} hoverable={Boolean(onRowClick)}>
      <thead>
        <tr>
          {columns.map((column) => {
            const direction = active?.key === column.key ? active.direction : undefined;
            const canSort = column.sortable && (column.accessor || manualSort);
            return (
              <th
                key={column.key}
                scope="col"
                data-align={column.align}
                aria-sort={canSort ? (direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none") : undefined}
                style={column.width ? { width: column.width } : undefined}
              >
                {canSort ? (
                  <button
                    type="button"
                    className="z-table__sort"
                    data-active={direction ? true : undefined}
                    onClick={() => toggleSort(column.key)}
                  >
                    <span>{column.header}</span>
                    <span className="z-sr-only">, {sortLabel}</span>
                    <Icon name={direction === "desc" ? "arrow-down" : "arrow-up"} size={12} />
                  </button>
                ) : (
                  column.header
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 ? (
          <tr>
            <td className="z-table__empty" colSpan={columns.length}>
              {empty}
            </td>
          </tr>
        ) : (
          sorted.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              className={cx(onRowClick && "z-table__row--clickable")}
              data-selected={isRowSelected?.(row) || undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              onKeyDown={onRowClick ? (event) => onRowKey(event, row, index) : undefined}
            >
              {columns.map((column) => {
                const value = column.render ? column.render(row, index) : column.accessor?.(row);
                return (
                  <td key={column.key} data-align={column.align} data-mono={column.mono || undefined}>
                    {isDate(value) ? value.toLocaleDateString() : typeof value === "boolean" ? String(value) : (value as ReactNode)}
                  </td>
                );
              })}
            </tr>
          ))
        )}
      </tbody>
    </Table>
  );
}
