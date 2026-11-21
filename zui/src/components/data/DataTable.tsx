"use client";
import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { compare, isDate } from "../../core/compare";
import { headerState, pageCountOf, pageSlice, rangeKeys, toggleAll, toggleKey, type RowKey } from "../../core/selection";
import { cx } from "../../cx";
import { useControllable } from "../../primitives/hooks";
import { Checkbox } from "../forms/Checkbox";
import { Pagination } from "../navigation/Pagination";
import { Table, type TableProps } from "./Table";

export type SortDirection = "asc" | "desc";
export interface SortState {
  key: string;
  direction: SortDirection;
}
export type { RowKey };

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
  /** Celda del pie (`tfoot`): contenido fijo o calculado sobre todas las filas (no solo la página). */
  footer?: ReactNode | ((rows: ReadonlyArray<T>) => ReactNode);
}

export interface DataTableProps<T>
  extends Pick<
    TableProps,
    "density" | "framed" | "striped" | "stickyHeader" | "fixed" | "caption" | "captionHidden" | "className" | "wrapperClassName"
  > {
  rows: ReadonlyArray<T>;
  columns: ReadonlyArray<DataTableColumn<T>>;
  rowKey: (row: T, index: number) => RowKey;
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

  /** Columna de casillas: selección múltiple de filas, «seleccionar todo» (de la página) y Mayús para un rango. */
  selectable?: boolean;
  /** Claves seleccionadas (controlado). */
  selectedKeys?: ReadonlyArray<RowKey>;
  defaultSelectedKeys?: ReadonlyArray<RowKey>;
  onSelectionChange?: (keys: RowKey[]) => void;
  /** Filas que no se pueden seleccionar (casilla deshabilitada). */
  isRowSelectable?: (row: T) => boolean;
  /** Nombre de la casilla de cabecera. */
  selectAllLabel?: string;
  /** Nombre de la casilla de cada fila. */
  selectRowLabel?: (row: T, index: number) => string;
  /** Texto (visible y anunciado) del número de filas seleccionadas. */
  selectedLabel?: (count: number, total: number) => string;

  /** Filas por página. Sin él, no se pagina. */
  pageSize?: number;
  /** Página actual, desde 1 (controlado). */
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  /** Paginación en servidor: `rows` ya es la página y `rowCount` el total. */
  manualPagination?: boolean;
  rowCount?: number;
  /** Texto del rango visible: «1–10 of 42». */
  rangeLabel?: (from: number, to: number, total: number) => string;
  paginationLabel?: string;
}

const EMPTY: ReadonlyArray<RowKey> = [];

/** Tabla de datos genérica sobre el tipo de fila, con columnas ordenables, selección de filas, pie y paginación. */
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
  selectable,
  selectedKeys,
  defaultSelectedKeys = EMPTY,
  onSelectionChange,
  isRowSelectable,
  selectAllLabel = "Select all rows",
  selectRowLabel = (_row, index) => `Select row ${index + 1}`,
  selectedLabel = (count) => `${count} selected`,
  pageSize,
  page: pageProp,
  defaultPage = 1,
  onPageChange,
  manualPagination,
  rowCount,
  rangeLabel = (from, to, total) => `${from}–${to} of ${total}`,
  paginationLabel = "Pagination",
  ...tableProps
}: DataTableProps<T>) {
  const [inner, setInner] = useState<SortState | null>(defaultSort);
  const active = sort === undefined ? inner : sort;
  const [selected, setSelected] = useControllable<ReadonlyArray<RowKey>>(
    selectedKeys,
    defaultSelectedKeys,
    onSelectionChange as ((keys: ReadonlyArray<RowKey>) => void) | undefined,
  );
  const [page, setPage] = useControllable<number>(pageProp, defaultPage, onPageChange);
  const anchor = useRef<RowKey | null>(null);

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

  // Paginación: en el cliente, una porción de las filas ordenadas; en servidor, las filas recibidas.
  const paged = pageSize !== undefined && pageSize > 0;
  const total = manualPagination ? (rowCount ?? rows.length) : sorted.length;
  const pageCount = paged ? pageCountOf(total, pageSize) : 1;
  const current = Math.min(Math.max(1, Math.round(page) || 1), pageCount);
  const slice = paged ? pageSlice(total, current, pageSize) : { start: 0, end: sorted.length, from: 1, to: sorted.length };
  const offset = paged ? slice.start : 0;
  const visible = paged && !manualPagination ? sorted.slice(slice.start, slice.end) : sorted;

  const keyOf = (row: T) => rowKey(row, rows.indexOf(row));
  const order = sorted.map(keyOf);
  const canSelect = (row: T) => !isRowSelectable || isRowSelectable(row);
  const visibleKeys = visible.filter(canSelect).map(keyOf);
  const selectableKey = (key: RowKey) => {
    const row = sorted[order.indexOf(key)];
    return row !== undefined && canSelect(row);
  };
  const all = headerState(visibleKeys, selected);

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
  const onSelectRow = (event: MouseEvent<HTMLButtonElement>, key: RowKey) => {
    event.preventDefault();
    event.stopPropagation();
    const next = event.shiftKey ? rangeKeys(selected, order, anchor.current, key, selectableKey) : toggleKey(selected, key, order);
    anchor.current = key;
    setSelected(next);
  };
  const onSelectAll = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setSelected(toggleAll(selected, visibleKeys, order));
  };

  const footer = columns.some((c) => c.footer !== undefined);
  const span = columns.length + (selectable ? 1 : 0);
  const table = (
    <Table {...tableProps} hoverable={Boolean(onRowClick)} data-selectable={selectable || undefined}>
      <thead>
        <tr>
          {selectable ? (
            <th scope="col" className="z-table__select">
              <Checkbox
                aria-label={selectAllLabel}
                data-select-all=""
                checked={all === "indeterminate" ? "indeterminate" : all === "checked"}
                disabled={visibleKeys.length === 0}
                onClick={onSelectAll}
              />
            </th>
          ) : null}
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
        {visible.length === 0 ? (
          <tr>
            <td className="z-table__empty" colSpan={span}>
              {empty}
            </td>
          </tr>
        ) : (
          visible.map((row, i) => {
            const index = offset + i;
            const key = keyOf(row);
            const checked = selectable && selected.includes(key);
            return (
              <tr
                key={key}
                className={cx(onRowClick && "z-table__row--clickable")}
                data-key={selectable ? key : undefined}
                data-selected={checked || isRowSelected?.(row) || undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                onKeyDown={onRowClick ? (event) => onRowKey(event, row, index) : undefined}
              >
                {selectable ? (
                  <td className="z-table__select">
                    <Checkbox
                      aria-label={selectRowLabel(row, index)}
                      checked={Boolean(checked)}
                      disabled={!canSelect(row)}
                      onClick={(event) => onSelectRow(event, key)}
                    />
                  </td>
                ) : null}
                {columns.map((column) => {
                  const value = column.render ? column.render(row, index) : column.accessor?.(row);
                  return (
                    <td key={column.key} data-align={column.align} data-mono={column.mono || undefined}>
                      {isDate(value) ? value.toLocaleDateString() : typeof value === "boolean" ? String(value) : (value as ReactNode)}
                    </td>
                  );
                })}
              </tr>
            );
          })
        )}
      </tbody>
      {footer ? (
        <tfoot>
          <tr>
            {selectable ? <td className="z-table__select" /> : null}
            {columns.map((column) => (
              <td key={column.key} data-align={column.align} data-mono={column.mono || undefined}>
                {typeof column.footer === "function" ? column.footer(rows) : column.footer}
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </Table>
  );

  if (!selectable && !paged) return table;
  return (
    <div className="z-datatable" data-selectable={selectable || undefined} data-paged={paged || undefined}>
      {table}
      <div className="z-datatable__bar">
        {selectable ? (
          <span className="z-datatable__count" role="status" data-empty={selected.length === 0 || undefined}>
            {selected.length ? selectedLabel(selected.length, total) : ""}
          </span>
        ) : null}
        {paged ? (
          <>
            <span className="z-datatable__range">{total ? rangeLabel(slice.from, slice.to, total) : rangeLabel(0, 0, 0)}</span>
            <Pagination size="sm" page={current} pageCount={pageCount} onPageChange={setPage} label={paginationLabel} />
          </>
        ) : null}
      </div>
    </div>
  );
}
