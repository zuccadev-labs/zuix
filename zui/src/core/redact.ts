// Enmascarado de datos sensibles para capturas y exportaciones: dominios, direcciones IP, correos o textos marcados
// se sustituyen por valores genéricos y deterministas (el mismo valor da siempre el mismo sustituto, así el diagrama
// sigue siendo coherente). Un interruptor global (`setRedaction`) lo activa en toda la página: los componentes
// `Redact` y los elementos `[data-sensitive]` lo escuchan. Sin documento al importar.

export type SensitiveKind = "auto" | "domain" | "ip" | "email" | "text";

export interface RedactOptions {
  /** Dominio que sustituye a los reales. Por defecto `example.com` (RFC 2606). */
  domain?: string;
  /** Sufijos que no se enmascaran (nombres internos). Por defecto `.internal`, `.local`, `.lan`, `.home.arpa`, `.localhost`. */
  keepSuffixes?: string[];
  /** Enmascarar también las IPv4 privadas (10/8, 172.16/12, 192.168/16). Por defecto no: no identifican a nadie. */
  privateIps?: boolean;
  /** Texto que sustituye a un `text`. Por defecto `••••••`. */
  mask?: string;
}

const KEEP = [".internal", ".local", ".lan", ".home.arpa", ".localhost", ".test", ".invalid", ".example"];
const DOMAIN = /\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62})\b/gi;
const IPV4 = /\b(25[0-5]|2[0-4]\d|1?\d?\d)\.(25[0-5]|2[0-4]\d|1?\d?\d)\.(25[0-5]|2[0-4]\d|1?\d?\d)\.(25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
// IPv6 (forma completa o abreviada con `::`): grupos hexadecimales con al menos dos `:`.
const IPV6 = /\b(?:[0-9a-f]{1,4}:){2,7}(?::|[0-9a-f]{1,4})(?::[0-9a-f]{1,4}){0,6}\b/gi;
const EMAIL = /\b[a-z0-9._%+-]{1,64}@((?:[a-z0-9-]{1,63}\.)+[a-z]{2,63})\b/gi;
const FILE_EXT = new Set(["js", "ts", "tsx", "css", "json", "md", "html", "png", "svg", "jpg", "yaml", "yml", "txt", "conf", "sh", "py"]);

/** Hash corto y estable (FNV-1a de 32 bits). */
export function stableHash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const isPrivateV4 = (a: number, b: number) =>
  a === 10 ||
  a === 127 ||
  (a === 172 && b >= 16 && b <= 31) ||
  (a === 192 && b === 168) ||
  (a === 169 && b === 254) ||
  (a === 100 && b >= 64 && b <= 127);
const isDocV4 = (a: number, b: number, c: number) =>
  (a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113);

/** Un dominio con su subdominio conservado y el resto sustituido (`app.mylab.net` → `app.example.com`). */
export function redactDomain(host: string, o: RedactOptions = {}): string {
  const lower = host.toLowerCase();
  const target = (o.domain ?? "example.com").toLowerCase();
  if ((o.keepSuffixes ?? KEEP).some((s) => lower === s.slice(1) || lower.endsWith(s))) return host;
  if (lower === target || lower.endsWith(`.${target}`)) return host;
  const labels = lower.split(".");
  // Un dominio de segundo nivel por país (`co.uk`, `com.au`) se quita entero con su registrable.
  const cc =
    labels.length >= 3 &&
    labels[labels.length - 1]!.length === 2 &&
    ["co", "com", "net", "org", "ac", "gov"].includes(labels[labels.length - 2]!);
  const keep = labels.slice(0, Math.max(0, labels.length - (cc ? 3 : 2)));
  return [...keep, target].join(".");
}

/** Una IPv4 pública → una de documentación (RFC 5737), estable por valor; las privadas se conservan salvo que se pida. */
export function redactIpv4(ip: string, o: RedactOptions = {}): string {
  const [a, b, c, d] = ip.split(".").map(Number) as [number, number, number, number];
  if (isDocV4(a, b, c)) return ip;
  if (isPrivateV4(a, b) && !o.privateIps) return ip;
  const nets = ["192.0.2", "198.51.100", "203.0.113"];
  const net = nets[stableHash(`${a}.${b}.${c}`) % 3]!;
  return `${net}.${d === 0 || d === 255 ? d : (stableHash(ip) % 253) + 1}`;
}

/** Una IPv6 → prefijo de documentación (RFC 3849) con un sufijo estable. */
export function redactIpv6(ip: string): string {
  const lower = ip.toLowerCase();
  if (lower.startsWith("2001:db8:") || lower.startsWith("fe80:") || lower === "::1") return ip;
  return `2001:db8::${(stableHash(lower) & 0xffff).toString(16)}`;
}

/** Trozos sin separadores: las expresiones de abajo solo ven palabras de longitud acotada (tiempo lineal). */
const TOKEN = /[^\s,;()<>"'`[\]{}|]+/g;
const MAX_TOKEN = 320;

function redactToken(token: string, kind: SensitiveKind, o: RedactOptions): string {
  if (token.length > MAX_TOKEN || (!token.includes(".") && !token.includes(":") && !token.includes("@"))) return token;
  let out = token;
  if (kind === "auto" || kind === "email") out = out.replace(EMAIL, (_m, host: string) => `user@${redactDomain(host, o)}`);
  if (kind === "auto" || kind === "ip") {
    out = out.replace(IPV4, (m) => redactIpv4(m, o));
    out = out.replace(IPV6, (m) => (m.includes("::") || m.split(":").length >= 4 ? redactIpv6(m) : m));
  }
  if (kind === "auto" || kind === "domain")
    out = out.replace(DOMAIN, (m: string, _host: string, offset: number, whole: string) => {
      // Lo que ya es un correo (enmascarado arriba) o parte de una IP no se toca; tampoco un nombre de archivo.
      if (whole[offset - 1] === "@" || /^[\d.]+$/.test(m)) return m;
      const tld = m.slice(m.lastIndexOf(".") + 1).toLowerCase();
      if (FILE_EXT.has(tld) && kind === "auto") return m;
      return redactDomain(m, o);
    });
  return out;
}

/**
 * Texto con los datos sensibles sustituidos. `kind` dice qué se busca: `auto` (dominios, IP y correos), uno solo, o
 * `text` (el texto entero es secreto y sale como máscara).
 */
export function redactText(text: string, kind: SensitiveKind = "auto", o: RedactOptions = {}): string {
  if (typeof text !== "string" || !text) return "";
  if (kind === "text") return o.mask ?? "••••••";
  return text.replace(TOKEN, (token) => redactToken(token, kind, o));
}

// Interruptor global. Estado del módulo; nada toca el documento hasta que alguien se suscribe.
let active = false;
let options: RedactOptions = {};
const listeners = new Set<() => void>();

/** Activa o desactiva el enmascarado en toda la página (y, opcionalmente, cambia las opciones). */
export function setRedaction(on: boolean, next?: RedactOptions): void {
  const changed = on !== active || (next !== undefined && JSON.stringify(next) !== JSON.stringify(options));
  active = on;
  if (next) options = { ...next };
  if (changed) for (const l of [...listeners]) l();
}

export const isRedacted = (): boolean => active;
export const redactionOptions = (): RedactOptions => options;

/** Aviso de cada cambio del interruptor. Devuelve la función que lo cancela. */
export function onRedactionChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
