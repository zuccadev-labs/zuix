"use client";
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { announce } from "../../core/announcer";
import { compare, isDate } from "../../core/compare";
import { bindGrid, type GridHandle } from "../../core/datagrid-grid";
import {
  CELL_MESSAGES,
  aggregate,
  flattenGrid,
  formatDateCell,
  formatNumberCell,
  keyRange,
  moveColumn,
  orderColumns,
  pinOrder,
  validateCell,
  type AggregateKind,
  type CellMessages,
  type GridRow,
} from "../../core/datagrid-model";
import { bindColumnReorder, type ReorderLabels } from "../../core/datagrid-reorder";
import { applyPinned, bindColumnResize } from "../../core/datagrid-runtime";
import { clampWidth, filterRows, toCSV } from "../../core/datagrid";
import { download } from "../../core/download";
import { headerState, pageCountOf, pageSlice, rangeKeys, toggleAll, toggleKey, type RowKey } from "../../core/selection";
import { wantsVirtual } from "../../core/virtual";
import { cx } from "../../cx";
import { useControllable, useIsoLayoutEffect, useLatest } from "../../primitives/hooks";
import { useVirtual } from "../../primitives/virtual";
import { Checkbox } from "../forms/Checkbox";
import { Pagination } from "../navigation/Pagination";
import { Table, type TableProps } from "./Table";

export type { AggregateKind, CellMessages, ReorderLabels };

/**
 * Respuesta de `onCellEdit` y `onRowEdit`: nada (o `undefined`) acepta; un texto lo rechaza con ese mensaje; una
 * promesa espera (el campo lleva aria-busy) y hace lo mismo con lo que resuelva.
 */
// biome-ignore lint/suspicious/noConfusingVoidType: un manejador sin `return` (lo normal) tiene que valer.
export type EditResult = string | undefined | void | Promise<string | undefined | void>;

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
  /** Fija la columna al inicio o al final al desplazar en horizontal. */
  pinned?: "start" | "end";
  /** Ancho mínimo al redimensionar (px). Por defecto 64. */
  minWidth?: number;
  /** Edición en línea (por celda o por fila, según `editMode`): `true` o por fila. */
  editable?: boolean | ((row: T) => boolean);
  /** Campo del editor. Por defecto `text`. */
  editor?: "text" | "number" | "date" | "select";
  /** Opciones del editor `select`. */
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Valor inicial del editor. Por defecto, el texto de la celda (`text` o `accessor`). */
  editValue?: (row: T) => string;
  /** Reglas del editor: obligatorio, mínimo y máximo (números y fechas `YYYY-MM-DD`) y patrón. */
  required?: boolean;
  min?: number | string;
  max?: number | string;
  pattern?: string;
  /** Validación propia: un mensaje si el valor no vale. */
  validate?: (value: string, row: T) => string | null | undefined;
  /** Agregado en las filas de grupo y en el pie (si no hay `footer`). Una función devuelve lo que se pinta. */
  aggregate?: AggregateKind | ((rows: ReadonlyArray<T>) => ReactNode);
  /** Formato de un agregado numérico. Por defecto, número del idioma de la tabla. */
  formatAggregate?: (value: number) => ReactNode;
  /** Se puede mover (con `reorderable` en la tabla). Por defecto sí. */
  reorderable?: boolean;
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

  /** Idioma de la tabla: fechas y agregados se formatean con él, no con el del entorno. */
  locale?: string;
  /** Formato de las celdas `Date`. Por defecto `{ dateStyle: "medium" }`. */
  dateFormat?: Intl.DateTimeFormatOptions;

  /**
   * Navegación de rejilla (patrón APG «data grid»): una sola parada de Tab en el cuerpo y flechas entre celdas. Se activa
   * sola con columnas editables, agrupación o datos en árbol.
   */
  grid?: boolean;
  /** Edición por celda (por defecto) o por fila entera. */
  editMode?: "cell" | "row";
  /**
   * Una celda editada y válida. Devuelve un mensaje (o una promesa con él) para rechazarla: el editor sigue abierto con
   * el error. La tabla no cambia `rows`: hazlo en la aplicación.
   */
  onCellEdit?: (detail: { row: T; rowKey: RowKey; key: string; value: string }) => EditResult;
  /** Una fila editada (editMode="row") con todos sus campos válidos. Igual que `onCellEdit` para rechazarla. */
  onRowEdit?: (detail: { row: T; rowKey: RowKey; values: Record<string, string> }) => EditResult;
  /** Mensajes de la validación (obligatorio, número, mínimo, máximo, patrón, opción). */
  validationMessages?: Partial<CellMessages>;
  /** Nombre accesible del campo de edición: «Edit {column}». */
  editLabel?: (column: DataTableColumn<T>) => string;

  /** Agrupar por estas columnas (de fuera a dentro), con una fila de cabecera por grupo que se pliega. */
  groupBy?: string | ReadonlyArray<string>;
  /** Grupos plegados (claves de grupo). Por defecto, todos abiertos. */
  collapsedGroups?: ReadonlyArray<string>;
  defaultCollapsedGroups?: ReadonlyArray<string>;
  onCollapsedGroupsChange?: (keys: string[]) => void;
  /** Texto de la cabecera de grupo. Por defecto «{columna}: {valor} ({n})». */
  groupLabel?: (column: DataTableColumn<T>, value: unknown, count: number) => ReactNode;

  /** Datos en árbol: hijos de una fila. La primera columna lleva la sangría y el botón de abrir. */
  getRowChildren?: (row: T) => ReadonlyArray<T> | undefined;
  /** Filas del árbol abiertas (controlado). */
  expandedRows?: ReadonlyArray<RowKey>;
  defaultExpandedRows?: ReadonlyArray<RowKey>;
  onExpandedRowsChange?: (keys: RowKey[]) => void;

  /** Fila de detalle desplegable bajo cada fila (un botón al inicio la abre). */
  renderDetail?: (row: T) => ReactNode;
  /** Filas con el detalle abierto (controlado). */
  expandedDetails?: ReadonlyArray<RowKey>;
  defaultExpandedDetails?: ReadonlyArray<RowKey>;
  onExpandedDetailsChange?: (keys: RowKey[]) => void;
  /** Nombre del botón de detalle. */
  detailLabel?: (row: T, index: number) => string;
  /** Nombre del botón de abrir una rama o un grupo. */
  expandLabel?: string;

  /** Reordenar columnas con el puntero o el teclado (asa en cada cabecera). */
  reorderable?: boolean;
  /** Orden de las columnas por clave (controlado). */
  columnOrder?: ReadonlyArray<string>;
  defaultColumnOrder?: ReadonlyArray<string>;
  onColumnOrderChange?: (keys: string[]) => void;
  /** Nombre del asa: «Move {column}». */
  moveColumnLabel?: (column: DataTableColumn<T>) => string;
  /** Anuncios del reordenado. */
  reorderLabels?: Partial<ReorderLabels>;

  /**
   * Ventana virtual: solo se pintan las filas que se ven (la tabla desplaza dentro de `--z-datatable-height`, 560 px,
   * con la cabecera fija). `true` siempre, `false` nunca, un número es el umbral; por defecto, a partir de 200 filas.
   * Ctrl+F del navegador solo encuentra lo pintado: usa los filtros por columna.
   */
  virtualize?: boolean | number;
  /** Alto estimado de una fila en px (la medida real lo corrige). */
  rowHeight?: number;
}

const headerText = <T,>(column: DataTableColumn<T>) => (typeof column.header === "string" ? column.header : column.key);
/** Texto de una celda para filtrar y exportar. */
export function cellText<T>(column: DataTableColumn<T>, row: T): string {
  if (column.text) return column.text(row);
  const v = column.accessor?.(row);
  if (v === null || v === undefined) return "";
  return isDate(v) ? v.toISOString().slice(0, 10) : String(v);
}

/** Valor de una celda tal como se pinta: fechas y lógicos con el idioma de la tabla, el resto tal cual. */
export function cellContent<T>(
  column: DataTableColumn<T>,
  row: T,
  index: number,
  locale?: string,
  dateFormat?: Intl.DateTimeFormatOptions,
): ReactNode {
  const value = column.render ? column.render(row, index) : column.accessor?.(row);
  if (isDate(value)) return formatDateCell(value, locale, dateFormat);
  if (typeof value === "boolean") return String(value);
  return value as ReactNode;
}

/** Filas como CSV (cabecera con el texto de cada columna). */
export function dataTableCSV<T>(rows: ReadonlyArray<T>, columns: ReadonlyArray<DataTableColumn<T>>): string {
  return toCSV([columns.map(headerText), ...rows.map((row) => columns.map((c) => cellText(c, row)))]);
}

const EMPTY: ReadonlyArray<RowKey> = [];
const NO_FILTERS: Readonly<Record<string, string>> = {};
const NO_STRINGS: ReadonlyArray<string> = [];
const SELECT_COL = "__select";
const DETAIL_COL = "__detail";

/** Edición en curso: una celda (`col`) o la fila entera (`col` null), con lo escrito y los errores por columna. */
interface EditState {
  row: RowKey;
  col: string | null;
  /** Columna cuyo campo recibe el foco. */
  focus: string;
  values: Record<string, string>;
  errors: Record<string, string>;
  /** Letra con la que empezó (sustituye el valor). */
  seed?: string;
  saving?: boolean;
}

interface RowViewProps {
  row: unknown;
  at: number;
  checked: boolean;
  editing: unknown;
  version: object;
  render: { current: (row: never, at: number) => ReactNode };
}

/**
 * Una fila de datos memorizada: al desplazar, React solo pinta las filas nuevas de la ventana; las que siguen a la
 * vista no se vuelven a pintar mientras no cambien su fila, su selección, su edición o la tabla (`version`).
 */
const RowView = memo(
  function RowView({ row, at, render }: RowViewProps) {
    return <>{render.current(row as never, at)}</>;
  },
  (a, b) => a.row === b.row && a.at === b.at && a.checked === b.checked && a.editing === b.editing && a.version === b.version,
);

// Textos por defecto fuera del componente: una función nueva en cada pintado obligaría a repintar todas las filas.
const SELECT_ROW_LABEL = (_row: unknown, index: number) => `Select row ${index + 1}`;
const DETAIL_LABEL = (_row: unknown, index: number) => `Details of row ${index + 1}`;
const EDIT_LABEL = (column: DataTableColumn<never>) => `Edit ${headerText(column)}`;

/** Clave de una fila plana para la ventana virtual y la navegación. */
const vkey = <T,>(row: GridRow<T>): string => (row.kind === "row" ? String(row.key) : row.key);

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
  selectRowLabel = SELECT_ROW_LABEL,
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
  locale,
  dateFormat,
  grid,
  editMode = "cell",
  onCellEdit,
  onRowEdit,
  validationMessages,
  editLabel = EDIT_LABEL,
  groupBy,
  collapsedGroups,
  defaultCollapsedGroups = NO_STRINGS,
  onCollapsedGroupsChange,
  groupLabel,
  getRowChildren,
  expandedRows,
  defaultExpandedRows = EMPTY,
  onExpandedRowsChange,
  renderDetail,
  expandedDetails,
  defaultExpandedDetails = EMPTY,
  onExpandedDetailsChange,
  detailLabel = DETAIL_LABEL,
  expandLabel = "Expand",
  reorderable,
  columnOrder,
  defaultColumnOrder = NO_STRINGS,
  onColumnOrderChange,
  moveColumnLabel = (column) => `Move ${headerText(column)}`,
  reorderLabels,
  virtualize,
  rowHeight,
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
  const [collapsed, setCollapsed] = useControllable<ReadonlyArray<string>>(
    collapsedGroups,
    defaultCollapsedGroups,
    onCollapsedGroupsChange as ((keys: ReadonlyArray<string>) => void) | undefined,
  );
  const [treeOpen, setTreeOpen] = useControllable<ReadonlyArray<RowKey>>(
    expandedRows,
    defaultExpandedRows,
    onExpandedRowsChange as ((keys: ReadonlyArray<RowKey>) => void) | undefined,
  );
  const [details, setDetails] = useControllable<ReadonlyArray<RowKey>>(
    expandedDetails,
    defaultExpandedDetails,
    onExpandedDetailsChange as ((keys: ReadonlyArray<RowKey>) => void) | undefined,
  );
  const [order, setOrder] = useControllable<ReadonlyArray<string>>(
    columnOrder,
    defaultColumnOrder,
    onColumnOrderChange as ((keys: ReadonlyArray<string>) => void) | undefined,
  );
  const [edit, setEdit] = useState<EditState | null>(null);
  const anchor = useRef<RowKey | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const wrapRef = useRef<HTMLElement | null>(null);
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
  // Sin leer la geometría en cada pintado: lo medido se aplica a las filas nuevas (la ventana virtual pinta otras al
  // desplazar) y se vuelve a medir solo si cambian las columnas o sus anchos (core/datagrid-runtime).
  useEffect(() => {
    if (pinned && tableRef.current) applyPinned(tableRef.current);
  });
  const messages = { ...CELL_MESSAGES, ...validationMessages };

  // Columnas en el orden de la persona, con las fijadas a sus lados.
  const ordered = useMemo(() => {
    const byKey = new Map(columns.map((c) => [c.key, c]));
    return pinOrder(
      orderColumns(
        columns.map((c) => c.key),
        order,
      ).map((k) => byKey.get(k)!),
    );
  }, [columns, order]);
  const byKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);

  // Índice de cada fila: con 10 000 filas, `rows.indexOf` por fila eran 10⁸ comparaciones.
  const indexOfRow = useMemo(() => new Map(rows.map((row, i) => [row, i])), [rows]);
  const keyOf = (row: T) => rowKey(row, indexOfRow.get(row) ?? -1);

  const filtered = useMemo(() => {
    return filterRows(rows, filters, (row, key) => {
      const column = byKey.get(key);
      return column ? cellText(column, row) : "";
    });
  }, [rows, byKey, filters]);

  const sorted = useMemo(() => {
    const rows = filtered;
    if (!active || manualSort) return rows;
    const column = columns.find((c) => c.key === active.key);
    const accessor = column?.accessor;
    if (!accessor) return rows;
    const factor = active.direction === "asc" ? 1 : -1;
    // Orden estable: el índice original desempata. Cada valor se lee una vez.
    return rows
      .map((row, index) => ({ row, index, value: accessor(row) }))
      .sort((x, y) => {
        const a = x.value;
        const b = y.value;
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: `keyOf` sale de `rowKey` y del índice de filas.
  const order0 = useMemo(() => sorted.map(keyOf), [sorted, rowKey, indexOfRow]);
  const canSelect = (row: T) => !isRowSelectable || isRowSelectable(row);
  const visibleIndex = useMemo(() => new Map(visible.map((row, i) => [row, i])), [visible]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `keyOf` sale de `rowKey` y del índice de filas.
  const visibleKeys = useMemo(() => visible.filter(canSelect).map(keyOf), [visible, isRowSelectable, rowKey, indexOfRow]);
  const positionOf = useMemo(() => new Map(order0.map((k, i) => [k, i])), [order0]);
  const selectableKey = (key: RowKey) => {
    const row = sorted[positionOf.get(key) ?? -1];
    return row !== undefined && canSelect(row);
  };
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const all = useMemo(() => headerState(visibleKeys, selected), [visibleKeys, selected]);

  // Agrupación, árbol y detalle: las filas planas que se pintan (y que recorren la ventana virtual y el teclado).
  const groupKeys = useMemo(
    () => (typeof groupBy === "string" ? [groupBy] : [...(groupBy ?? [])]).filter((k) => byKey.has(k)),
    [groupBy, byKey],
  );
  const grouped = groupKeys.length > 0;
  const tree = Boolean(getRowChildren);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `keyOf` sale de `rowKey` y del índice de filas.
  const flat = useMemo<GridRow<T>[]>(() => {
    if (!grouped && !tree && !renderDetail)
      return visible.map((row, i) => ({
        kind: "row",
        key: keyOf(row),
        row,
        depth: 0,
        hasChildren: false,
        expanded: false,
        parent: null,
        pos: i + 1,
        size: visible.length,
      }));
    return flattenGrid({
      rows: visible,
      keyOf,
      groupBy: groupKeys,
      valueOf: (row, key) => byKey.get(key)?.accessor?.(row),
      collapsedGroups: new Set(collapsed),
      childrenOf: getRowChildren,
      expandedRows: new Set(treeOpen),
      openDetails: renderDetail ? new Set(details) : undefined,
    });
  }, [visible, rowKey, indexOfRow, grouped, tree, renderDetail, groupKeys, byKey, collapsed, getRowChildren, treeOpen, details]);

  const editable = ordered.some((c) => c.editable);
  const gridMode = grid ?? (editable || grouped || tree);
  const role = gridMode ? (grouped || tree ? "treegrid" : "grid") : undefined;
  const colKeys = [...(selectable ? [SELECT_COL] : []), ...(renderDetail ? [DETAIL_COL] : []), ...ordered.map((c) => c.key)];
  const firstData = colKeys.length - ordered.length;
  const span = colKeys.length;

  // Ventana virtual sobre las filas planas, con la fila activa y la que se edita siempre en el documento.
  const virtual = wantsVirtual(virtualize, flat.length, 200);
  const activeRow = useRef<string | null>(null);
  const indexOfVkey = useMemo(() => new Map(flat.map((r, i) => [vkey(r), i])), [flat]);
  const keep = [activeRow.current, edit ? String(edit.row) : null]
    .map((k) => (k === null ? -1 : (indexOfVkey.get(k) ?? -1)))
    .filter((i) => i >= 0);
  const density = tableProps.density ?? "comfortable";
  useIsoLayoutEffect(() => {
    wrapRef.current = tableRef.current?.parentElement ?? null;
  });
  // Filas de alto variable (detalle, grupos): se miden una a una. Si no, todas miden lo que la primera (una lectura):
  // con 10 000 filas, medir y sumar alturas en cada desplazamiento era el coste principal.
  const variable = Boolean(renderDetail) || grouped;
  const [measured, setMeasured] = useState<number | null>(null);
  useIsoLayoutEffect(() => {
    if (!virtual || variable || rowHeight || measured) return;
    const row = tableRef.current?.tBodies[0]?.querySelector<HTMLElement>(":scope > tr[data-vkey]");
    if (row?.offsetHeight) setMeasured(row.offsetHeight);
  });
  const win = useVirtual({
    enabled: virtual,
    count: flat.length,
    size: rowHeight ?? measured ?? (density === "compact" ? 37 : 45),
    key: variable ? (i) => (flat[i] ? vkey(flat[i]!) : String(i)) : undefined,
    keep,
    overscan: 5,
    scroller: wrapRef,
    container: { current: tableRef.current?.tBodies[0] ?? null },
    rowSelector: ":scope > tr[data-vkey]",
    keyAttr: "data-vkey",
    offset: () => {
      const wrap = wrapRef.current;
      const body = tableRef.current?.tBodies[0];
      if (!wrap || !body) return 0;
      return body.getBoundingClientRect().top - wrap.getBoundingClientRect().top + wrap.scrollTop;
    },
  });

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
  const selectKey = (key: RowKey, range: boolean) => {
    const next = range ? rangeKeys(selected, order0, anchor.current, key, selectableKey) : toggleKey(selected, key, order0);
    anchor.current = key;
    setSelected(next);
  };
  const onSelectRow = (event: MouseEvent<HTMLButtonElement>, key: RowKey) => {
    event.preventDefault();
    event.stopPropagation();
    selectKey(key, event.shiftKey);
  };
  const onSelectAll = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setSelected(toggleAll(selected, visibleKeys, order0));
  };
  const toggleIn = <K,>(list: ReadonlyArray<K>, key: K, open?: boolean): K[] => {
    const has = list.includes(key);
    const want = open ?? !has;
    return want ? (has ? [...list] : [...list, key]) : list.filter((k) => k !== key);
  };

  /* ---------- Edición ---------- */
  const canEdit = (column: DataTableColumn<T>, row: T) =>
    typeof column.editable === "function" ? column.editable(row) : Boolean(column.editable);
  const editValueOf = (column: DataTableColumn<T>, row: T) => column.editValue?.(row) ?? cellText(column, row);
  const pendingFocus = useRef(false);
  const rowOfKey = (key: string) => {
    const r = flat[indexOfVkey.get(key) ?? -1];
    return r?.kind === "row" ? r : undefined;
  };
  const startEdit = (key: string, colIndex: number, seed?: string) => {
    const r = rowOfKey(key);
    const column = byKey.get(colKeys[colIndex] ?? "");
    if (!r || !column || !canEdit(column, r.row)) return;
    const cols = editMode === "row" ? ordered.filter((c) => canEdit(c, r.row)) : [column];
    const values: Record<string, string> = {};
    for (const c of cols) values[c.key] = c.key === column.key && seed !== undefined ? seed : editValueOf(c, r.row);
    setEdit({ row: r.key, col: editMode === "row" ? null : column.key, focus: column.key, values, errors: {}, seed });
  };
  const errorOf = (column: DataTableColumn<T>, row: T, value: string) =>
    validateCell(
      value,
      {
        required: column.required,
        min: column.min,
        max: column.max,
        pattern: column.pattern,
        type: column.editor,
        options: column.editor === "select" ? column.options?.map((o) => o.value) : undefined,
      },
      messages,
    ) ??
    column.validate?.(value, row) ??
    null;
  const focusCell = (row: RowKey, colKey: string) => {
    const cell = { row: String(row), col: Math.max(0, colKeys.indexOf(colKey)) };
    gridRef.current?.setActive(cell, true);
    pendingFocus.current = true;
    // Si la confirmación llegó tras pintar (una promesa), no habrá otro pintado: el foco va en el siguiente fotograma.
    requestAnimationFrame(() => {
      if (!pendingFocus.current) return;
      pendingFocus.current = false;
      gridRef.current?.setActive(cell, true);
    });
  };
  const finish = (state: EditState, rejected: string | undefined, colKey: string) => {
    if (rejected) {
      setEdit({ ...state, saving: false, errors: { ...state.errors, [colKey]: rejected } });
      announce(rejected, { source: tableRef.current ?? undefined });
      return false;
    }
    setEdit(null);
    return true;
  };
  /** Confirma la edición: valida, avisa y cierra (o deja el error a la vista). `true` si se cerró. */
  const commit = (state: EditState): boolean | Promise<boolean> => {
    const r = rowOfKey(String(state.row));
    if (!r) {
      setEdit(null);
      return true;
    }
    const errors: Record<string, string> = {};
    for (const [key, value] of Object.entries(state.values)) {
      const column = byKey.get(key);
      const error = column ? errorOf(column, r.row, value) : null;
      if (error) errors[key] = error;
    }
    if (Object.keys(errors).length) {
      setEdit({ ...state, errors });
      announce(Object.values(errors)[0]!, { source: tableRef.current ?? undefined });
      return false;
    }
    const result =
      state.col === null
        ? onRowEdit?.({ row: r.row, rowKey: r.key, values: { ...state.values } })
        : onCellEdit?.({ row: r.row, rowKey: r.key, key: state.col, value: state.values[state.col] ?? "" });
    const colKey = state.col ?? state.focus;
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setEdit({ ...state, errors: {}, saving: true });
      return (result as Promise<unknown>).then(
        (rejected) => finish(state, typeof rejected === "string" ? rejected : undefined, colKey),
        (error: unknown) => finish(state, error instanceof Error ? error.message : String(error), colKey),
      );
    }
    return finish(state, typeof result === "string" ? result : undefined, colKey);
  };
  const editableCells = (row: T) => ordered.filter((c) => canEdit(c, row)).map((c) => c.key);
  const onEditorKey = (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, column: DataTableColumn<T>, row: T) => {
    if (!edit) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setEdit(null);
      focusCell(edit.row, column.key);
      return;
    }
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      const state = edit;
      void Promise.resolve(commit(state)).then((ok) => {
        if (ok) focusCell(state.row, column.key);
      });
      return;
    }
    if (event.key === "Tab" && edit.col !== null) {
      // Por celda: Tab confirma y abre la siguiente celda editable de la fila (Mayús, la anterior).
      const cells = editableCells(row);
      const next = cells[cells.indexOf(column.key) + (event.shiftKey ? -1 : 1)];
      if (!next) return;
      event.preventDefault();
      const state = edit;
      void Promise.resolve(commit(state)).then((ok) => {
        if (ok) startEdit(String(state.row), colKeys.indexOf(next));
      });
    }
  };
  // El campo nuevo recibe el foco (y el texto se selecciona, salvo si empezó con una letra).
  useIsoLayoutEffect(() => {
    const field = tableRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>("[data-edit-focus]");
    if (!field || field === document.activeElement) return;
    field.focus({ preventScroll: true });
    if (field instanceof HTMLInputElement && field.type !== "date") {
      if (edit?.seed !== undefined) field.setSelectionRange(field.value.length, field.value.length);
      else field.select();
    }
  }, [edit?.row, edit?.focus, edit?.col]);

  /* ---------- Rejilla (teclado) y reordenar columnas ---------- */
  const gridRef = useRef<GridHandle | null>(null);
  const live = useLatest({
    flat,
    colKeys,
    ordered,
    byKey,
    selectable,
    canEdit,
    startEdit,
    win,
    indexOfVkey,
    order0,
    selected,
    setSelected,
    selectKey,
    rowOfKey,
    setCollapsed,
    collapsed,
    setTreeOpen,
    treeOpen,
    reorderKeys: ordered.filter((c) => c.reorderable !== false && !c.pinned).map((c) => c.key),
    setOrder,
    onRowClick,
    offset,
  });
  useEffect(() => {
    const table = tableRef.current;
    if (!gridMode || !table) return;
    const g = bindGrid(table, {
      rowKeys: () => live.current.flat.map(vkey),
      reveal: (key) => live.current.win.scrollToIndex(live.current.indexOfVkey.get(key) ?? 0),
      editable: (key, col) => {
        const r = live.current.rowOfKey(key);
        const column = live.current.byKey.get(live.current.colKeys[col] ?? "");
        return Boolean(r && column && live.current.canEdit(column, r.row));
      },
      onEdit: (key, col, seed) => live.current.startEdit(key, col, seed),
      onToggle: (key, open) => {
        const l = live.current;
        const r = l.flat[l.indexOfVkey.get(key) ?? -1];
        if (!r) return false;
        if (r.kind === "group") {
          if (r.expanded === open) return false;
          l.setCollapsed(open ? l.collapsed.filter((k) => k !== r.key) : [...l.collapsed, r.key]);
          return true;
        }
        if (r.kind === "row" && r.hasChildren && r.expanded !== open) {
          l.setTreeOpen(open ? [...l.treeOpen, r.key] : l.treeOpen.filter((k) => k !== r.key));
          return true;
        }
        // ← en un hijo lleva a su padre (patrón treegrid).
        if (r.kind === "row" && !open && r.parent !== null) {
          gridRef.current?.setActive({ row: String(r.parent), col: 0 }, true);
          return true;
        }
        return false;
      },
      onSelect: (key, range) => {
        const r = live.current.rowOfKey(key);
        if (r && live.current.selectable) live.current.selectKey(r.key, range);
      },
      onExtend: (from, to) => {
        const l = live.current;
        const a = l.rowOfKey(from);
        const b = l.rowOfKey(to);
        if (!l.selectable || !a || !b) return;
        const keys = keyRange(l.order0, a.key, b.key);
        l.setSelected([...new Set([...l.selected, ...keys])]);
      },
      onActivate: (key) => {
        const l = live.current;
        const at = l.indexOfVkey.get(key) ?? -1;
        const r = l.flat[at];
        if (r?.kind === "row" && l.onRowClick) l.onRowClick(r.row, l.offset + at);
      },
      onActive: (cell) => {
        activeRow.current = cell.row;
      },
    });
    gridRef.current = g;
    return () => {
      g.destroy();
      gridRef.current = null;
    };
  }, [gridMode, live]);
  useIsoLayoutEffect(() => {
    const focus = pendingFocus.current;
    pendingFocus.current = false;
    gridRef.current?.sync(focus);
  });
  useEffect(() => {
    const table = tableRef.current;
    if (!reorderable || !table) return;
    return bindColumnReorder(table, {
      order: () => live.current.reorderKeys,
      onMove: (key, to) => {
        const l = live.current;
        const moved = moveColumn(l.reorderKeys, key, to);
        let k = 0;
        l.setOrder(l.ordered.map((c) => (l.reorderKeys.includes(c.key) ? moved[k++]! : c.key)));
      },
      nameOf: (key) => headerText(live.current.byKey.get(key) ?? { key, header: key }),
      announce: (text) => announce(text, { source: table }),
      labels: reorderLabels,
    });
  }, [reorderable, live, reorderLabels]);

  const footer = columns.some((c) => c.footer !== undefined || c.aggregate !== undefined);
  const filterable = columns.some((c) => c.filterable);
  const setFilter = (key: string, value: string) => {
    const next = { ...filters, [key]: value };
    if (!value) delete next[key];
    setFilters(next);
    if (paged) setPage(1);
  };
  const pinAttr = (column: DataTableColumn<T>) => (column.pinned === "end" ? "end" : column.pinned ? "" : undefined);
  const aggregateOf = (column: DataTableColumn<T>, list: ReadonlyArray<T>): ReactNode => {
    if (column.aggregate === undefined) return null;
    if (typeof column.aggregate === "function") return column.aggregate(list);
    const value = aggregate(
      list.map((row) => column.accessor?.(row)),
      column.aggregate,
    );
    if (value === null) return null;
    return column.formatAggregate ? column.formatAggregate(value) : formatNumberCell(value, locale);
  };
  // Agregados del pie: sobre todas las filas filtradas, una vez por cambio (no en cada desplazamiento).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `aggregateOf` depende de las columnas y del idioma.
  const footerAggregates = useMemo(
    () => new Map(columns.filter((c) => c.footer === undefined && c.aggregate !== undefined).map((c) => [c.key, aggregateOf(c, filtered)])),
    [columns, filtered, locale],
  );
  const headRows = 1 + (filterable ? 1 : 0);
  const rowIndexAttr = (i: number) => (virtual ? headRows + i + 1 : undefined);

  /* ---------- Filas ---------- */
  const renderEditor = (column: DataTableColumn<T>, row: T, state: EditState) => {
    const value = state.values[column.key] ?? "";
    const error = state.errors[column.key];
    const errorId = `${String(state.row)}-${column.key}-error`.replace(/\s+/g, "_");
    const common = {
      className: "z-input__control z-table__input",
      "aria-label": editLabel(column),
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? errorId : undefined,
      "aria-busy": state.saving || undefined,
      "data-edit-focus": state.focus === column.key ? "" : undefined,
      onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => onEditorKey(event, column, row),
    };
    const set = (next: string) =>
      setEdit((s) => (s ? { ...s, values: { ...s.values, [column.key]: next }, errors: { ...s.errors, [column.key]: "" } } : s));
    return (
      <span className="z-table__editor" data-invalid={error ? "" : undefined}>
        {column.editor === "select" ? (
          <select {...common} value={value} onChange={(event) => set(event.target.value)}>
            {column.required ? null : <option value="" />}
            {(column.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            {...common}
            type={column.editor === "date" ? "date" : "text"}
            inputMode={column.editor === "number" ? "decimal" : undefined}
            required={column.required || undefined}
            value={value}
            onChange={(event) => set(event.target.value)}
            onBlur={(event) => {
              // Por celda: salir de la celda confirma si vale y si no, descarta (el foco ya está en otra parte).
              if (!edit || edit.col === null || event.currentTarget.closest("tr")?.contains(event.relatedTarget as Node | null)) return;
              const state = edit;
              const r = rowOfKey(String(state.row));
              if (r && !errorOf(column, r.row, state.values[column.key] ?? "")) void commit(state);
              else setEdit(null);
            }}
          />
        )}
        {error ? (
          <span className="z-table__error" id={errorId}>
            {error}
          </span>
        ) : null}
      </span>
    );
  };

  const toggleButton = (open: boolean, onToggle: () => void) => (
    <button
      type="button"
      className="z-table__toggle"
      data-state={open ? "open" : "closed"}
      aria-hidden="true"
      tabIndex={-1}
      title={expandLabel}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <Icon name="chevron-right" size={12} />
    </button>
  );

  const renderGroup = (r: Extract<GridRow<T>, { kind: "group" }>, at: number) => {
    const column = byKey.get(r.column);
    const label = column
      ? (groupLabel?.(column, r.value, r.rows.length) ??
        `${headerText(column)}: ${isDate(r.value) ? formatDateCell(r.value, locale, dateFormat) : String(r.value ?? "—")} (${r.rows.length})`)
      : String(r.value);
    const toggle = () => setCollapsed(toggleIn(collapsed, r.key));
    return (
      <tr
        key={r.key}
        className="z-table__group"
        data-row-key={r.key}
        data-vkey={r.key}
        aria-level={r.depth + 1}
        aria-expanded={r.expanded}
        aria-rowindex={rowIndexAttr(at)}
        style={{ "--z-depth": r.depth } as CSSProperties}
        onClick={toggle}
      >
        {colKeys.map((key, i) => {
          const col = byKey.get(key);
          if (i === firstData)
            return (
              <td key={key} data-col={key} data-pinned={col ? pinAttr(col) : undefined}>
                <span className="z-table__group-cell">
                  {toggleButton(r.expanded, toggle)}
                  <span className="z-table__group-label">{label}</span>
                </span>
              </td>
            );
          return (
            <td
              key={key}
              data-col={key}
              data-align={col?.align}
              data-mono={col?.mono || undefined}
              data-pinned={col ? pinAttr(col) : undefined}
            >
              {col && i > firstData ? aggregateOf(col, r.rows) : null}
            </td>
          );
        })}
      </tr>
    );
  };

  const renderRow = (r: Extract<GridRow<T>, { kind: "row" }>, at: number) => {
    const { row, key } = r;
    const index = offset + (visibleIndex.get(row) ?? at);
    const checked = selectable && selectedSet.has(key);
    const editing = edit && edit.row === key ? edit : null;
    const detailOpen = Boolean(renderDetail && details.includes(key));
    const detailId = `${String(key)}-detail`.replace(/\s+/g, "_");
    // La profundidad ya cuenta los grupos de encima (flattenGrid).
    const level = r.depth + 1;
    return (
      <tr
        key={String(key)}
        className={cx(onRowClick && "z-table__row--clickable", editing && "z-table__row--editing") || undefined}
        data-key={selectable ? key : undefined}
        data-row-key={gridMode || virtual ? String(key) : undefined}
        data-vkey={virtual ? String(key) : undefined}
        data-selected={checked || isRowSelected?.(row) || undefined}
        aria-rowindex={rowIndexAttr(at)}
        aria-level={role === "treegrid" ? level : undefined}
        aria-expanded={r.hasChildren ? r.expanded : undefined}
        aria-posinset={role === "treegrid" ? r.pos : undefined}
        aria-setsize={role === "treegrid" ? r.size : undefined}
        aria-selected={gridMode && selectable ? Boolean(checked) : undefined}
        tabIndex={onRowClick && !gridMode ? 0 : undefined}
        onClick={(event) => {
          // Mayús+clic en la fila: rango desde el ancla (con selección por casillas).
          if (selectable && event.shiftKey && canSelect(row)) {
            event.preventDefault();
            selectKey(key, true);
            return;
          }
          onRowClick?.(row, index);
        }}
        onKeyDown={onRowClick && !gridMode ? (event) => onRowKey(event, row, index) : undefined}
      >
        {selectable ? (
          <td className="z-table__select" data-col={SELECT_COL}>
            <Checkbox
              aria-label={selectRowLabel(row, index)}
              checked={Boolean(checked)}
              disabled={!canSelect(row)}
              onClick={(event) => onSelectRow(event, key)}
            />
          </td>
        ) : null}
        {renderDetail ? (
          <td className="z-table__expand-cell" data-col={DETAIL_COL}>
            <button
              type="button"
              className="z-btn z-btn--ghost z-btn--icon z-table__expand"
              data-size="sm"
              data-state={detailOpen ? "open" : "closed"}
              aria-expanded={detailOpen}
              aria-controls={detailOpen ? detailId : undefined}
              aria-label={detailLabel(row, index)}
              title={detailLabel(row, index)}
              onClick={(event) => {
                event.stopPropagation();
                setDetails(toggleIn(details, key));
              }}
            >
              <Icon name="chevron-right" size={14} />
            </button>
          </td>
        ) : null}
        {ordered.map((column, c) => {
          const inEdit = editing && column.key in editing.values ? editing : null;
          const content = inEdit ? renderEditor(column, row, inEdit) : cellContent(column, row, index, locale, dateFormat);
          const treeCell = tree && c === 0;
          return (
            <td
              key={column.key}
              data-col={gridMode ? column.key : undefined}
              data-align={column.align}
              data-mono={column.mono || undefined}
              data-pinned={pinAttr(column)}
              data-editable={gridMode && canEdit(column, row) ? "" : undefined}
              data-editing={inEdit ? "" : undefined}
            >
              {treeCell ? (
                <span className="z-table__tree-cell" style={{ "--z-depth": r.depth - groupKeys.length } as CSSProperties}>
                  {r.hasChildren ? (
                    toggleButton(r.expanded, () => setTreeOpen(toggleIn(treeOpen, key)))
                  ) : (
                    <span className="z-table__toggle-space" aria-hidden="true" />
                  )}
                  {content}
                </span>
              ) : (
                content
              )}
            </td>
          );
        })}
      </tr>
    );
  };

  const renderDetailRow = (r: Extract<GridRow<T>, { kind: "detail" }>, at: number) => (
    <tr
      key={r.key}
      className="z-table__detail"
      data-detail-of={String(r.rowKey)}
      data-row-key={gridMode ? r.key : undefined}
      data-vkey={virtual ? r.key : undefined}
      aria-rowindex={rowIndexAttr(at)}
    >
      <td id={`${String(r.rowKey)}-detail`.replace(/\s+/g, "_")} colSpan={span} data-col={gridMode ? DETAIL_COL : undefined}>
        <div className="z-table__detail-body">{renderDetail?.(r.row)}</div>
      </td>
    </tr>
  );

  // Lo que cambia el aspecto de todas las filas: si nada de esto cambia, una fila que sigue a la vista no se repinta.
  const rowRender = useRef(renderRow as (row: never, at: number) => ReactNode);
  rowRender.current = renderRow as (row: never, at: number) => ReactNode;
  // biome-ignore lint/correctness/useExhaustiveDependencies: la identidad nueva es la señal de volver a pintar las filas.
  const rowVersion = useMemo(
    () => ({}),
    [
      ordered,
      colKeys.join(),
      gridMode,
      role,
      virtual,
      locale,
      dateFormat,
      selectable,
      isRowSelectable,
      isRowSelected,
      onRowClick,
      selectRowLabel,
      renderDetail,
      details,
      detailLabel,
      treeOpen,
      tree,
      offset,
      expandLabel,
      editLabel,
      rowKey,
    ],
  );
  const body: ReactNode[] = [];
  if (win.virtual && win.before > 0)
    body.push(
      // biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: relleno de la ventana virtual: sin semántica de fila (no cuenta en la rejilla ni para los lectores).
      <tr key="spacer-before" className="z-table__spacer" role="presentation">
        <td aria-hidden="true" colSpan={span} style={{ "--z-virtual-space": `${Math.round(win.before)}px` } as CSSProperties} />
      </tr>,
    );
  for (const at of win.indices) {
    const r = flat[at];
    if (!r) continue;
    if (r.kind === "row")
      body.push(
        <RowView
          key={String(r.key)}
          row={r}
          at={at}
          checked={Boolean(selectable && selectedSet.has(r.key))}
          editing={edit && edit.row === r.key ? edit : null}
          version={rowVersion}
          render={rowRender}
        />,
      );
    else body.push(r.kind === "group" ? renderGroup(r, at) : renderDetailRow(r, at));
  }
  if (win.virtual && win.after > 0)
    body.push(
      // biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: relleno de la ventana virtual: sin semántica de fila (no cuenta en la rejilla ni para los lectores).
      <tr key="spacer-after" className="z-table__spacer" role="presentation">
        <td aria-hidden="true" colSpan={span} style={{ "--z-virtual-space": `${Math.round(win.after)}px` } as CSSProperties} />
      </tr>,
    );

  const table = (
    <Table
      {...tableProps}
      stickyHeader={tableProps.stickyHeader || virtual || undefined}
      wrapperClassName={cx(tableProps.wrapperClassName, virtual && "z-table-wrap--virtual")}
      ref={tableRef}
      role={role}
      aria-rowcount={virtual ? headRows + flat.length + (footer ? 1 : 0) : undefined}
      aria-colcount={virtual ? span : undefined}
      aria-multiselectable={gridMode && selectable ? true : undefined}
      hoverable={Boolean(onRowClick)}
      data-selectable={selectable || undefined}
      data-resizable={resizable || undefined}
      data-grid={gridMode || undefined}
      data-reorderable={reorderable || undefined}
      data-virtual={virtual || undefined}
      data-edit-mode={gridMode && editMode === "row" ? "row" : undefined}
    >
      <thead>
        <tr aria-rowindex={virtual ? 1 : undefined}>
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
          {renderDetail ? (
            <th scope="col" className="z-table__expand-cell">
              <span className="z-sr-only">{expandLabel}</span>
            </th>
          ) : null}
          {ordered.map((column) => {
            const direction = active?.key === column.key ? active.direction : undefined;
            const canSort = column.sortable && (column.accessor || manualSort);
            const grip = reorderable && column.reorderable !== false && !column.pinned;
            return (
              <th
                key={column.key}
                scope="col"
                data-key={column.key}
                data-align={column.align}
                data-pinned={pinAttr(column)}
                // Reglas de la edición en el marcado: el modo DOM las lee de la cabecera.
                data-editor={gridMode && column.editable ? (column.editor ?? "text") : undefined}
                data-required={gridMode && column.editable && column.required ? "" : undefined}
                data-min={gridMode && column.editable ? column.min : undefined}
                data-max={gridMode && column.editable ? column.max : undefined}
                data-pattern={gridMode && column.editable ? column.pattern : undefined}
                data-options={gridMode && column.editable && column.options ? JSON.stringify(column.options) : undefined}
                aria-sort={canSort ? (direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none") : undefined}
                style={column.width ? { width: column.width } : undefined}
              >
                {grip ? (
                  <button
                    type="button"
                    className="z-table__grip"
                    data-col-key={column.key}
                    aria-label={moveColumnLabel(column)}
                    title={moveColumnLabel(column)}
                    aria-pressed="false"
                  >
                    <Icon name="arrows-right-left" size={12} />
                  </button>
                ) : null}
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
          <tr className="z-table__filters" aria-rowindex={virtual ? 2 : undefined}>
            {selectable ? <td className="z-table__select" /> : null}
            {renderDetail ? <td className="z-table__expand-cell" /> : null}
            {ordered.map((column) => (
              <th key={column.key} scope="col" data-align={column.align} data-pinned={pinAttr(column)}>
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
      <tbody
        // La fila con el foco no sale del documento al desplazar (también sin rejilla: una casilla, un botón).
        onFocus={(event) => {
          const key = (event.target as Element).closest?.("tr")?.getAttribute("data-vkey");
          if (key) activeRow.current = key;
        }}
      >
        {flat.length === 0 ? (
          <tr>
            <td className="z-table__empty" colSpan={span}>
              {empty}
            </td>
          </tr>
        ) : (
          body
        )}
      </tbody>
      {footer ? (
        <tfoot>
          <tr aria-rowindex={virtual ? headRows + flat.length + 1 : undefined}>
            {selectable ? <td className="z-table__select" /> : null}
            {renderDetail ? <td className="z-table__expand-cell" /> : null}
            {ordered.map((column) => (
              <td key={column.key} data-align={column.align} data-mono={column.mono || undefined} data-pinned={pinAttr(column)}>
                {column.footer !== undefined
                  ? typeof column.footer === "function"
                    ? column.footer(rows)
                    : column.footer
                  : footerAggregates.get(column.key)}
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
            onClick={() => void download(dataTableCSV(sorted, ordered), exportFileName, "text/csv")}
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
