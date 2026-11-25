// Política de Trusted Types del paquete (`zuix-zui`), la misma para el modo DOM y el binding de React. Se crea la
// primera vez que hace falta, nunca al importar.

interface TrustedTypePolicyLike {
  createHTML: (input: string) => unknown;
}
interface TrustedTypesLike {
  createPolicy: (name: string, rules: { createHTML: (input: string) => string }) => TrustedTypePolicyLike;
}

/** Nombre de la política de Trusted Types de este paquete: `trusted-types zuix-zui` en la CSP. */
export const TRUSTED_TYPES_POLICY = "zuix-zui";

// La política se guarda en el objeto global: si la página carga el bundle de `zui/dom` y el de React, los dos usan
// la misma. Crearla dos veces con el mismo nombre lanza cuando la CSP no lleva 'allow-duplicates'.
const SLOT = Symbol.for("zuix-zui.trusted-types-policy");
type Store = { [SLOT]?: TrustedTypePolicyLike | null };

function policy(): TrustedTypePolicyLike | null {
  const store = globalThis as Store;
  if (store[SLOT] !== undefined) return store[SLOT];
  store[SLOT] = null;
  const factory = (globalThis as { trustedTypes?: TrustedTypesLike }).trustedTypes;
  try {
    // La política no filtra: solo recibe el marcado fijo del paquete (`setMarkup`), el documento de la vista previa
    // de Artifact, que se carga en un iframe con sandbox vacío (sin scripts ni el origen de la página), y la salida de
    // `toTrustedHTML` del conector de editores, que es segura por construcción: etiquetas y atributos fijos, texto y
    // valores escapados, URL filtradas por esquema (editor/render).
    if (factory) store[SLOT] = factory.createPolicy(TRUSTED_TYPES_POLICY, { createHTML: (input) => input });
  } catch {
    // La CSP no admite la política: se asigna la cadena y el navegador decide (lanza con require-trusted-types-for).
  }
  return store[SLOT];
}

/** Marcado como TrustedHTML cuando la página exige Trusted Types; si no, la misma cadena. */
export function trustedHTML(markup: string): string {
  const p = policy();
  return p ? (p.createHTML(markup) as string) : markup;
}

/**
 * Escribe el documento de un iframe aislado. `srcdoc` es un destino de Trusted Types: con `setAttribute` y una
 * cadena el navegador lo rechaza bajo `require-trusted-types-for 'script'`. Si no cambia, no lo vuelve a cargar.
 */
export function setSrcdoc(frame: HTMLIFrameElement, html: string): void {
  if (frame.getAttribute("srcdoc") === html) return;
  frame.srcdoc = trustedHTML(html);
}
