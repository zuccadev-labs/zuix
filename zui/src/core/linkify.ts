// Enlaces en texto plano: URL http(s), `www.` y correos, como trozos (nunca como marcado). La puntuación final que no
// forma parte de la URL (punto, coma, paréntesis sin abrir) se queda fuera. Un enlace solo sale si su destino pasa
// `safeHref`: http, https o mailto, leído con el analizador de URL y no con expresiones. Puro.

export type TextPart = { type: "text"; text: string } | { type: "link"; text: string; href: string };

const SAFE = new Set(["http:", "https:", "mailto:"]);

/** Destino seguro de un enlace (http, https, mailto) o `null`. `javascript:`, `data:` y lo que no se analiza, fuera. */
export function safeHref(raw: string | null | undefined, protocols: ReadonlySet<string> = SAFE): string | null {
  if (!raw) return null;
  const value = raw.trim();
  // Sin caracteres de control ni espacios dentro: un destino así no lo escribe nadie a propósito.
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code < 33 || code === 127) return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!protocols.has(url.protocol)) return null;
  if (url.protocol !== "mailto:" && !url.hostname) return null;
  return url.href;
}

// Candidatos: esquema http(s), «www.» o un correo. El final se recorta después.
const CANDIDATE = /\b(?:https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/gi;
const TRAILING = /[.,;:!?'"’”»]+$/;

/** Quita la puntuación final y los paréntesis de cierre que no se abrieron dentro de la URL. */
function trimCandidate(raw: string): string {
  let s = raw;
  for (;;) {
    const before = s;
    s = s.replace(TRAILING, "");
    if (s.endsWith(")")) {
      const open = (s.match(/\(/g) ?? []).length;
      const close = (s.match(/\)/g) ?? []).length;
      if (close > open) s = s.slice(0, -1);
    }
    if (s === before) return s;
  }
}

/** Divide `text` en trozos de texto y de enlace. Concatenar los `text` devuelve el original. */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  const push = (t: string) => {
    if (!t) return;
    const prev = parts[parts.length - 1];
    if (prev?.type === "text") prev.text += t;
    else parts.push({ type: "text", text: t });
  };
  for (const m of text.matchAll(CANDIDATE)) {
    const start = m.index ?? 0;
    const shown = trimCandidate(m[0]);
    if (!shown) continue;
    const email = !/^(?:https?:\/\/|www\.)/i.test(shown);
    const href = safeHref(email ? `mailto:${shown}` : /^www\./i.test(shown) ? `https://${shown}` : shown);
    if (!href || (email && !shown.includes("@"))) continue;
    push(text.slice(last, start));
    parts.push({ type: "link", text: shown, href });
    last = start + shown.length;
  }
  push(text.slice(last));
  return parts;
}

/** Dominio legible de un enlace (`example.com`), para vistas previas y fuentes. */
export function domainOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
