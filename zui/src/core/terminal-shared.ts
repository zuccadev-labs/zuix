// Piezas comunes de la familia de terminal y código: el botón de copiar con su confirmación (visible y anunciada en
// una región `status` fuera del botón), el pintado de trozos ANSI como nodos y el de tokens de código. Sin documento
// al importar: solo `copyFromButton` toca el portapapeles, y al llamarse.

import type { AnsiSpan, AnsiStyle } from "./ansi";
import { paletteRgb } from "./ansi";
import { announceText, copyText } from "./clipboard";
import type { CodeToken } from "./code-tokens";
import { h, icon, on, type VEl, type VNode } from "./vnode";

export type CopyState = "idle" | "copied" | "failed";

export interface CopyLabels {
  copy: string;
  copied: string;
  copyFailed: string;
}

/** Botón de copiar (icono y texto) y su región de estado, para la barra de una pieza. */
export function copyControl(cls: string, labels: CopyLabels, state: CopyState, name?: string): VNode[] {
  const text = state === "copied" ? labels.copied : state === "failed" ? labels.copyFailed : labels.copy;
  return [
    h(
      "button",
      {
        type: "button",
        class: `z-btn z-btn--ghost ${cls}`,
        "data-size": "sm",
        "data-copied": on(state === "copied"),
        "data-failed": on(state === "failed"),
        // El nombre visible dice qué se copia si hace falta («Copy output»); con el estado, cambia el texto.
        "aria-label": name && state === "idle" ? name : undefined,
      },
      icon(state === "copied" ? "check" : "copy", 14),
      h("span", { class: "z-term-copy__text" }, text),
    ),
    h("span", { class: "z-sr-only", role: "status", "data-live": "" }),
  ];
}

const copyTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

/**
 * Copia `text` y confirma: llama a `set` con el estado (que repinta el botón), escribe el mensaje en la región que
 * sigue al botón y lo retira a los dos segundos. No deshabilita el botón: copiar se puede repetir.
 */
export async function copyFromButton(
  button: HTMLElement,
  text: string,
  labels: CopyLabels,
  set: (state: CopyState) => void,
): Promise<boolean> {
  const ok = await copyText(text);
  const status =
    button.nextElementSibling instanceof HTMLElement && button.nextElementSibling.matches('[role="status"]')
      ? button.nextElementSibling
      : null;
  clearTimeout(copyTimers.get(button));
  set(ok ? "copied" : "failed");
  if (status) {
    status.textContent = "";
    requestAnimationFrame(() => {
      status.textContent = announceText(ok ? labels.copied : labels.copyFailed);
    });
  }
  copyTimers.set(
    button,
    setTimeout(() => {
      set("idle");
      if (status) status.textContent = "";
    }, 2000),
  );
  return ok;
}

/** Atributos de color de un estilo ANSI: índice 0–15 por token (`data-fg`), 256 y 24 bits por variable local. */
function colorAttrs(style: AnsiStyle): { a: Record<string, string | undefined>; s?: Record<string, string> } {
  const a: Record<string, string | undefined> = {};
  const s: Record<string, string> = {};
  const set = (key: "fg" | "bg", color: AnsiStyle["fg"]) => {
    if (color === undefined) return;
    if (typeof color === "number") {
      const rgb = paletteRgb(color);
      if (!rgb) {
        a[`data-${key}`] = String(color);
        return;
      }
      a[`data-${key}`] = "rgb";
      s[`--z-ansi-${key}`] = rgb.join(" ");
      return;
    }
    a[`data-${key}`] = "rgb";
    s[`--z-ansi-${key}`] = color.join(" ");
  };
  set("fg", style.fg);
  set("bg", style.bg);
  return { a, s: Object.keys(s).length ? s : undefined };
}

/** Un trozo ANSI como nodo: `span.z-ansi` con su estilo en atributos, o un enlace si lleva OSC 8. */
export function ansiSpan(span: AnsiSpan, key?: string): VNode {
  const { style } = span;
  const plain =
    style.fg === undefined &&
    style.bg === undefined &&
    !style.bold &&
    !style.dim &&
    !style.italic &&
    !style.underline &&
    !style.inverse &&
    !style.strike &&
    !style.link;
  if (plain) return span.text;
  const { a, s } = colorAttrs(style);
  const attrs = {
    class: "z-ansi",
    key,
    ...a,
    "data-bold": on(style.bold),
    "data-dim": on(style.dim),
    "data-italic": on(style.italic),
    "data-underline": on(style.underline),
    "data-inverse": on(style.inverse),
    "data-strike": on(style.strike),
    s,
  };
  if (style.link) return h("a", { ...attrs, href: style.link, target: "_blank", rel: "noopener noreferrer" }, span.text);
  return h("span", attrs, span.text);
}

/** Tokens de código como nodos (`span.z-tok[data-tok]`); el texto plano va suelto. */
export function tokenNodes(tokens: readonly CodeToken[]): VNode[] {
  return tokens.map((t) => (t.type === "plain" ? t.text : h("span", { class: "z-tok", "data-tok": t.type }, t.text)));
}

/** Memoria de nodos por objeto de línea: lo que no cambió se reutiliza al repintar (React y DOM se lo saltan). */
export function memoLine<T extends object>(cache: WeakMap<T, VEl>, line: T, make: () => VEl): VEl {
  const hit = cache.get(line);
  if (hit) return hit;
  const node = make();
  node.m = true;
  cache.set(line, node);
  return node;
}
