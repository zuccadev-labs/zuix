// Mensajes de validación por `ValidityState` y foco al primer error. La lógica de qué mensaje toca es pura; las dos
// funciones que reciben un formulario tocan el documento solo cuando se las llama.

/** Motivos de `ValidityState`, en el orden en que se informa de ellos (el primero que falla gana). */
export const VALIDITY_KEYS = [
  "valueMissing",
  "badInput",
  "typeMismatch",
  "patternMismatch",
  "tooShort",
  "tooLong",
  "rangeUnderflow",
  "rangeOverflow",
  "stepMismatch",
  "customError",
] as const;

export type ValidityKey = (typeof VALIDITY_KEYS)[number];

/** Mensaje por motivo; el que falte usa el del navegador (`validationMessage`). */
export type ValidityMessages = Partial<Record<ValidityKey, string>>;

type ValidityLike = Partial<Record<ValidityKey | "valid", boolean>>;

/** Primer motivo por el que el valor no es válido, o `null` si lo es. */
export function validityKey(validity: ValidityLike): ValidityKey | null {
  if (validity.valid) return null;
  return VALIDITY_KEYS.find((key) => validity[key]) ?? null;
}

/** Mensaje para el estado de validez: el propio del motivo o el del navegador. `null` si es válido. */
export function validityMessage(validity: ValidityLike, messages: ValidityMessages = {}, fallback = ""): string | null {
  const key = validityKey(validity);
  if (!key) return null;
  return messages[key] ?? (fallback || "Invalid value");
}

/** Clave de atributo (`data-msg-value-missing`) de un motivo, para el modo DOM. */
export const messageAttribute = (key: ValidityKey) => `data-msg-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const isControl = (el: Element): el is Control =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;

/**
 * Elemento que debe recibir el foco por un control: el propio control o, si es el campo nativo oculto de un control
 * propio (`.z-native-input`, `type="hidden"`), el control visible que lo acompaña.
 */
export function focusTargetOf(control: Element): HTMLElement | null {
  if (!control.matches(".z-native-input, [type='hidden']")) return control as HTMLElement;
  const host = control.parentElement;
  return (
    host?.querySelector<HTMLElement>(
      "[role='checkbox'], [role='radio'], [role='switch'], [role='combobox'], button, input:not([type='hidden']):not(.z-native-input)",
    ) ?? null
  );
}

/** Primer control no válido de un formulario, en orden del documento. */
export function firstInvalid(form: HTMLFormElement): Control | null {
  for (const el of form.elements) if (isControl(el) && el.willValidate && !el.validity.valid) return el;
  return null;
}

/**
 * Comprueba el formulario (emite `invalid` en cada control que falla, así los campos muestran su mensaje) y, si
 * algo falla, lleva el foco al primer error. Devuelve si el formulario es válido.
 */
export function validateForm(form: HTMLFormElement): boolean {
  if (form.checkValidity()) return true;
  const first = firstInvalid(form);
  const target = first ? focusTargetOf(first) : null;
  target?.focus();
  return false;
}
