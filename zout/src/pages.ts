// Comportamiento compartido de los layouts de página, para React (efectos) y el modo DOM (./dom/pages): la AppBar que
// se pliega al desplazar y el índice de DocsLayout que marca la sección que se lee. Sin documento al importar.
//
// AppBar: donde hay animaciones ligadas al desplazamiento, el pliegue lo hace solo la hoja de estilos y aquí no se
// hace nada; donde no, se escucha el desplazamiento (un fotograma como mucho) y se escribe `--z-appbar-progress`.
// Siempre se pone `data-scrolled` (sombra y borde) cuando hay algo desplazado.
import { activeSection, appBarProgress } from "./logic";

const supportsTimeline = () =>
  typeof CSS !== "undefined" && CSS.supports?.("(animation-timeline: scroll()) and (animation-range: 0% 100%)") === true;

/** Desplazador del que depende un elemento: el ancestro con desplazamiento o la ventana. */
function scrollerOf(el: HTMLElement): HTMLElement | Window {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return el.ownerDocument.defaultView ?? window;
}

const offset = (s: HTMLElement | Window) => ("scrollY" in s ? s.scrollY : s.scrollTop);

/** Conecta una AppBar (`.z-appbar[data-collapse]`); devuelve la función que la desconecta. */
export function wireAppBar(bar: HTMLElement): () => void {
  const scroller = scrollerOf(bar);
  const distance = () => Number(bar.dataset.collapseDistance) || 96;
  const timeline = supportsTimeline() && bar.hasAttribute("data-collapse");
  let frame = 0;
  const update = () => {
    frame = 0;
    const y = offset(scroller);
    bar.toggleAttribute("data-scrolled", y > 1);
    if (!timeline && bar.hasAttribute("data-collapse")) {
      const p = appBarProgress(y, distance());
      bar.style.setProperty("--z-appbar-progress", String(Math.round(p * 1000) / 1000));
      bar.toggleAttribute("data-collapsed", p >= 1);
    }
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  scroller.addEventListener("scroll", onScroll, { passive: true });
  update();
  return () => {
    scroller.removeEventListener("scroll", onScroll);
    cancelAnimationFrame(frame);
  };
}

/**
 * Índice con seguimiento (`nav.z-docs-layout__toc`): el enlace de la sección que se lee lleva `aria-current="true"`.
 * Mira los encabezados enlazados (`href="#id"`) en cada desplazamiento, como mucho uno por fotograma.
 */
export function wireScrollspy(nav: HTMLElement, onChange?: (id: string) => void): () => void {
  const doc = nav.ownerDocument;
  const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const targets = links.map((a) => doc.getElementById(decodeURIComponent(a.hash.slice(1))));
  const layout = nav.closest<HTMLElement>(".z-docs-layout");
  const scroller = layout
    ? scrollerOf(layout.querySelector<HTMLElement>(".z-docs-layout__article") ?? layout)
    : (doc.defaultView ?? window);
  let frame = 0;
  let current = "";
  const update = () => {
    frame = 0;
    const tops = targets.map((t) => (t ? t.getBoundingClientRect().top : Number.POSITIVE_INFINITY));
    const view = doc.defaultView;
    const atEnd =
      "scrollY" in scroller
        ? (view?.innerHeight ?? 0) + scroller.scrollY >= doc.documentElement.scrollHeight - 2
        : scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
    const i = activeSection(tops, (view?.innerHeight ?? 800) * 0.25, atEnd && offset(scroller) > 0);
    const link = links[i];
    if (!link || link.hash === current) return;
    current = link.hash;
    for (const a of links) {
      if (a === link) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
    onChange?.(current.slice(1));
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  scroller.addEventListener("scroll", onScroll, { passive: true });
  update();
  return () => {
    scroller.removeEventListener("scroll", onScroll);
    cancelAnimationFrame(frame);
  };
}

export interface DocsLayoutLabels {
  nav: string;
  toc: string;
  /** Título del índice en estrecho (desplegable). */
  onThisPage: string;
  previous: string;
  next: string;
  pager: string;
}

export const DOCS_LABELS: DocsLayoutLabels = {
  nav: "Documentation",
  toc: "On this page",
  onThisPage: "On this page",
  previous: "Previous",
  next: "Next",
  pager: "Pages",
};
