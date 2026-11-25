"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { occurrenceKeys } from "../../core/keys";
import { score } from "../../core/search";
import { wantsVirtual } from "../../core/virtual";
import { cx } from "../../cx";
import { DialogSurface } from "../../primitives/dialog";
import { useVirtual } from "../../primitives/virtual";
import { Spacer } from "../forms/option-rows.internal";

export interface PaletteCommand {
  id: string;
  label: string;
  /** Texto secundario a la derecha (ruta, detalle). */
  hint?: string;
  /** Atajo mostrado, teclas separadas por espacio: "Ctrl K". */
  shortcut?: string;
  icon?: IconName;
  /** Términos extra para la búsqueda. */
  keywords?: string[];
  disabled?: boolean;
  onSelect: () => void;
}

export interface PaletteGroup {
  heading?: string;
  commands: PaletteCommand[];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: PaletteGroup[];
  placeholder?: string;
  emptyLabel?: string;
  /** Nombre accesible del diálogo. */
  label?: string;
  /** Texto de la tecla que cierra. */
  escapeLabel?: string;
  /** Filtro propio: devuelve los grupos ya filtrados y ordenados. */
  filter?: (groups: PaletteGroup[], query: string) => PaletteGroup[];
  /** Cierra al elegir un comando. */
  closeOnSelect?: boolean;
  /** Pie bajo la lista: atajos de navegación, ayuda o una acción. */
  footer?: ReactNode;
  /**
   * Ventana virtual: solo se pintan los comandos que se ven (el activo no sale del documento). `true` siempre, `false`
   * nunca, un número es el umbral; por defecto, a partir de 150 comandos.
   */
  virtualize?: boolean | number;
  className?: string;
}

function defaultFilter(groups: PaletteGroup[], query: string): PaletteGroup[] {
  const q = query.trim();
  if (!q) return groups;
  return groups
    .map((group) => ({
      heading: group.heading,
      commands: group.commands
        .map((command) => ({
          command,
          s: Math.max(
            score(q, command.label),
            score(q, command.hint ?? "") * 0.9,
            ...(command.keywords ?? []).map((k) => score(q, k) * 0.8),
            score(q, group.heading ?? "") * 0.5,
          ),
        }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.command),
    }))
    .filter((group) => group.commands.length > 0);
}

/** Teclas de un atajo con su clave de React (una tecla repetida no duplica clave). */
function shortcutKeys(shortcut: string): Array<[id: string, key: string]> {
  const keys = shortcut.split(" ");
  const ids = occurrenceKeys(keys);
  return keys.map((key, k) => [ids[k] ?? key, key]);
}

interface CommandListProps {
  open: boolean;
  groups: PaletteGroup[];
  placeholder: string;
  emptyLabel: string;
  label: string;
  /** Tecla que cierra, a la derecha del campo (solo en la paleta). */
  escapeLabel?: string;
  filter: (groups: PaletteGroup[], query: string) => PaletteGroup[];
  onRun: (command: PaletteCommand) => void;
  /** En línea: Escape vacía la búsqueda en lugar de cerrar. */
  inline?: boolean;
  footer?: ReactNode;
  id?: string;
  virtualize?: boolean | number;
}

/** Campo de búsqueda, lista filtrada y pie: lo que comparten la paleta (en un diálogo) y el comando en línea. */
function CommandList({
  open,
  groups,
  placeholder,
  emptyLabel,
  label,
  escapeLabel,
  filter,
  onRun,
  inline,
  footer,
  id,
  virtualize,
}: CommandListProps) {
  const auto = useId();
  const baseId = id ?? auto;
  const [query, setQuery] = useState("");
  const [rawIndex, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => filter(groups, query), [filter, groups, query]);
  const flat = useMemo(() => visible.flatMap((group) => group.commands), [visible]);
  const optionId = (i: number) => `${baseId}-option-${i}`;
  // Si los grupos cambian con la paleta abierta, el comando activo nunca queda fuera de la lista.
  const index = Math.max(0, Math.min(rawIndex, flat.length - 1));

  // Cada apertura empieza limpia. Se decide en el render, no en un efecto: el campo no llega a pintarse con la
  // búsqueda anterior.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }

  // Filas (cabecera de grupo y comando) para la ventana virtual.
  const rows = useMemo(() => {
    const out: Array<{ kind: "heading"; key: string; group: number } | { kind: "command"; key: string; group: number; index: number }> = [];
    let n = 0;
    visible.forEach((group, g) => {
      if (group.heading) out.push({ kind: "heading", key: `h:${g}`, group: g });
      for (const command of group.commands) out.push({ kind: "command", key: `c:${command.id}`, group: g, index: n++ });
    });
    return out;
  }, [visible]);
  const virtual = wantsVirtual(virtualize, flat.length, 150);
  const activeRow = rows.findIndex((r) => r.kind === "command" && r.index === index);
  const win = useVirtual({
    enabled: virtual && open,
    count: rows.length,
    size: (i) => (rows[i]?.kind === "heading" ? 28 : 40),
    key: (i) => rows[i]?.key ?? String(i),
    keep: activeRow >= 0 ? [activeRow] : [],
    scroller: listRef,
    rowSelector: "[data-key]",
  });

  // El comando activo se mantiene a la vista; no al montar (un comando en línea no desplaza la página al cargar).
  const moved = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo al cambiar el comando activo.
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
    else if (activeRow >= 0) win.scrollToIndex(activeRow);
  }, [index]);

  const run = (command: PaletteCommand | undefined) => {
    if (!command || command.disabled) return;
    onRun(command);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = flat.length - 1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex(Math.min(last, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex(Math.max(0, index - 1));
    } else if (event.key === "Home" && flat.length > 0) {
      event.preventDefault();
      setIndex(0);
    } else if (event.key === "End" && flat.length > 0) {
      event.preventDefault();
      setIndex(last);
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(flat[index]);
    } else if (event.key === "Escape" && inline && query) {
      // En línea: Escape vacía la búsqueda; sin búsqueda, sigue su curso.
      event.preventDefault();
      setQuery("");
      setIndex(0);
    }
  };

  // Un grupo se identifica por su título y su primer comando: la clave lo sigue cuando el filtro quita grupos por delante.
  const groupKeys = occurrenceKeys(visible.map((group) => `${group.heading ?? ""}/${group.commands[0]?.id ?? ""}`));
  // Lo que se pinta de cada grupo: con ventana virtual, solo sus filas dentro de ella.
  const shown = new Set(win.indices);
  const firstOf: number[] = [];
  rows.forEach((r, i) => {
    if (firstOf[r.group] === undefined) firstOf[r.group] = i;
  });
  let n = -1;
  return (
    <>
      <div className="z-palette__search">
        <span className="z-palette__search-icon">
          <Icon name="magnifying-glass" size={16} />
        </span>
        <input
          className="z-palette__input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={`${baseId}-list`}
          aria-activedescendant={flat.length > 0 ? optionId(index) : undefined}
          aria-autocomplete="list"
          aria-label={label}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={onKeyDown}
        />
        {escapeLabel ? <kbd className="z-palette__kbd">{escapeLabel}</kbd> : null}
      </div>
      <div
        ref={listRef}
        id={`${baseId}-list`}
        role="listbox"
        aria-label={label}
        className="z-palette__list"
        data-virtual={win.virtual || undefined}
      >
        {flat.length === 0 ? (
          <div className="z-palette__empty" role="status">
            {emptyLabel}
          </div>
        ) : null}
        {win.virtual && win.before > 0 ? <Spacer px={win.before} /> : null}
        {visible.map((group, g) => {
          const base = firstOf[g] ?? 0;
          const headingRow = group.heading ? base : -1;
          const firstCommandRow = group.heading ? base + 1 : base;
          const rendered = group.commands.some((_, c) => shown.has(firstCommandRow + c)) || shown.has(headingRow);
          if (!rendered) {
            n += group.commands.length;
            return null;
          }
          return (
            <div key={groupKeys[g]} role="group" aria-label={group.heading} className="z-palette__group">
              {group.heading && shown.has(headingRow) ? (
                <div className="z-palette__heading" aria-hidden="true" data-key={win.virtual ? `h:${g}` : undefined}>
                  {group.heading}
                </div>
              ) : null}
              {group.commands.map((command, c) => {
                n += 1;
                const i = n;
                if (!shown.has(firstCommandRow + c)) return null;
                const active = i === index;
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: patrón combobox con aria-activedescendant: el foco no sale del campo, que atiende flechas e Intro.
                  // biome-ignore lint/a11y/useFocusableInteractive: las opciones no reciben foco; el campo las señala con aria-activedescendant.
                  <div
                    key={command.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={active}
                    aria-disabled={command.disabled || undefined}
                    data-index={i}
                    data-key={win.virtual ? `c:${command.id}` : undefined}
                    aria-posinset={win.virtual ? i + 1 : undefined}
                    aria-setsize={win.virtual ? flat.length : undefined}
                    className="z-palette__item"
                    onPointerMove={() => {
                      if (!active) setIndex(i);
                    }}
                    onClick={() => run(command)}
                  >
                    {command.icon ? (
                      <span className="z-palette__item-icon">
                        <Icon name={command.icon} size={16} />
                      </span>
                    ) : null}
                    <span className="z-palette__item-label">{command.label}</span>
                    {command.hint ? <span className="z-palette__item-hint">{command.hint}</span> : null}
                    {command.shortcut ? (
                      <span className="z-palette__shortcut">
                        {shortcutKeys(command.shortcut).map(([id, key]) => (
                          <kbd key={id} className="z-palette__kbd">
                            {key}
                          </kbd>
                        ))}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
        {win.virtual && win.after > 0 ? <Spacer px={win.after} /> : null}
      </div>
      {footer ? <div className="z-palette__footer">{footer}</div> : null}
    </>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  groups,
  placeholder = "Type a command or search…",
  emptyLabel = "No results",
  label = "Command palette",
  escapeLabel = "Esc",
  filter = defaultFilter,
  closeOnSelect = true,
  footer,
  virtualize,
  className,
}: CommandPaletteProps) {
  return (
    // Siempre se abre de forma controlada (atajo o botón propio): al cerrar, el foco vuelve a donde estaba.
    <DialogSurface
      open={open}
      onDismiss={() => onOpenChange(false)}
      initialFocus={(dialog) => dialog.querySelector<HTMLElement>(".z-palette__input")}
      className={cx("z-liquid z-palette", className)}
      aria-label={label}
    >
      <CommandList
        open={open}
        groups={groups}
        placeholder={placeholder}
        emptyLabel={emptyLabel}
        label={label}
        escapeLabel={escapeLabel}
        filter={filter}
        footer={footer}
        virtualize={virtualize}
        onRun={(command) => {
          if (closeOnSelect) onOpenChange(false);
          command.onSelect();
        }}
      />
    </DialogSurface>
  );
}

export interface CommandProps {
  groups: PaletteGroup[];
  /** Prefijo de los ids de la lista y sus opciones. Sin valor, uno generado. */
  id?: string;
  /** Nombre accesible del campo y de la lista. */
  label?: string;
  placeholder?: string;
  emptyLabel?: string;
  filter?: (groups: PaletteGroup[], query: string) => PaletteGroup[];
  /** Pie bajo la lista: atajos de navegación, ayuda o una acción. */
  footer?: ReactNode;
  /** Ventana virtual (como en CommandPalette): por defecto, a partir de 150 comandos. */
  virtualize?: boolean | number;
  className?: string;
}

/**
 * La paleta de comandos incrustada en la página (sin diálogo): un buscador con su lista siempre a la vista, para un
 * panel de acciones, un selector de destino o el cuerpo de un Popover. Mismo patrón combobox con
 * `aria-activedescendant`: el foco se queda en el campo, las flechas mueven la opción activa e Intro la ejecuta.
 */
export function Command({
  id,
  groups,
  label = "Commands",
  placeholder = "Search commands…",
  emptyLabel = "No results",
  filter = defaultFilter,
  footer,
  virtualize,
  className,
}: CommandProps) {
  return (
    <div className={cx("z-liquid z-palette z-command", className)} data-inline="">
      <CommandList
        open
        inline
        id={id}
        groups={groups}
        placeholder={placeholder}
        emptyLabel={emptyLabel}
        label={label}
        filter={filter}
        footer={footer}
        virtualize={virtualize}
        onRun={(command) => command.onSelect()}
      />
    </div>
  );
}
