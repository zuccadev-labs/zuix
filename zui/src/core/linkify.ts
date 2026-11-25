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

const MEDIA = new Set(["http:", "https:", "blob:"]);

/**
 * Fuente segura de una imagen (`<img src>`) o `null`. Vale una ruta relativa (`/a.png`, `fotos/a.png`), http(s),
 * `blob:` (una foto recién elegida) y `data:image/…`. Fuera `javascript:` y cualquier otro esquema, los caracteres
 * de control y los de marcado (`<`, `>`, `"`), que en una URL bien formada van codificados.
 */
export function safeSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || /[<>"]/.test(value)) return null;
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code === 127) return null;
  }
  let url: URL;
  try {
    // Una ruta relativa se resuelve contra una base cualquiera de http: lo que se mira es si trae su propio esquema.
    url = new URL(value, "https://base.invalid/");
  } catch {
    return null;
  }
  if (url.protocol === "data:") return /^data:image\//i.test(value) ? value : null;
  return MEDIA.has(url.protocol) ? value : null;
}

// Candidatos: esquema http(s), «www.» o un correo. El final se recorta después. La parte local del correo va acotada a
// 64 caracteres (el máximo de RFC 5321): sin cota, un texto como «a.a.a.…» sin `@` se recorría entero desde cada
// palabra y tardaba en cuadrático.
const CANDIDATE = /\b(?:https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|[\w.+-]{1,64}@[\w-]+(?:\.[\w-]+)+)/gi;
// Puntuación final que no forma parte de la URL. Se recorta a mano, de atrás adelante: una expresión `[…]+$` vuelve
// a recorrer la tanda desde cada posición y tarda en cuadrático con muchos signos seguidos.
const TRAILING = new Set([".", ",", ";", ":", "!", "?", "'", '"', "’", "”", "»"]);

/** Quita la puntuación final y los paréntesis de cierre que no se abrieron dentro de la URL. */
function trimCandidate(raw: string): string {
  let open = 0;
  let close = 0;
  for (const ch of raw) {
    if (ch === "(") open += 1;
    else if (ch === ")") close += 1;
  }
  let end = raw.length;
  for (;;) {
    if (end > 0 && TRAILING.has(raw[end - 1]!)) end -= 1;
    else if (end > 0 && raw[end - 1] === ")" && close > open) {
      end -= 1;
      close -= 1;
    } else return raw.slice(0, end);
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
