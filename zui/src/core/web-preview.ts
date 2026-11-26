// Vista previa web (WebPreview): normalizar lo que se escribe en la barra de dirección (solo http y https; sin esquema
// se supone https), el historial propio de la barra (atrás y adelante entre las direcciones visitadas desde ella: el
// historial de un iframe de otro origen no se puede leer) y el atributo `sandbox` con sus permisos conocidos. Puro.

/** Dirección válida para la vista previa, o `null`. Sin esquema se supone `https://`; otros esquemas no pasan. */
export function normalizeUrl(input: string): string | null {
  const text = (input ?? "").trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text.replace(/^\/\//, "")}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Dirección para mostrar en la barra: sin la barra final de una raíz. */
export const displayUrl = (href: string) => href.replace(/^(https?:\/\/[^/?#]+)\/$/, "$1");

export interface UrlHistory {
  entries: readonly string[];
  index: number;
}

/** Visita `url`: corta lo que hubiera por delante y la añade (no repite la actual). */
export function visit(h: UrlHistory, url: string): UrlHistory {
  const current = h.entries[h.index];
  if (current === url) return h;
  const entries = [...h.entries.slice(0, h.index + 1), url];
  return { entries, index: entries.length - 1 };
}

/** Atrás (`-1`) o adelante (`+1`), si se puede. */
export function travel(h: UrlHistory, delta: -1 | 1): UrlHistory {
  const index = h.index + delta;
  return index < 0 || index >= h.entries.length ? h : { entries: h.entries, index };
}

export const canTravel = (h: UrlHistory, delta: -1 | 1) => h.index + delta >= 0 && h.index + delta < h.entries.length;

/** Permisos de `sandbox` que se aceptan; uno desconocido se descarta. */
export const SANDBOX_TOKENS: readonly string[] = [
  "allow-downloads",
  "allow-forms",
  "allow-modals",
  "allow-orientation-lock",
  "allow-pointer-lock",
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-presentation",
  "allow-same-origin",
  "allow-scripts",
  "allow-storage-access-by-user-activation",
];

/** Valor de `sandbox`: los permisos conocidos, sin repetir. Vacío es el más restrictivo. */
export function sandboxValue(tokens: string | readonly string[] | undefined, fallback = "allow-scripts allow-forms"): string {
  const list = tokens === undefined ? fallback.split(/\s+/) : typeof tokens === "string" ? tokens.split(/\s+/) : [...tokens];
  return [...new Set(list.filter((t) => SANDBOX_TOKENS.includes(t)))].join(" ");
}
