"use client";
// Piezas internas del grupo overlay: botón de cierre, botón de acción y entradas de menú compartidas.
import { createContext, useRef, type ComponentProps, type ComponentType, type MouseEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

/** Verdadero dentro de un Modal: los menús anidados suben de capa para no quedar detrás. */
export const ElevatedContext = createContext(false);

/**
 * Devolución del foco para diálogos abiertos sin disparador (uso controlado). Radix solo devuelve el foco a su
 * `Trigger`; sin él, al cerrar el foco se quedaba en `body`. Aquí se recuerda el elemento enfocado al abrir y se
 * le devuelve el foco al cerrar. Con disparador no hace nada.
 */
export function useReturnFocus(hasTrigger: boolean) {
  const previous = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      // En este momento el foco aún no ha entrado en el diálogo.
      previous.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    },
    onCloseAutoFocus: (event: Event) => {
      const target = previous.current;
      previous.current = null;
      if (hasTrigger || !target || !target.isConnected) return;
      event.preventDefault();
      target.focus({ preventScroll: true });
    },
  };
}

/** Un clic en el velo de un diálogo que no se cierra con él no debe llevarse el foco a `body`. */
export const keepFocus = (event: MouseEvent) => event.preventDefault();

export interface CloseButtonProps extends ComponentProps<"button"> {
  label: string;
}

/** Botón de cierre local (el grupo no depende de `actions`). */
export function CloseButton({ label, className, ...rest }: CloseButtonProps) {
  return (
    <button type="button" {...rest} className={cx("z-overlay-close", className)} aria-label={label}>
      <Icon name="x-mark" size={16} />
    </button>
  );
}

export interface DialogButtonProps extends ComponentProps<"button"> {
  variant?: "primary" | "secondary" | "danger";
}

/** Botón de pie de diálogo; misma forma que el botón estándar. */
export function DialogButton({ variant = "secondary", className, ...rest }: DialogButtonProps) {
  return <button type="button" {...rest} className={cx("z-dialog-btn", className)} data-variant={variant} />;
}

export interface MenuItemEntry {
  type?: "item";
  id: string;
  label: ReactNode;
  icon?: IconName;
  /** Atajo mostrado a la derecha, p. ej. "Ctrl K". */
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  /** No cierra el menú al elegir. */
  keepOpen?: boolean;
  onSelect?: () => void;
  /** Submenú. */
  items?: MenuEntry[];
}

export type MenuEntry = { type: "separator" } | { type: "label"; label: ReactNode } | MenuItemEntry;

// Subconjunto común de DropdownMenu y ContextMenu de Radix.
export interface MenuKit {
  Item: ComponentType<{ className?: string; disabled?: boolean; onSelect?: (event: Event) => void; children?: ReactNode }>;
  Separator: ComponentType<{ className?: string }>;
  Label: ComponentType<{ className?: string; children?: ReactNode }>;
  Sub: ComponentType<{ children?: ReactNode }>;
  SubTrigger: ComponentType<{ className?: string; disabled?: boolean; children?: ReactNode }>;
  SubContent: ComponentType<{ className?: string; children?: ReactNode }>;
  Portal: ComponentType<{ children?: ReactNode }>;
}

function ItemBody({ entry, sub }: { entry: MenuItemEntry; sub?: boolean }) {
  return (
    <>
      <span className="z-menu__icon">{entry.icon ? <Icon name={entry.icon} size={14} /> : null}</span>
      <span className="z-menu__text">{entry.label}</span>
      {entry.shortcut ? <kbd className="z-menu__shortcut">{entry.shortcut}</kbd> : null}
      {sub ? (
        <span className="z-menu__chevron">
          <Icon name="chevron-right" size={14} />
        </span>
      ) : null}
    </>
  );
}

export function MenuEntries({ kit, items, size, elevated }: { kit: MenuKit; items: MenuEntry[]; size: "md" | "lg"; elevated: boolean }) {
  return (
    <>
      {items.map((entry, i) => {
        if (entry.type === "separator") return <kit.Separator key={`sep-${i}`} className="z-menu__separator" />;
        if (entry.type === "label") {
          return (
            <kit.Label key={`label-${i}`} className="z-menu__label">
              {entry.label}
            </kit.Label>
          );
        }
        if (entry.items && entry.items.length > 0) {
          return (
            <kit.Sub key={entry.id}>
              <kit.SubTrigger className="z-menu__item" disabled={entry.disabled} data-danger={entry.danger || undefined}>
                <ItemBody entry={entry} sub />
              </kit.SubTrigger>
              <kit.Portal>
                <kit.SubContent className="z-liquid z-menu" data-size={size} data-elevated={elevated || undefined}>
                  <MenuEntries kit={kit} items={entry.items} size={size} elevated={elevated} />
                </kit.SubContent>
              </kit.Portal>
            </kit.Sub>
          );
        }
        return (
          <kit.Item
            key={entry.id}
            className="z-menu__item"
            disabled={entry.disabled}
            data-danger={entry.danger || undefined}
            onSelect={(event) => {
              if (entry.keepOpen) event.preventDefault();
              entry.onSelect?.();
            }}
          >
            <ItemBody entry={entry} />
          </kit.Item>
        );
      })}
    </>
  );
}
