// Piezas de página sin framework: TableOfContents, BackToTop y TopProgress se pintan con el mismo árbol que el binding
// de React (core/widget + core/vnode). Affix, DataView, OverflowList y SearchView conectan la misma interacción de core
// al marcado ya escrito. Popconfirm es un `.z-popover` del núcleo: aquí solo se atiende su botón de confirmar.
import { attachAffix } from "../core/affix";
import { backToTopWidget } from "../core/back-to-top";
import { attachDataView } from "../core/data-view";
import { attachOverflowList, paintOverflow, type OverflowSide } from "../core/overflow-list";
import { popoverOpen } from "../core/popover";
import { attachSearchView, type SearchViewApi } from "../core/search-view";
import { tableOfContentsWidget } from "../core/toc-widget";
import { topProgressWidget } from "../core/top-progress";
import { all, emit } from "./forms-popup";
import type { DomPart } from "./shared";
import { widgetPart } from "./widgets";

export const pageWidgets = /* @__PURE__ */ widgetPart(46.1, [tableOfContentsWidget, backToTopWidget, topProgressWidget]);

const detachers = new Map<HTMLElement, () => void>();
const searchViews = new WeakMap<HTMLElement, SearchViewApi>();

function wire(el: HTMLElement, connect: () => () => void): void {
  if (detachers.has(el)) return;
  detachers.set(el, connect());
}

/** Affix, DataView, OverflowList y SearchView del marcado. */
export const pagePart: DomPart = {
  rank: 46.2,
  setup(on) {
    // Popconfirm: confirmar avisa en la capa (`z:confirm`) y la cierra, salvo que la aplicación lo impida
    // (`preventDefault()` para esperar una operación y cerrarla después con closePopover).
    on(document, "click", (event) => {
      const button = (event.target as Element).closest?.<HTMLElement>(".z-popconfirm [data-z-confirm]");
      const layer = button?.closest<HTMLElement>(".z-popconfirm");
      if (!button || !layer || button.getAttribute("aria-disabled") === "true") return;
      if (emit(layer, "confirm") && popoverOpen(layer)) layer.hidePopover();
    });
  },
  hydrate(root) {
    for (const el of all(root, ".z-affix")) wire(el, () => attachAffix(el, (stuck) => emit(el, "stuckchange", { stuck })));
    for (const el of all(root, ".z-dataview")) wire(el, () => attachDataView(el));
    for (const el of all(root, ".z-overflow-list"))
      wire(el, () =>
        attachOverflowList(el, {
          side: () => (el.dataset.side === "start" ? "start" : "end") as OverflowSide,
          minVisible: () => Number(el.dataset.minVisible) || 0,
          apply: (count) => paintOverflow(el, count, el.dataset.side === "start" ? "start" : "end", el.dataset.moreLabel ?? "{count} more"),
        }),
      );
    for (const el of all(root, ".z-searchview"))
      wire(el, () => {
        const api = attachSearchView(el, {
          openChange: (open) => emit(el, open ? "open" : "close"),
          valueChange: (value) => {
            const text = el.querySelector(":scope > .z-searchview__bar .z-searchview__text");
            if (text) text.textContent = value || (el.querySelector<HTMLInputElement>(".z-searchview__input")?.placeholder ?? "");
            emit(el, "valuechange", { value });
          },
          submit: (value) => emit(el, "submit", { value }),
        });
        searchViews.set(el, api);
        return api.detach;
      });
    // OverflowList: elegir una entrada del menú pulsa el elemento al que representa (un enlace navega, un botón actúa).
    for (const entry of all(root, ".z-menu [data-overflow-for]")) {
      if (entry.dataset.overflowWired) continue;
      entry.dataset.overflowWired = "";
      entry.addEventListener("click", () => {
        const menu = entry.closest<HTMLElement>(".z-menu");
        const id = entry.dataset.overflowFor ?? "";
        const owner = document.querySelector<HTMLElement>(`.z-overflow-list__more[data-z-open="#${CSS.escape(menu?.id ?? "")}"]`);
        const item = owner?.parentElement?.querySelector<HTMLElement>(`:scope > .z-overflow-list__item[data-id="${CSS.escape(id)}"]`);
        item?.querySelector<HTMLElement>("a, button")?.click();
      });
    }
  },
  teardown() {
    for (const off of detachers.values()) off();
    detachers.clear();
  },
};

/** Abre o cierra una SearchView del modo DOM. */
export function setSearchViewOpen(el: HTMLElement, open: boolean): void {
  const api = searchViews.get(el);
  if (open) api?.open();
  else api?.close();
}
