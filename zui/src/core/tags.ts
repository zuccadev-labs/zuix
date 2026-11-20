// Etiquetas de TagsInput: partir lo escrito o pegado por delimitadores y decidir qué entra. Sin DOM ni efectos.

export interface TagRules {
  /** Máximo de etiquetas. */
  max?: number;
  /** Longitud máxima de cada etiqueta (en caracteres). */
  maxLength?: number;
  /** Admite repetidas (por defecto no; la comparación ignora mayúsculas). */
  allowDuplicates?: boolean;
  /** Limpia cada etiqueta antes de validarla; por defecto quita los espacios de los extremos. */
  sanitize?: (tag: string) => string;
  /** Devuelve false para rechazar una etiqueta. */
  validate?: (tag: string, current: ReadonlyArray<string>) => boolean;
}

export type TagRejection = "empty" | "duplicate" | "max" | "length" | "invalid";

export interface TagResult {
  value: string[];
  added: string[];
  rejected: Array<{ tag: string; reason: TagRejection }>;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Parte un texto por los delimitadores y por saltos de línea (un pegado de una lista). */
export function splitTags(text: string, delimiters: ReadonlyArray<string> = [","]): string[] {
  const chars = [...delimiters.filter(Boolean), "\n", "\r", "\t"];
  return text.split(new RegExp(chars.map(escapeRe).join("|"))).filter((part) => part.trim() !== "");
}

/** Añade `incoming` a `current` con las reglas. Las rechazadas no cortan las siguientes. */
export function addTags(current: ReadonlyArray<string>, incoming: ReadonlyArray<string>, rules: TagRules = {}): TagResult {
  const clean = rules.sanitize ?? ((tag: string) => tag.trim());
  const value = [...current];
  const added: string[] = [];
  const rejected: TagResult["rejected"] = [];
  for (const raw of incoming) {
    const tag = clean(raw);
    const reason: TagRejection | null = !tag
      ? "empty"
      : rules.max !== undefined && value.length >= rules.max
        ? "max"
        : rules.maxLength !== undefined && [...tag].length > rules.maxLength
          ? "length"
          : !rules.allowDuplicates && value.some((t) => t.toLocaleLowerCase() === tag.toLocaleLowerCase())
            ? "duplicate"
            : rules.validate && !rules.validate(tag, value)
              ? "invalid"
              : null;
    if (reason) rejected.push({ tag: tag || raw, reason });
    else {
      value.push(tag);
      added.push(tag);
    }
  }
  return { value, added, rejected };
}
