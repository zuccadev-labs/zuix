// Copiar al portapapeles: el texto de un elemento o de un valor, con la API asíncrona y, solo si falta o la rechaza
// el navegador (contexto no seguro, permiso denegado), con la copia heredada dentro del mismo gesto. Sin efectos al
// importar: toca el documento solo cuando se llama.

interface ClipboardLike {
  writeText: (text: string) => Promise<void>;
}

/** Texto que se copia de un elemento: el valor de un campo o el texto visible (innerText conserva los saltos). */
export function copyableText(target: Element | null | undefined): string {
  if (!target) return "";
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target.value;
  // biome-ignore lint/performance/useDomNodeTextContent: se copia lo que se ve; innerText conserva los saltos de línea pintados y omite lo oculto.
  const text = (target as HTMLElement).innerText ?? target.textContent ?? "";
  return text.trim();
}

/** Copia con `document.execCommand("copy")` (obsoleta): último recurso cuando no hay portapapeles asíncrono. */
function legacyCopy(text: string, doc: Document): boolean {
  if (typeof doc.execCommand !== "function") return false;
  const field = doc.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.insetBlockStart = "0";
  field.style.opacity = "0";
  doc.body.append(field);
  field.select();
  try {
    return doc.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

/**
 * Escribe `text` en el portapapeles. Devuelve si lo consiguió; un texto vacío no se copia (false). `clipboard` y
 * `doc` se pueden inyectar (pruebas).
 */
export async function copyText(
  text: string,
  clipboard: ClipboardLike | undefined = globalThis.navigator?.clipboard,
  doc: Document | undefined = globalThis.document,
): Promise<boolean> {
  if (!text) return false;
  try {
    if (!clipboard) throw new Error("no clipboard");
    await clipboard.writeText(text);
    return true;
  } catch {
    return doc ? legacyCopy(text, doc) : false;
  }
}

let lastMessage = "";

/**
 * Mensaje para la región viva del botón. VoiceOver no repite un mensaje igual al anterior aunque la región se haya
 * vaciado: si se repite, se le añade un espacio de no separación (no se lee).
 */
export function announceText(message: string): string {
  const next = message === lastMessage ? `${message} ` : message;
  lastMessage = next;
  return next;
}
