// Piezas de árbol (core/vnode) que comparten los selectores de árbol de formulario (Cascader, TreeSelect,
// QuarterPicker): la pieza de un valor elegido con su botón de quitar y los campos nativos ocultos que llevan el valor
// al formulario y dan la validación `required` del navegador. Sin documento.
import { h, icon, type VEl } from "./vnode";

export const PICKER_ICON = { sm: 14, md: 16, lg: 18 } as const;

/** Pieza de un valor elegido (`z-tags__tag`), con botón de quitar si no está deshabilitado. */
export function chip(key: string, text: string, title: string, removeLabel: string, size: "sm" | "md" | "lg", disabled?: boolean): VEl {
  return h(
    "span",
    { key, class: "z-tags__tag", "data-chip": key, title },
    h("span", { class: "z-tags__text" }, text),
    disabled
      ? null
      : h(
          "button",
          { type: "button", class: "z-tags__remove", tabindex: -1, "aria-label": removeLabel, title: removeLabel, "data-remove": key },
          icon("x-mark", PICKER_ICON[size] - 2),
        ),
  );
}

/**
 * Campos nativos ocultos (`.z-native-input`, un `type="text"` fuera de la vista y del árbol de accesibilidad): uno por
 * valor con el mismo nombre, o uno vacío. El primero lleva `required`. Un `type="hidden"` no participaría en la validación.
 */
export function nativeInputs(name: string | undefined, values: ReadonlyArray<string>, required?: boolean, disabled?: boolean): VEl[] {
  return (values.length ? values : [""]).map((v, i) =>
    h("input", {
      key: `native-${i}-${v}`,
      type: "text",
      class: "z-native-input",
      "aria-hidden": "true",
      tabindex: -1,
      name,
      value: v,
      required: i === 0 && required ? true : undefined,
      disabled: disabled || undefined,
      "data-native": "",
    }),
  );
}

/** Escribe en los campos nativos el valor del estado (el árbol no pisa el `value` de un campo ya pintado). */
export function syncNatives(root: HTMLElement, values: ReadonlyArray<string>): void {
  root.querySelectorAll<HTMLInputElement>("[data-native]").forEach((native, i) => {
    const next = values[i] ?? "";
    if (native.value !== next) native.value = next;
  });
}
