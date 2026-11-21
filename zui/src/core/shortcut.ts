// ShortcutInput: atajos de teclado normalizados y portables. El valor guardado usa `Mod` para la tecla principal de
// la plataforma (⌘ en Apple, Ctrl en el resto): «Mod+Shift+K» funciona igual en los dos. Orden fijo de modificadores
// (Mod, Ctrl, Alt, Shift, Meta), tecla por su posición física cuando es una letra o un dígito (no cambia con Alt ni con
// la distribución), nombres legibles para mostrar y el formato de `aria-keyshortcuts`. Sin documento.

export interface KeyLike {
  key: string;
  code?: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export interface Shortcut {
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  /** Tecla principal normalizada (`K`, `7`, `ArrowUp`, `Space`, `F5`, `/`…), o "" si solo hay modificadores. */
  key: string;
}

const MODIFIER_KEYS = new Set(["Control", "Alt", "AltGraph", "Shift", "Meta", "OS", "Hyper", "Super", "Fn", "CapsLock"]);

/** Plataforma de Apple a partir de `navigator` (userAgentData o platform). */
export function isApplePlatform(nav?: { platform?: string; userAgentData?: { platform?: string } } | null): boolean {
  const p = nav?.userAgentData?.platform || nav?.platform || "";
  return /mac|iphone|ipad|ipod/i.test(p);
}

/** Tecla principal de un evento: letras y dígitos por su código físico; el resto por su nombre. */
export function keyName(event: Pick<KeyLike, "key" | "code">): string {
  const code = event.code ?? "";
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
  const key = event.key;
  if (key === " " || code === "Space") return "Space";
  if (key === "Esc") return "Escape";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/**
 * Atajo de un evento de teclado. En Apple, ⌘ es `Mod` y Ctrl se conserva como `Ctrl`; en el resto, Ctrl es `Mod` y
 * la tecla de sistema es `Meta`. Con solo modificadores, `key` queda vacía.
 */
export function shortcutFromEvent(event: KeyLike, apple: boolean): Shortcut {
  const key = MODIFIER_KEYS.has(event.key) ? "" : keyName(event);
  return {
    mod: apple ? event.metaKey : event.ctrlKey,
    ctrl: apple ? event.ctrlKey : false,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: apple ? false : event.metaKey,
    key,
  };
}

const ORDER: ReadonlyArray<[keyof Shortcut, string]> = [
  ["mod", "Mod"],
  ["ctrl", "Ctrl"],
  ["alt", "Alt"],
  ["shift", "Shift"],
  ["meta", "Meta"],
];

/** Cadena canónica («Mod+Shift+K»). */
export function formatShortcutValue(s: Shortcut): string {
  return [...ORDER.filter(([k]) => s[k]).map(([, name]) => name), ...(s.key ? [s.key] : [])].join("+");
}

/** Lee una cadena de atajo («mod+shift+k», «Ctrl+Alt+Delete», «Meta+Space»): sin distinguir mayúsculas. `null` si no vale. */
export function parseShortcut(value: string): Shortcut | null {
  const parts = String(value ?? "")
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const s: Shortcut = { mod: false, ctrl: false, alt: false, shift: false, meta: false, key: "" };
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "mod" || lower === "cmdorctrl") s.mod = true;
    else if (lower === "ctrl" || lower === "control") s.ctrl = true;
    else if (lower === "alt" || lower === "option") s.alt = true;
    else if (lower === "shift") s.shift = true;
    else if (lower === "meta" || lower === "cmd" || lower === "command" || lower === "win" || lower === "super") s.meta = true;
    else if (s.key) return null;
    else s.key = part.length === 1 ? part.toUpperCase() : part[0]!.toUpperCase() + part.slice(1);
  }
  return s.key ? s : null;
}

/** Normaliza una cadena de atajo a la forma canónica (o "" si no vale). */
export const normalizeShortcut = (value: string) => {
  const s = parseShortcut(value);
  return s ? formatShortcutValue(s) : "";
};

const SYMBOLS: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Enter: "↵",
  Backspace: "⌫",
  Delete: "⌦",
  Escape: "Esc",
  Tab: "⇥",
  Space: "Space",
  PageUp: "PgUp",
  PageDown: "PgDn",
};

/** Teclas para mostrar, en el orden de la plataforma: ⌃⌥⇧⌘K en Apple; Ctrl+Alt+Shift+Win+K en el resto. */
export function shortcutLabels(s: Shortcut, apple: boolean): string[] {
  const key = s.key ? (SYMBOLS[s.key] ?? s.key) : "";
  if (apple) {
    // Orden de los menús de macOS: Control, Opción, Mayúsculas, Comando.
    const mods = [s.ctrl && "⌃", s.alt && "⌥", s.shift && "⇧", (s.mod || s.meta) && "⌘"].filter(Boolean) as string[];
    return key ? [...mods, key] : mods;
  }
  const mods = [(s.mod || s.ctrl) && "Ctrl", s.alt && "Alt", s.shift && "Shift", s.meta && "Win"].filter(Boolean) as string[];
  return key ? [...mods, key] : mods;
}

const SPOKEN: Record<string, string> = {
  "⌃": "Control",
  "⌥": "Option",
  "⇧": "Shift",
  "⌘": "Command",
  "↑": "Up",
  "↓": "Down",
  "←": "Left",
  "→": "Right",
  "↵": "Enter",
  "⌫": "Backspace",
  "⌦": "Delete",
  "⇥": "Tab",
};

/** El atajo en palabras («Command Shift K»), para el nombre accesible y los anuncios. */
export const shortcutSpoken = (s: Shortcut, apple: boolean) =>
  shortcutLabels(s, apple)
    .map((k) => SPOKEN[k] ?? k)
    .join(" ");

/** Valor de `aria-keyshortcuts` («Meta+Shift+K» en Apple, «Control+Shift+K» en el resto). */
export function ariaKeyshortcuts(s: Shortcut, apple: boolean): string {
  const mods = [
    (apple ? s.ctrl : s.mod || s.ctrl) && "Control",
    s.alt && "Alt",
    s.shift && "Shift",
    (apple ? s.mod || s.meta : s.meta) && "Meta",
  ].filter(Boolean) as string[];
  const key = s.key === "Space" ? "Space" : s.key;
  return [...mods, key].join("+");
}

/** ¿El evento es este atajo? (Para que la aplicación lo escuche con el mismo valor guardado.) */
export function matchesShortcut(event: KeyLike, value: string | Shortcut, apple: boolean): boolean {
  const want = typeof value === "string" ? parseShortcut(value) : value;
  if (!want) return false;
  return formatShortcutValue(shortcutFromEvent(event, apple)) === formatShortcutValue(want);
}

/** Un atajo vale si tiene tecla y al menos un modificador distinto de Mayúsculas, salvo las teclas de función. */
export function isCompleteShortcut(s: Shortcut, requireModifier = true): boolean {
  if (!s.key) return false;
  if (!requireModifier || /^F([1-9]|1[0-9]|2[0-4])$/.test(s.key)) return true;
  return s.mod || s.ctrl || s.alt || s.meta;
}
