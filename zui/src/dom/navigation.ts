// Comportamiento sin framework de la navegación de la oleada 4: Collapsible y Menubar. `setup()` conecta los
// listeners delegados una vez; `hydrate(root)` prepara marcado nuevo. Todo se activa dentro de `[data-z-dom]`.
//
// Collapsible  .z-collapsible > button.z-collapsible__trigger[aria-expanded][aria-controls] + .z-collapsible__content.
//              Plegado lleva `hidden="until-found"` (la búsqueda en la página lo abre); con data-peek no se oculta:
//              se recorta a --z-collapsible-peek y el foco que entra lo despliega. z:change { open } en .z-collapsible.
import { all, emit, inDom } from "./forms-popup";
import type { Listen } from "./shared";

/* ---------- Collapsible ---------- */

const contentOf = (root: Element) => root.querySelector<HTMLElement>(":scope > .z-collapsible__content");
const triggerOf = (root: Element) => root.querySelector<HTMLButtonElement>(":scope > .z-collapsible__trigger");

/** Abre o pliega un `.z-collapsible`. Emite `z:change { open }` si cambia. */
export function setCollapsibleOpen(root: HTMLElement, open: boolean): void {
  const trigger = triggerOf(root);
  const content = contentOf(root);
  if (!trigger || !content || (root.dataset.state === "open") === open) return;
  root.dataset.state = open ? "open" : "closed";
  content.dataset.state = root.dataset.state;
  trigger.setAttribute("aria-expanded", String(open));
  if (root.hasAttribute("data-peek")) content.removeAttribute("hidden");
  else if (open) content.removeAttribute("hidden");
  else content.setAttribute("hidden", "until-found");
  emit(root, "change", { open });
}

export function setup(on: Listen): void {
  on(document, "click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !inDom(target)) return;
    const trigger = target.closest<HTMLButtonElement>(".z-collapsible__trigger");
    const root = trigger?.parentElement;
    if (!trigger || !root?.classList.contains("z-collapsible") || trigger.disabled) return;
    setCollapsibleOpen(root, root.dataset.state !== "open");
  });
  // La búsqueda en la página encontró texto en una región plegada: se abre antes de mostrarlo.
  on(
    document,
    "beforematch",
    (event) => {
      const content = event.target instanceof Element ? event.target.closest(".z-collapsible__content") : null;
      const root = content?.parentElement;
      if (root?.classList.contains("z-collapsible") && inDom(root)) setCollapsibleOpen(root, true);
    },
    true,
  );
  on(document, "focusin", (event) => {
    const content = event.target instanceof Element ? event.target.closest(".z-collapsible__content") : null;
    const root = content?.parentElement;
    if (root?.hasAttribute("data-peek") && root.dataset.state !== "open" && inDom(root)) setCollapsibleOpen(root, true);
  });
}

export function hydrate(root: ParentNode): void {
  for (const el of all(root, ".z-collapsible")) {
    const trigger = triggerOf(el);
    const content = contentOf(el);
    if (!trigger || !content) continue;
    if (content.id) trigger.setAttribute("aria-controls", content.id);
    const open = trigger.getAttribute("aria-expanded") === "true";
    el.dataset.state = open ? "open" : "closed";
    content.dataset.state = el.dataset.state;
    if (!open && !el.hasAttribute("data-peek")) content.setAttribute("hidden", "until-found");
  }
}
