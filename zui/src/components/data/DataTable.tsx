"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { compare, isDate } from "../../core/compare";
import { bindColumnResize, layoutPinned } from "../../core/datagrid-runtime";
import { clampWidth, filterRows, toCSV } from "../../core/datagrid";
import { download } from "../../core/download";
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
  /** Campo de filtro bajo la cabecera (texto que contiene, sin acentos ni mayúsculas). */
  filterable?: boolean;
  /** Texto con el que se filtra y se exporta. Por defecto, el valor de `accessor`. */
  text?: (row: T) => string;
  /** Asa para cambiar el ancho (puntero o flechas). */
  resizable?: boolean;
  /** Fija la columna al inicio al desplazar en horizontal. */
  pinned?: "start";
  /** Ancho mínimo al redimensionar (px). Por defecto 64. */
  minWidth?: number;
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

  /** Filtros por columna (controlado): `{ clave: texto }`. */
  filters?: Readonly<Record<string, string>>;
  defaultFilters?: Readonly<Record<string, string>>;
  onFiltersChange?: (filters: Record<string, string>) => void;
  /** Nombre de cada campo de filtro. */
  filterLabel?: (column: DataTableColumn<T>) => string;
  /** Anchos en px por clave tras redimensionar. */
  onColumnResize?: (key: string, width: number) => void;
  /** Nombre del asa de redimensionado. */
  resizeLabel?: (column: DataTableColumn<T>) => string;
  /** Botón para descargar las filas filtradas y ordenadas (todas las páginas) en CSV. */
  exportable?: boolean;
  exportLabel?: string;
  /** Nombre del archivo. Por defecto `table.csv`. */
  exportFileName?: string;
}

const headerText = <T,>(column: DataTableColumn<T>) => (typeof column.header === "string" ? column.header : column.key);
/** Texto de una celda para filtrar y exportar. */
export function cellText<T>(column: DataTableColumn<T>, row: T): string {
  if (column.text) return column.text(row);
  const v = column.accessor?.(row);
  if (v === null || v === undefined) return "";
  return isDate(v) ? v.toISOString().slice(0, 10) : String(v);
}

/** Filas como CSV (cabecera con el texto de cada columna). */
export function dataTableCSV<T>(rows: ReadonlyArray<T>, columns: ReadonlyArray<DataTableColumn<T>>): string {
  return toCSV([columns.map(headerText), ...rows.map((row) => columns.map((c) => cellText(c, row)))]);
}

const EMPTY: ReadonlyArray<RowKey> = [];
const NO_FILTERS: Readonly<Record<string, string>> = {};

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
  filters: filtersProp,
  defaultFilters = NO_FILTERS,
  onFiltersChange,
  filterLabel = (column) => `Filter ${headerText(column)}`,
  onColumnResize,
  resizeLabel = (column) => `Resize ${headerText(column)}`,
  exportable,
  exportLabel = "Export CSV",
  exportFileName = "table.csv",
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
  const [filters, setFilters] = useControllable<Readonly<Record<string, string>>>(filtersProp, defaultFilters, onFiltersChange);
  const anchor = useRef<RowKey | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const resizeRef = useRef(onColumnResize);
  resizeRef.current = onColumnResize;
  const resizable = columns.some((c) => c.resizable);
  const pinned = columns.some((c) => c.pinned);
  useEffect(() => {
    const table = tableRef.current;
    if (!table || !(resizable || pinned)) return;
    return bindColumnResize(table, { onResize: (key, width) => resizeRef.current?.(key, width) });
  }, [resizable, pinned]);
  // Tras cada pintado: el desplazamiento de las columnas fijadas depende de los anchos reales.
  useEffect(() => {
    if (pinned && tableRef.current) layoutPinned(tableRef.current);
  });

  const filtered = useMemo(() => {
    const byKey = new Map(columns.map((c) => [c.key, c]));
    return filterRows(rows, filters, (row, key) => {
      const column = byKey.get(key);
      return column ? cellText(column, row) : "";
    });
  }, [rows, columns, filters]);

  const sorted = useMemo(() => {
    const rows = filtered;
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
  }, [filtered, columns, active, manualSort]);

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
  const filterable = columns.some((c) => c.filterable);
  const setFilter = (key: string, value: string) => {
    const next = { ...filters, [key]: value };
    if (!value) delete next[key];
    setFilters(next);
    if (paged) setPage(1);
  };
  const span = columns.length + (selectable ? 1 : 0);
  const table = (
    <Table
      {...tableProps}
      ref={tableRef}
      hoverable={Boolean(onRowClick)}
      data-selectable={selectable || undefined}
      data-resizable={resizable || undefined}
    >
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
                data-key={column.key}
                data-align={column.align}
                data-pinned={column.pinned ? "" : undefined}
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
                {column.resizable ? (
                  <span
                    className="z-table__resize"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={resizeLabel(column)}
                    aria-valuemin={column.minWidth ?? 64}
                    aria-valuemax={1200}
                    aria-valuenow={column.width && /px$/.test(column.width) ? clampWidth(Number.parseFloat(column.width)) : 160}
                    tabIndex={0}
                  />
                ) : null}
              </th>
            );
          })}
        </tr>
        {filterable ? (
          <tr className="z-table__filters">
            {selectable ? <td className="z-table__select" /> : null}
            {columns.map((column) => (
              <th key={column.key} scope="col" data-align={column.align} data-pinned={column.pinned ? "" : undefined}>
                {column.filterable ? (
                  <input
                    type="search"
                    className="z-input__control z-table__filter"
                    aria-label={filterLabel(column)}
                    placeholder={headerText(column)}
                    value={filters[column.key] ?? ""}
                    onChange={(event) => setFilter(column.key, event.target.value)}
                  />
                ) : null}
              </th>
            ))}
          </tr>
        ) : null}
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
                    <td
                      key={column.key}
                      data-align={column.align}
                      data-mono={column.mono || undefined}
                      data-pinned={column.pinned ? "" : undefined}
                    >
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
              <td
                key={column.key}
                data-align={column.align}
                data-mono={column.mono || undefined}
                data-pinned={column.pinned ? "" : undefined}
              >
                {typeof column.footer === "function" ? column.footer(rows) : column.footer}
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </Table>
  );

  if (!selectable && !paged && !exportable) return table;
  return (
    <div className="z-datatable" data-selectable={selectable || undefined} data-paged={paged || undefined}>
      {table}
      <div className="z-datatable__bar">
        {selectable ? (
          <span className="z-datatable__count" role="status" data-empty={selected.length === 0 || undefined}>
            {selected.length ? selectedLabel(selected.length, total) : ""}
          </span>
        ) : null}
        {exportable ? (
          <button
            type="button"
            className="z-btn z-btn--ghost z-datatable__export"
            data-size="sm"
            onClick={() => void download(dataTableCSV(sorted, columns), exportFileName, "text/csv")}
          >
            <Icon name="arrow-down-tray" size={16} />
            {exportLabel}
          </button>
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
