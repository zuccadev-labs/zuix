// Máscaras de entrada (MaskedInput) sin documento: un patrón de ranuras (`9` cifra, `a` letra, `*` letra o cifra, `\`
// escapa) o una función que elige el patrón según lo tecleado (la tarjeta de 15 o de 16 cifras). El valor crudo son
// solo los caracteres que ocupan ranuras; el formateado añade los literales. Las ediciones (teclear, pegar, borrar,
// cortar) se calculan sobre el crudo y devuelven el texto nuevo y dónde queda el cursor, así el cursor no salta al
// final al teclear en medio. Lo comparten el binding de React y el modo DOM (./mask-control).

/** Ranura propia: qué carácter admite y cómo se guarda (por ejemplo, en mayúsculas). */
export interface MaskTokenDef {
  test: RegExp | ((ch: string) => boolean);
  transform?: (ch: string) => string;
}

export type MaskPattern = string | ((raw: string) => string);

export interface MaskSpec {
  pattern: MaskPattern;
  /** Ranuras además de (o en lugar de) `9`, `a` y `*`. */
  tokens?: Record<string, MaskTokenDef>;
  /** Mayúsculas o minúsculas para lo que se guarda. */
  transform?: "uppercase" | "lowercase";
}

export const MASK_TOKENS: Record<string, MaskTokenDef> = {
  "9": { test: /^[0-9]$/ },
  a: { test: /^\p{L}$/u },
  "*": { test: /^[\p{L}\p{N}]$/u },
};

/** Tarjeta: 15 cifras en grupos 4-6-5 si empieza por 34 o 37 (American Express); si no, 16 en grupos de 4. */
export const cardPattern = (raw: string) => (/^3[47]/.test(raw) ? "9999 999999 99999" : "9999 9999 9999 9999");

export type MaskPreset = "phone" | "card" | "date" | "time" | "plate" | "postal";

export const MASK_PRESETS: Record<MaskPreset, MaskSpec & { hint?: string; inputMode: "numeric" | "text"; autoComplete?: string }> = {
  phone: { pattern: "(999) 999-9999", inputMode: "numeric", autoComplete: "tel-national" },
  card: { pattern: cardPattern, inputMode: "numeric", autoComplete: "cc-number" },
  date: { pattern: "99/99/9999", hint: "MM/DD/YYYY", inputMode: "numeric" },
  time: { pattern: "99:99", hint: "HH:MM", inputMode: "numeric" },
  plate: { pattern: "aaa-9999", transform: "uppercase", hint: "ABC-1234", inputMode: "text" },
  postal: { pattern: "99999", inputMode: "numeric", autoComplete: "postal-code" },
};

type Slot = { literal: string } | { token: MaskTokenDef };

const isToken = (slot: Slot): slot is { token: MaskTokenDef } => "token" in slot;

/** Ranuras de un patrón. Un carácter que no es ranura es literal; `\` hace literal al siguiente. */
export function compile(pattern: string, tokens: Record<string, MaskTokenDef> = {}): Slot[] {
  const table = { ...MASK_TOKENS, ...tokens };
  const out: Slot[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === "\\" && i + 1 < pattern.length) out.push({ literal: pattern[++i]! });
    else if (Object.hasOwn(table, ch)) out.push({ token: table[ch]! });
    else out.push({ literal: ch });
  }
  return out;
}

const accepts = (def: MaskTokenDef, ch: string) => (typeof def.test === "function" ? def.test(ch) : def.test.test(ch));

function cased(spec: MaskSpec, def: MaskTokenDef, ch: string): string {
  const own = def.transform ? def.transform(ch) : ch;
  return spec.transform === "uppercase" ? own.toUpperCase() : spec.transform === "lowercase" ? own.toLowerCase() : own;
}

const patternOf = (spec: MaskSpec, raw: string) => (typeof spec.pattern === "function" ? spec.pattern(raw) : spec.pattern);

/** Recorre `text` contra las ranuras desde la ranura de token número `from`: lo que no cabe se descarta. */
function feed(spec: MaskSpec, slots: Slot[], text: string, from: number): string {
  const tokens = slots.filter(isToken);
  let at = from;
  let out = "";
  for (const ch of text) {
    const slot = tokens[at];
    if (!slot) break;
    if (accepts(slot.token, ch)) {
      out += cased(spec, slot.token, ch);
      at++;
    }
  }
  return out;
}

/** Caracteres de `text` que caben en las ranuras, en orden (pegar «(555) 123-4567» o «5551234567» da lo mismo). */
export function extractRaw(spec: MaskSpec, text: string): string {
  const first = feed(spec, compile(patternOf(spec, ""), spec.tokens), text, 0);
  const slots = compile(patternOf(spec, first), spec.tokens);
  return feed(spec, slots, text, 0);
}

/** Cuántas ranuras tiene el patrón para ese crudo. */
export const capacity = (spec: MaskSpec, raw: string) => compile(patternOf(spec, raw), spec.tokens).filter(isToken).length;

export interface Masked {
  /** Texto con los literales. Un literal solo aparece si le sigue un carácter tecleado (o si va al principio). */
  value: string;
  raw: string;
  /** Posición en `value` de cada carácter del crudo. */
  positions: number[];
  /** Están todas las ranuras ocupadas. */
  complete: boolean;
}

/** Formatea un crudo (lo que no quepa se recorta). */
export function applyMask(spec: MaskSpec, rawInput: string): Masked {
  const slots = compile(patternOf(spec, rawInput), spec.tokens);
  const raw = feed(spec, slots, rawInput, 0);
  let value = "";
  let used = 0;
  const positions: number[] = [];
  let pending = "";
  for (const slot of slots) {
    if (used >= raw.length) break;
    if (isToken(slot)) {
      value += pending;
      pending = "";
      positions.push(value.length);
      value += raw[used++];
    } else pending += slot.literal;
  }
  const total = slots.filter(isToken).length;
  return { value, raw, positions, complete: total > 0 && raw.length === total };
}

/** Texto de ayuda del formato: las ranuras como `_` («(___) ___-____»). */
export function maskTemplate(spec: MaskSpec, placeholder = "_"): string {
  return compile(patternOf(spec, ""), spec.tokens)
    .map((slot) => (isToken(slot) ? placeholder : slot.literal))
    .join("");
}

/** Caracteres del crudo antes de la posición `pos` del texto formateado. */
const rawBefore = (positions: number[], pos: number) => positions.filter((p) => p < pos).length;

/** Posición del cursor tras `count` caracteres del crudo. */
function caretAfter(masked: Masked, count: number): number {
  if (count <= 0) {
    // Sin nada delante: el cursor va tras los literales del principio (si se pintan).
    return masked.positions[0] ?? 0;
  }
  const at = masked.positions[Math.min(count, masked.positions.length) - 1];
  return at === undefined ? masked.value.length : at + 1;
}

export type MaskEdit =
  | { type: "insert"; text: string }
  | { type: "deleteBackward" }
  | { type: "deleteForward" }
  | { type: "deleteWordBackward" }
  | { type: "deleteWordForward" };

export interface MaskEditResult extends Masked {
  caret: number;
  /** Nada de lo tecleado cabía (una letra en una ranura de cifra): el texto no cambia. */
  rejected: boolean;
}

/**
 * Aplica una edición al texto `value` con la selección `[start, end)`. Calcula sobre el crudo: lo seleccionado se
 * sustituye, lo insertado entra desde la ranura del cursor y lo que había detrás se recoloca en las ranuras siguientes.
 */
export function editMask(spec: MaskSpec, value: string, start: number, end: number, edit: MaskEdit): MaskEditResult {
  const current = applyMask(spec, extractRaw(spec, value));
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.max(lo, Math.max(start, end));
  let rs = rawBefore(current.positions, lo);
  let re = rawBefore(current.positions, hi);
  const raw = current.raw;
  const done = (nextRaw: string, caretCount: number, rejected = false): MaskEditResult => {
    const masked = applyMask(spec, nextRaw);
    return { ...masked, caret: caretAfter(masked, Math.min(caretCount, masked.raw.length)), rejected };
  };
  if (edit.type === "insert") {
    const head = raw.slice(0, rs);
    const slots = compile(patternOf(spec, head + edit.text), spec.tokens);
    const added = feed(spec, slots, edit.text, rs);
    if (!added && edit.text) return { ...current, caret: lo, rejected: true };
    const next = feed(spec, slots, head + added + raw.slice(re), 0);
    return done(next, rs + added.length);
  }
  if (rs === re) {
    if (edit.type === "deleteBackward") rs = Math.max(0, rs - 1);
    else if (edit.type === "deleteForward") re = Math.min(raw.length, re + 1);
    else if (edit.type === "deleteWordBackward") rs = groupStart(current, rs);
    else re = groupEnd(current, re);
  }
  if (rs === re) return { ...current, caret: lo, rejected: false };
  // Al borrar, el cursor va donde estaba lo borrado (el carácter que ocupa ahora esa ranura); hacia delante no se mueve.
  const masked = applyMask(spec, raw.slice(0, rs) + raw.slice(re));
  const forward = edit.type === "deleteForward" || edit.type === "deleteWordForward";
  const caret = forward ? Math.min(lo, masked.value.length) : (masked.positions[rs] ?? masked.value.length);
  return { ...masked, caret, rejected: false };
}

/** Primer carácter del grupo (sin literales entre medias) que acaba antes de `count`. */
function groupStart(masked: Masked, count: number): number {
  let i = count - 1;
  while (i > 0 && masked.positions[i - 1] === masked.positions[i]! - 1) i--;
  return Math.max(0, i);
}

function groupEnd(masked: Masked, count: number): number {
  let i = count;
  while (i < masked.positions.length - 1 && masked.positions[i + 1] === masked.positions[i]! + 1) i++;
  return Math.min(masked.positions.length, i + 1);
}

/**
 * Vuelve a formatear un texto que cambió sin pasar por `editMask` (composición de un IME, autocompletado, teclados
 * de móvil que no permiten cancelar `beforeinput`): conserva el cursor tras el mismo número de caracteres del crudo.
 */
export function reformat(spec: MaskSpec, text: string, caret: number): MaskEditResult {
  const masked = applyMask(spec, extractRaw(spec, text));
  const before = extractRaw(spec, text.slice(0, caret)).length;
  return { ...masked, caret: caretAfter(masked, before), rejected: false };
}

/** `inputType` de `beforeinput` → edición. `null`: no se atiende (se deja al navegador y se reformatea después). */
export function editFor(inputType: string, data: string | null): MaskEdit | null {
  switch (inputType) {
    case "insertText":
    case "insertFromPaste":
    case "insertFromDrop":
    case "insertReplacementText":
    case "insertFromYank":
      return { type: "insert", text: data ?? "" };
    case "deleteContentBackward":
    case "deleteByCut":
    case "deleteByDrag":
      return { type: "deleteBackward" };
    case "deleteContentForward":
      return { type: "deleteForward" };
    case "deleteWordBackward":
    case "deleteSoftLineBackward":
    case "deleteHardLineBackward":
      return { type: "deleteWordBackward" };
    case "deleteWordForward":
    case "deleteSoftLineForward":
    case "deleteHardLineForward":
      return { type: "deleteWordForward" };
    default:
      return null;
  }
}

/** Máscara de un preset o de un patrón; `null` si no hay ninguno. */
export function resolveMask(
  mask: MaskPreset | MaskSpec | string | ((raw: string) => string) | null | undefined,
): (MaskSpec & { hint?: string; inputMode?: "numeric" | "text"; autoComplete?: string }) | null {
  if (!mask) return null;
  if (typeof mask === "string") return Object.hasOwn(MASK_PRESETS, mask) ? MASK_PRESETS[mask as MaskPreset] : { pattern: mask };
  if (typeof mask === "function") return { pattern: mask };
  return mask;
}

/** Teclado en pantalla adecuado: numérico si todas las ranuras del patrón vacío son cifras. */
export function maskInputMode(spec: MaskSpec): "numeric" | "text" {
  const slots = compile(patternOf(spec, ""), spec.tokens).filter(isToken);
  return slots.length > 0 && slots.every((slot) => slot.token === MASK_TOKENS["9"]) ? "numeric" : "text";
}
