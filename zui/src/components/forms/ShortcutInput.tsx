"use client";
import type { Ref } from "react";
import { shortcutInputWidget, type ShortcutInputLabels, type ShortcutInputProps as CoreProps } from "../../core/shortcut-widget";
import { useWidget } from "../agenda/vtree";

export type { ShortcutInputLabels };

export interface ShortcutInputProps extends CoreProps {
  /** Atajo nuevo en forma canónica («Mod+Shift+K»), o "" al borrarlo. */
  onValueChange?: (value: string) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Captura de atajos de teclado: se pulsa para grabar y la combinación queda guardada de forma portable
 * («Mod» es ⌘ en Apple y Ctrl en el resto) y se muestra con las teclas de la plataforma.
 */
export function ShortcutInput({ onValueChange, id, className, ref, ...props }: ShortcutInputProps) {
  return useWidget(shortcutInputWidget, props, {
    id,
    className,
    ref,
    handlers: { change: onValueChange ? (d: { value: string }) => onValueChange(d.value) : undefined },
  });
}
