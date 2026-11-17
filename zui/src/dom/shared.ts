// Piezas comunes de @zuccadev-labs/zuix-zui/dom: marcado propio (Trusted Types) y, reexportadas de ../core, resolución
// segura de referencias, dirección y pulsación en el velo.
// Sin estado y sin listeners: se puede importar desde cualquier módulo del grupo.

export { byRef } from "../core/ref";
export { isRtl, logicalKey } from "../core/dir";
export { notePress, pressedOnBackdrop } from "../core/layers";

interface TrustedTypePolicyLike {
  createHTML: (input: string) => unknown;
}
interface TrustedTypesLike {
  createPolicy: (name: string, rules: { createHTML: (input: string) => string }) => TrustedTypePolicyLike;
}

/** Nombre de la política de Trusted Types de este paquete: `trusted-types zuix-zui` en la CSP. */
export const TRUSTED_TYPES_POLICY = "zuix-zui";
let policy: TrustedTypePolicyLike | null | undefined;

function trusted(markup: string): string {
  if (policy === undefined) {
    policy = null;
    const factory = (globalThis as { trustedTypes?: TrustedTypesLike }).trustedTypes;
    try {
      // La política no filtra: solo se usa con marcado que escribe este paquete (ver `setMarkup`).
      if (factory) policy = factory.createPolicy(TRUSTED_TYPES_POLICY, { createHTML: (input) => input });
    } catch {
      // La CSP no admite la política: se asigna la cadena y el navegador decide (lanza con require-trusted-types-for).
      policy = null;
    }
  }
  return policy ? (policy.createHTML(markup) as string) : markup;
}

/**
 * Único punto de `zui/dom` que escribe marcado como cadena. Solo recibe marcado fijo de este paquete y el SVG
 * de `iconSvg()`; el texto de la aplicación (títulos, etiquetas, nombres de archivo) entra siempre por
 * `textContent` o `setAttribute`. Con Trusted Types pasa por la política `zuix-zui`.
 */
export function setMarkup(el: Element, markup: string): void {
  el.innerHTML = trusted(markup);
}

/** Nodos a partir de marcado propio (un `<template>` no ejecuta ni carga nada hasta insertarse). */
export function fragment(markup: string): DocumentFragment {
  const template = document.createElement("template");
  setMarkup(template, markup);
  return template.content;
}

/** Copia los hijos de `from` en `to` sin pasar por una cadena de marcado. */
export function cloneChildren(from: Element, to: Element): void {
  to.replaceChildren(...[...from.childNodes].map((node) => node.cloneNode(true)));
}

/** Registra un listener en el documento o la ventana, ligado a la señal de `init()`: `destroy()` los retira todos. */
export interface Listen {
  <K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    handler: (event: DocumentEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  <K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    handler: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  (target: Document | Window, type: string, handler: (event: Event) => void, options?: boolean | AddEventListenerOptions): void;
}

export const listener = (signal: AbortSignal): Listen =>
  ((target: Document | Window, type: string, handler: (event: Event) => void, options?: boolean | AddEventListenerOptions) =>
    target.addEventListener(type, handler, { ...(typeof options === "boolean" ? { capture: options } : options), signal })) as Listen;
