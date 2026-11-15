"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Dialog } from "radix-ui";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";
import { useReturnFocus } from "./internal";

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
  className?: string;
}

// Puntuación difusa mínima: prefijo > contiene > subsecuencia.
function score(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 3;
  if (t.includes(q)) return 2;
  let qi = 0;
  for (const ch of t) if (ch === q[qi]) qi += 1;
  return qi === q.length ? 1 : 0;
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
          s: Math.max(score(q, command.label), score(q, command.hint ?? "") * 0.9, ...(command.keywords ?? []).map((k) => score(q, k) * 0.8), score(q, group.heading ?? "") * 0.5),
        }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.command),
    }))
    .filter((group) => group.commands.length > 0);
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
  className,
}: CommandPaletteProps) {
  const baseId = useId();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  // La paleta siempre se abre de forma controlada (atajo o botón propio): el foco vuelve a donde estaba.
  const returnFocus = useReturnFocus(false);

  const visible = useMemo(() => filter(groups, query), [filter, groups, query]);
  const flat = useMemo(() => visible.flatMap((group) => group.commands), [visible]);
  const optionId = (i: number) => `${baseId}-option-${i}`;

  // Cada apertura empieza limpia.
  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const run = (command: PaletteCommand | undefined) => {
    if (!command || command.disabled) return;
    if (closeOnSelect) onOpenChange(false);
    command.onSelect();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = flat.length - 1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((i) => Math.min(last, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "Home" && flat.length > 0) {
      event.preventDefault();
      setIndex(0);
    } else if (event.key === "End" && flat.length > 0) {
      event.preventDefault();
      setIndex(last);
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(flat[index]);
    }
  };

  let n = -1;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="z-overlay-scrim z-overlay-scrim--palette" />
        <Dialog.Content className={cx("z-liquid z-palette", className)} aria-describedby={undefined} {...returnFocus}>
          <Dialog.Title className="z-sr-only">{label}</Dialog.Title>
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
            <kbd className="z-palette__kbd">{escapeLabel}</kbd>
          </div>
          <div ref={listRef} id={`${baseId}-list`} role="listbox" aria-label={label} className="z-palette__list">
            {flat.length === 0 ? (
              <div className="z-palette__empty" role="status">
                {emptyLabel}
              </div>
            ) : null}
            {visible.map((group, g) => (
              <div key={group.heading ?? `group-${g}`} role="group" aria-label={group.heading} className="z-palette__group">
                {group.heading ? (
                  <div className="z-palette__heading" aria-hidden="true">
                    {group.heading}
                  </div>
                ) : null}
                {group.commands.map((command) => {
                  n += 1;
                  const i = n;
                  const active = i === index;
                  return (
                    <div
                      key={command.id}
                      id={optionId(i)}
                      role="option"
                      aria-selected={active}
                      aria-disabled={command.disabled || undefined}
                      data-index={i}
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
                          {command.shortcut.split(" ").map((key, k) => (
                            <kbd key={`${key}-${k}`} className="z-palette__kbd">
                              {key}
                            </kbd>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
