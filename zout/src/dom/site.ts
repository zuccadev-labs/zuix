// Navegación de sitio sin framework: conecta cada Navbar y NavigationMenu de un contenedor [data-z-dom]
// con el mismo comportamiento que usa React (../site), SkipLink y la BottomNavigation de botones.
//   .z-navbar                  mide si la fila cabe; si no, cajón (popover) con el botón .z-navbar__toggle
//   .z-navmenu                 grupos de disclosure: paneles popover (horizontal) o desplegables (vertical)
//   .z-skiplink                lleva el foco al destino aunque no sea enfocable
//   .z-bottomnav button        mueve aria-current="page" y emite z:select { value }
import { skipTo, wireNavMenu, wireNavbar } from "../site";

const wired = new WeakMap<HTMLElement, () => void>();
const inDom = (el: Element) => el.closest("[data-z-dom]") !== null;

function all(root: ParentNode, selector: string): HTMLElement[] {
  const list = [...root.querySelectorAll<HTMLElement>(selector)];
  if (root instanceof HTMLElement && root.matches(selector)) list.unshift(root);
  return list.filter(inDom);
}

export function hydrateSite(root: ParentNode): void {
  for (const header of all(root, ".z-navbar")) if (!wired.has(header)) wired.set(header, wireNavbar(header));
  for (const menu of all(root, ".z-navmenu")) {
    if (wired.has(menu) || menu.closest(".z-navbar")) continue;
    wired.set(menu, wireNavMenu(menu));
  }
}

export function disposeSite(root: ParentNode): void {
  for (const el of all(root, ".z-navbar, .z-navmenu")) {
    wired.get(el)?.();
    wired.delete(el);
  }
}

export function onSiteClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const skip = target.closest<HTMLAnchorElement>("a.z-skiplink");
  if (skip && inDom(skip) && !event.defaultPrevented) {
    if (skipTo(skip)) event.preventDefault();
    return;
  }
  const item = target.closest<HTMLElement>("button.z-bottomnav__item");
  const nav = item?.closest<HTMLElement>(".z-bottomnav");
  if (!item || !nav || !inDom(nav)) return;
  const value = item.dataset.value ?? "";
  const ok = nav.dispatchEvent(new CustomEvent("z:select", { bubbles: true, cancelable: true, detail: { value } }));
  if (!ok) return;
  for (const other of nav.querySelectorAll<HTMLElement>(".z-bottomnav__item")) {
    if (other === item) other.setAttribute("aria-current", "page");
    else other.removeAttribute("aria-current");
  }
}
