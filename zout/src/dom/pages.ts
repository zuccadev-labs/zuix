// Layouts de página sin framework (../pages): AppBar que se pliega al desplazar (`.z-appbar[data-collapse]`, con
// respaldo donde no hay animaciones ligadas al desplazamiento), índice de DocsLayout escrito a mano antes de la 0.5
// (`.z-docs-layout__toc` sin `.z-toc`; el de ahora es TableOfContents y lo monta @zuccadev-labs/zuix-zui/dom/page) y tira de secciones de SettingsLayout con el borde oculto difuminado. El resto de layouts de
// página es solo marcado y CSS.
import { trackScrollEdges } from "../edges";
import { wireAppBar, wireScrollspy } from "../pages";

const wired = new WeakMap<HTMLElement, () => void>();
const inDom = (el: Element) => el.closest("[data-z-dom]") !== null;

function all(root: ParentNode, selector: string): HTMLElement[] {
  const list = [...root.querySelectorAll<HTMLElement>(selector)];
  if (root instanceof HTMLElement && root.matches(selector)) list.unshift(root);
  return list.filter(inDom);
}

export function hydratePages(root: ParentNode): void {
  for (const bar of all(root, ".z-appbar")) if (!wired.has(bar)) wired.set(bar, wireAppBar(bar));
  for (const nav of all(root, ".z-docs-layout__toc:not(.z-toc)")) if (!wired.has(nav)) wired.set(nav, wireScrollspy(nav));
  for (const list of all(root, ".z-settings-layout__links")) if (!wired.has(list)) wired.set(list, trackScrollEdges(list));
}

export function disposePages(root: ParentNode): void {
  for (const el of all(root, ".z-appbar, .z-docs-layout__toc, .z-settings-layout__links")) {
    wired.get(el)?.();
    wired.delete(el);
  }
}
