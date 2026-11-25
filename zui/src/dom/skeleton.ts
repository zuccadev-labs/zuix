// Skeletons por patrón sin framework: `<div class="z-skeleton-pattern" data-pattern="list" data-rows="5">` vacío se
// expande con el árbol de core/skeleton (el mismo que pinta React y que trae html.json ya expandido, sin JavaScript).
// Opciones en `data-*`: data-rows, data-columns, data-lines, data-messages, data-paragraphs, data-type
// (bar | line | donut), data-seed, data-animation (pulse | wave | none) y los booleanos data-media, data-actions,
// data-avatar, data-meta, data-header, data-cover y data-image (="false" para quitarlos).
import { isPattern, patternOptions, skeletonTree } from "../core/skeleton";
import { toHTML } from "../core/vnode";
import { setMarkup, type Listen } from "./shared";

/** Expande un patrón vacío. Devuelve si lo hizo. */
export function expandSkeleton(el: HTMLElement): boolean {
  const pattern = el.dataset.pattern;
  if (!isPattern(pattern) || el.childElementCount > 0) return false;
  const tree = skeletonTree(pattern, patternOptions(el.dataset));
  setMarkup(el, (tree.c ?? []).map((c) => toHTML(c)).join(""));
  for (const [k, v] of Object.entries(tree.a ?? {}))
    if (k !== "class" && v !== undefined && v !== null && !el.hasAttribute(k)) el.setAttribute(k, String(v));
  return true;
}

export function setup(_on: Listen): void {}

export function hydrate(root: ParentNode): void {
  if (root instanceof HTMLElement && root.matches(".z-skeleton-pattern[data-pattern]")) expandSkeleton(root);
  for (const el of root.querySelectorAll<HTMLElement>(".z-skeleton-pattern[data-pattern]")) expandSkeleton(el);
}
