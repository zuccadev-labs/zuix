// Piezas de diagrama sin framework: el teclado de los PortPanel (`.z-port-panel`), el enmascarado de los elementos
// `[data-sensitive]` según el interruptor global (`setRedaction`, o un control `[data-z-redact-toggle]`) y la
// exportación de un elemento o de un lienzo a SVG y PNG. Avisos: `z:portselect` en el panel con `{ port }`.

import { bindPortPanel } from "../core/port-panel";
import { isRedacted, onRedactionChange, redactionOptions, redactText, setRedaction, type SensitiveKind } from "../core/redact";
import { emit, inDom } from "./forms-popup";
import type { DomPart } from "./shared";

const panels = new Map<HTMLElement, () => void>();

/** Texto original de cada nodo de texto enmascarado. */
const originals = new WeakMap<Text, string>();

const kindOf = (el: Element): SensitiveKind => {
  const v = el.getAttribute("data-sensitive");
  return v === "domain" || v === "ip" || v === "email" || v === "text" ? v : "auto";
};

/**
 * Enmascara (o restaura) los textos de los elementos `[data-sensitive]` dentro de `root`. Solo cambia nodos de texto:
 * los iconos y el resto del marcado siguen en su sitio. `data-sensitive-placeholder` fija el sustituto.
 */
export function applyRedaction(root: ParentNode = document, on: boolean = isRedacted()): void {
  const holders = [...root.querySelectorAll<HTMLElement>("[data-sensitive]")];
  if (root instanceof HTMLElement && root.matches("[data-sensitive]")) holders.unshift(root);
  for (const el of holders) {
    const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
    const placeholder = el.getAttribute("data-sensitive-placeholder");
    texts.forEach((t, i) => {
      if (on) {
        if (!originals.has(t)) originals.set(t, t.data);
        const original = originals.get(t)!;
        const next = placeholder !== null ? (i === 0 ? placeholder : "") : redactText(original, kindOf(el), redactionOptions());
        if (t.data !== next) t.data = next;
      } else if (originals.has(t)) {
        t.data = originals.get(t)!;
        originals.delete(t);
      }
    });
    el.toggleAttribute("data-redacted", on);
  }
}

function onToggle(event: Event): void {
  const input = (event.target as Element).closest?.<HTMLInputElement>("input[data-z-redact-toggle]");
  if (input) setRedaction(input.checked);
}

const syncToggles = () => {
  for (const t of document.querySelectorAll<HTMLInputElement>("input[data-z-redact-toggle]")) t.checked = isRedacted();
};

let stop: (() => void) | null = null;

export const diagramPart: DomPart = {
  rank: 47,
  setup(on) {
    on(document, "change", onToggle);
    stop?.();
    stop = onRedactionChange(() => {
      applyRedaction(document);
      syncToggles();
    });
  },
  hydrate(root) {
    for (const el of root.querySelectorAll<HTMLElement>(".z-port-panel")) {
      if (panels.has(el) || !inDom(el)) continue;
      panels.set(
        el,
        bindPortPanel(el, {
          onSelect: (port) => {
            for (const o of el.querySelectorAll<HTMLElement>('[role="option"]'))
              o.setAttribute("aria-selected", String(o.dataset.port === port));
            emit(el, "portselect", { port });
          },
        }),
      );
    }
    for (const [el, off] of panels)
      if (!el.isConnected) {
        off();
        panels.delete(el);
      }
    if (isRedacted()) applyRedaction(root);
  },
  teardown() {
    for (const off of panels.values()) off();
    panels.clear();
    stop?.();
    stop = null;
  },
};
