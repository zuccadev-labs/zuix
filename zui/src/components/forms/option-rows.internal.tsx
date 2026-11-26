// Filas de una lista de opciones con grupos (Listbox, Select, Combobox): aplanadas para la ventana virtual (cabecera
// de grupo y opción son filas) y vueltas a juntar en `role="group"` al pintar solo las de la ventana. Sin estado propio.

import type { ReactNode } from "react";

export type OptionRow<O> =
  | { kind: "label"; key: string; group: number; label: string }
  | { kind: "option"; key: string; group: number | null; option: O; index: number };

/** Aplana opciones sueltas y grupos `{ label, options }` en filas; `index` es la posición de la opción en `options`. */
export function optionRows<O extends { value: string }, G extends { label: string; options: ReadonlyArray<O> }>(
  entries: ReadonlyArray<O | G>,
  isGroup: (entry: O | G) => entry is G,
): { rows: OptionRow<O>[]; options: O[] } {
  const rows: OptionRow<O>[] = [];
  const options: O[] = [];
  entries.forEach((entry, g) => {
    if (isGroup(entry)) {
      rows.push({ kind: "label", key: `g:${g}`, group: g, label: entry.label });
      for (const option of entry.options) {
        rows.push({ kind: "option", key: `o:${option.value}`, group: g, option, index: options.length });
        options.push(option);
      }
    } else {
      rows.push({ kind: "option", key: `o:${entry.value}`, group: null, option: entry, index: options.length });
      options.push(entry);
    }
  });
  return { rows, options };
}

interface RenderRowsInput<O> {
  rows: ReadonlyArray<OptionRow<O>>;
  /** Filas que se pintan (todas, o la ventana virtual). */
  indices: ReadonlyArray<number>;
  /** Prefijo de los ids de los títulos de grupo. */
  listId: string;
  renderOption: (option: O, index: number, row: number) => ReactNode;
  /** Atributos de medida (`data-key`) solo con ventana virtual: sin ella, el marcado no cambia. */
  virtual: boolean;
  before?: number;
  after?: number;
}

/** Opciones y grupos de las filas pintadas, con los rellenos de la ventana virtual. */
export function renderRows<O>({ rows, indices, listId, renderOption, virtual, before = 0, after = 0 }: RenderRowsInput<O>): ReactNode[] {
  const out: ReactNode[] = [];
  if (virtual && before > 0) out.push(<Spacer key="spacer-before" px={before} />);
  let run: { group: number; label: string; labelShown: boolean; items: ReactNode[] } | null = null;
  const flush = () => {
    if (!run) return;
    const { group, label, labelShown, items } = run;
    out.push(
      <div
        key={`group-${group}`}
        role="group"
        className="z-listbox__group"
        aria-labelledby={labelShown ? `${listId}-group-${group}` : undefined}
        aria-label={labelShown ? undefined : label}
      >
        {labelShown ? (
          <div id={`${listId}-group-${group}`} className="z-listbox__label" data-key={virtual ? `g:${group}` : undefined}>
            {label}
          </div>
        ) : null}
        {items}
      </div>,
    );
    run = null;
  };
  for (const at of indices) {
    const row = rows[at];
    if (!row) continue;
    if (row.kind === "option" && row.group === null) {
      flush();
      out.push(renderOption(row.option, row.index, at));
      continue;
    }
    if (row.group === null) continue;
    if (!run || run.group !== row.group) {
      flush();
      const head = rows.find((r) => r.kind === "label" && r.group === row.group);
      run = { group: row.group, label: head?.kind === "label" ? head.label : "", labelShown: false, items: [] };
    }
    if (row.kind === "label") run.labelShown = true;
    else run.items.push(renderOption(row.option, row.index, at));
  }
  flush();
  if (virtual && after > 0) out.push(<Spacer key="spacer-after" px={after} />);
  return out;
}

/** Relleno de la ventana virtual (fuera del árbol de accesibilidad). */
export function Spacer({ px, as: Tag = "div" }: { px: number; as?: "div" | "li" | "tr" }) {
  const style = { "--z-virtual-space": `${Math.round(px)}px` } as Record<string, string>;
  return <Tag className="z-virtual-spacer" aria-hidden="true" style={style} />;
}

/** Fila de la opción `index` (para desplazar a ella). */
export const rowOfOption = <O,>(rows: ReadonlyArray<OptionRow<O>>, index: number): number =>
  rows.findIndex((r) => r.kind === "option" && r.index === index);

/** Alto estimado de una fila por tamaño del control (la medida real lo corrige al pintar). */
export const estimateRow =
  <O,>(rows: ReadonlyArray<OptionRow<O>>, size: "sm" | "md" | "lg") =>
  (i: number): number =>
    rows[i]?.kind === "label" ? 30 : size === "sm" ? 28 : 32;
