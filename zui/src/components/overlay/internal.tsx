"use client";
// Piezas internas del grupo overlay: botón de cierre, botón de acción, tipos de las entradas de menú y el estado
// abierto/cerrado con disparador que comparten los diálogos.
import { useRef, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { useControllable } from "../../primitives/hooks";
import { slot } from "../../primitives/slot";
import { cx } from "../../cx";

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
  /** Destino: la entrada es un enlace (`<a href>`) que se abre en otra pestaña o se copia como cualquier enlace. */
  href?: string;
  /** Submenú. */
  items?: MenuEntry[];
}

/** Opción de encendido y apagado (`menuitemcheckbox`). Intro la cambia y cierra; Espacio la cambia y deja el menú abierto. */
export interface MenuCheckboxEntry {
  type: "checkbox";
  id: string;
  label: ReactNode;
  shortcut?: string;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

/** Opción de un grupo de radio (`menuitemradio`). */
export interface MenuRadioItem {
  value: string;
  label: ReactNode;
  shortcut?: string;
  disabled?: boolean;
}

/** Grupo de opciones excluyentes (`role="group"` con nombre); elegir cierra el menú. */
export interface MenuRadioGroupEntry {
  type: "radio-group";
  id: string;
  /** Nombre del grupo; se muestra como título encima de las opciones. */
  label: string;
  value: string;
  onValueChange?: (value: string) => void;
  items: MenuRadioItem[];
}

export type MenuEntry =
  | { type: "separator" }
  | { type: "label"; label: ReactNode }
  | MenuItemEntry
  | MenuCheckboxEntry
  | MenuRadioGroupEntry;

/**
 * Estado abierto/cerrado de una capa con disparador opcional. Devuelve el disparador ya conectado (clic, ref y
 * atributos ARIA) y su ref, a la que vuelve el foco al cerrar.
 */
export function useDisclosure(options: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactElement;
  popup?: "dialog" | "menu";
  id?: string;
}) {
  const [open, setOpen] = useControllable(options.open, options.defaultOpen ?? false, options.onOpenChange);
  const triggerRef = useRef<HTMLElement | null>(null);
  const trigger = options.trigger
    ? slot(options.trigger, {
        ref: triggerRef,
        "aria-haspopup": options.popup ?? "dialog",
        "aria-expanded": open,
        "aria-controls": open ? options.id : undefined,
        "data-state": open ? "open" : "closed",
        onClick: () => setOpen(!open),
      })
    : null;
  return { open, setOpen, trigger, triggerRef };
}
