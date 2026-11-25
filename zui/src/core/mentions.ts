// Menciones en un campo de texto: detectar el disparador (`@`, `#`) en la posición del cursor, sustituir lo escrito por
// el nombre elegido, y pasar de texto visible (`@Ana López`) a tokens (`<@u1>`) al enviar y de tokens a trozos al
// pintar. Puro.

import { fold, score } from "./search";

export interface MentionMatch {
  trigger: string;
  /** Lo escrito tras el disparador. */
  query: string;
  /** Índice del disparador y fin de lo escrito (exclusivo). */
  start: number;
  end: number;
}

export interface MentionItem {
  id: string;
  label: string;
  description?: string;
  avatar?: string;
}

/**
 * Disparador abierto justo antes del cursor: al principio o tras un espacio, sin espacios después y con hasta
 * `maxLength` caracteres. `null` si no hay ninguno.
 */
export function findTrigger(text: string, caret: number, triggers: readonly string[] = ["@"], maxLength = 32): MentionMatch | null {
  const end = Math.max(0, Math.min(caret, text.length));
  for (let i = end - 1; i >= 0 && end - i <= maxLength + 1; i--) {
    const ch = text[i]!;
    if (/\s/.test(ch)) return null;
    if (triggers.includes(ch)) {
      const before = i === 0 ? "" : text[i - 1]!;
      if (before && !/[\s([{"'“«]/.test(before)) return null;
      return { trigger: ch, query: text.slice(i + 1, end), start: i, end };
    }
  }
  return null;
}

/** Sustituye la mención en curso por `trigger + label` y un espacio. Devuelve el texto y la posición del cursor. */
export function insertMention(text: string, match: MentionMatch, item: MentionItem): { text: string; caret: number } {
  const inserted = `${match.trigger}${item.label} `;
  const rest = text.slice(match.end).replace(/^ /, "");
  const next = text.slice(0, match.start) + inserted + rest;
  return { text: next, caret: match.start + inserted.length };
}

/** Candidatos que coinciden con lo escrito (sin acentos ni mayúsculas), los mejores primero. */
export function filterMentions(items: readonly MentionItem[], query: string, limit = 8): MentionItem[] {
  const q = fold(query.trim());
  if (!q) return items.slice(0, limit);
  return items
    .map((item, i) => ({ item, i, s: Math.max(score(q, fold(item.label)), fold(item.id) === q ? 100 : 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.item);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Texto visible → texto con tokens: cada `@Label` de un elegido pasa a `<@id>` (`<#id>` con `#`). Los nombres largos
 * primero, para que «Ana López» no se quede en «Ana».
 */
export function encodeMentions(text: string, chosen: readonly MentionItem[], trigger = "@"): string {
  const sorted = [...new Map(chosen.map((c) => [c.id, c])).values()].sort((a, b) => b.label.length - a.label.length);
  let out = text;
  for (const item of sorted) {
    const re = new RegExp(`(^|[\\s([{"'“«])${escapeRe(trigger + item.label)}(?![\\p{L}\\p{N}_])`, "gu");
    out = out.replace(re, (_, pre: string) => `${pre}<${trigger}${item.id}>`);
  }
  return out;
}

export type MentionPart = { type: "text"; text: string } | { type: "mention"; trigger: string; id: string; label: string };

/** Texto con tokens → trozos: el nombre lo da `resolve` (o el id si no lo conoce). */
export function mentionParts(text: string, resolve: (id: string, trigger: string) => string | undefined = () => undefined): MentionPart[] {
  const parts: MentionPart[] = [];
  let last = 0;
  for (const m of text.matchAll(/<([@#])([\w.:-]+)>/g)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ type: "text", text: text.slice(last, start) });
    const trigger = m[1]!;
    const id = m[2]!;
    parts.push({ type: "mention", trigger, id, label: resolve(id, trigger) ?? id });
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}
