// Comportamiento sin framework de las capas y avisos de la oleada 4. `setup()` conecta los listeners delegados una
// vez; `hydrate(root)` prepara marcado nuevo. Todo se activa dentro de `[data-z-dom]`.
//
// Banner       .z-banner con button.z-banner__close: el cierre emite z:dismiss (cancelable) en el banner y, si nadie lo
//              cancela, lo oculta (`hidden`). El foco sigue hacia delante, al siguiente elemento tabulable.
import { focusQuiet, nextTabbable } from "../core/focus";
import { emit, inDom } from "./forms-popup";
import type { Listen } from "./shared";

/* ---------- Banner ---------- */

/** Cierra un `.z-banner`: emite `z:dismiss` y, si no se cancela, lo oculta. Devuelve si se cerró. */
export function dismissBanner(banner: HTMLElement): boolean {
  if (banner.hidden || !emit(banner, "dismiss")) return false;
  const next = banner.contains(document.activeElement) ? nextTabbable(banner) : undefined;
  banner.hidden = true;
  focusQuiet(next);
  return true;
}

export function setup(on: Listen): void {
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !inDom(target)) return;
    const close = target.closest(".z-banner__close");
    const banner = close?.closest<HTMLElement>(".z-banner");
    if (banner) dismissBanner(banner);
  });
}

export function hydrate(_root: ParentNode): void {}
