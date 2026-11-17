"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { occurrenceKeys } from "../../core/keys";
import { score } from "../../core/search";
import { cx } from "../../cx";
import { DialogSurface } from "../../primitives/dialog";

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
    }
  };

  // Un grupo se identifica por su título y su primer comando: la clave lo sigue cuando el filtro quita grupos por delante.
  const groupKeys = occurrenceKeys(visible.map((group) => `${group.heading ?? ""}/${group.commands[0]?.id ?? ""}`));
  let n = -1;
  return (
    // Siempre se abre de forma controlada (atajo o botón propio): al cerrar, el foco vuelve a donde estaba.
    <DialogSurface
      open={open}
      onDismiss={() => onOpenChange(false)}
      initialFocus={(dialog) => dialog.querySelector<HTMLElement>(".z-palette__input")}
      className={cx("z-liquid z-palette", className)}
      aria-label={label}
    >
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
          <div key={groupKeys[g]} role="group" aria-label={group.heading} className="z-palette__group">
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
                // biome-ignore lint/a11y/useKeyWithClickEvents: patrón combobox con aria-activedescendant: el foco no sale del campo, que atiende flechas e Intro.
                // biome-ignore lint/a11y/useFocusableInteractive: las opciones no reciben foco; el campo las señala con aria-activedescendant.
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
        ))}
      </div>
    </DialogSurface>
  );
}
