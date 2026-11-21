// DownloadTrigger: convierte el contenido (texto, Blob o una función, también asíncrona) en un Blob con su tipo y
// lo descarga con un enlace `download` temporal. `mimeFromName` es puro; `downloadBlob` toca el documento al llamarse.

export type DownloadData = string | Blob | ArrayBuffer | Uint8Array;
export type DownloadSource = DownloadData | (() => DownloadData | Promise<DownloadData>);

const TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  json: "application/json",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  ics: "text/calendar",
  xml: "application/xml",
  zip: "application/zip",
};

/** Tipo MIME por la extensión del nombre (`application/octet-stream` si no se conoce). */
export function mimeFromName(name: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return (ext && TYPES[ext]) || "application/octet-stream";
}

/** Nombre de archivo seguro: sin separadores de ruta ni caracteres de control; `fallback` si queda vacío. */
export function safeFileName(name: string, fallback = "download"): string {
  // Los caracteres de control (código < 32 y 127) cuentan como separadores.
  const visible = [...String(name ?? "")].map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? "/" : ch)).join("");
  const clean = visible
    .replace(/[/\\?%*:|"<>]+/g, "-")
    .replace(/^\.+/, "")
    .trim();
  return clean || fallback;
}

/** El contenido como Blob con su tipo (el del Blob si ya lo trae, o el pedido, o el del nombre). */
export async function toBlob(source: DownloadSource, type: string): Promise<Blob> {
  const data = typeof source === "function" ? await source() : source;
  if (data instanceof Blob) return data.type ? data : new Blob([data], { type });
  if (data instanceof Uint8Array) return new Blob([data.slice()], { type });
  return new Blob([data], { type });
}

/** Descarga un Blob con un enlace temporal; libera la URL después. */
export function downloadBlob(blob: Blob, name: string, doc: Document = document): void {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, name, doc);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Descarga una URL (del mismo origen o `blob:`/`data:`) con el nombre dado. */
export function downloadUrl(url: string, name: string, doc: Document = document): void {
  const a = doc.createElement("a");
  a.href = url;
  a.download = safeFileName(name);
  a.rel = "noopener";
  a.hidden = true;
  doc.body.append(a);
  a.click();
  a.remove();
}

/** Contenido y tipo → descarga. */
export async function download(source: DownloadSource, name: string, mimeType?: string, doc: Document = document): Promise<Blob> {
  const blob = await toBlob(source, mimeType ?? mimeFromName(name));
  downloadBlob(blob, name, doc);
  return blob;
}
