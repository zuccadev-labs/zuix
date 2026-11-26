// Pestañas que no caben con el menú «Más» (Tabs con overflow="menu"): un IntersectionObserver con raíz en la tira y
// umbral 1 marca en `data-clipped` las pestañas que no se ven enteras (se ocultan con visibility y salen del orden de
// foco y del árbol de accesibilidad, pero conservan su caja para que el observador vea cuándo vuelven a caber). La
// pestaña elegida nunca va al menú: si no cabe, se ocultan con `data-displaced` las anteriores, la más cercana primero,
// hasta que quepa. Lo comparten el binding de React y el modo DOM; sin efectos al importar.

const TAB = ".z-tabs__tab";
const tabsOf = (list: HTMLElement) => [...list.querySelectorAll<HTMLElement>(`:scope > ${TAB}`)];
const tabValue = (tab: HTMLElement) => tab.dataset.value ?? tab.getAttribute("aria-controls") ?? tab.id;

/** ¿Cabe la pestaña entera dentro de la tira? (los dos bordes: vale en cualquier dirección de escritura). */
function fits(list: HTMLElement, tab: HTMLElement): boolean {
  const box = list.getBoundingClientRect();
  const r = tab.getBoundingClientRect();
  return r.left >= box.left - 0.5 && r.right <= box.right + 0.5;
}

/** Vuelve a dejar a la vista la pestaña elegida ocultando (`data-displaced`) las anteriores que haga falta. */
export function revealSelected(list: HTMLElement): void {
  const tabs = tabsOf(list);
  const selected = tabs.find((tab) => tab.getAttribute("aria-selected") === "true");
  for (const tab of tabs) tab.removeAttribute("data-displaced");
  if (!selected) return;
  const before = tabs.slice(0, tabs.indexOf(selected));
  while (before.length && !fits(list, selected)) before.pop()!.setAttribute("data-displaced", "");
}

/** Valores de las pestañas que hoy no se ven (recortadas o desplazadas): las que lista el menú «Más». */
export function overflowedTabs(list: HTMLElement): string[] {
  return tabsOf(list)
    .filter((tab) => tab.hasAttribute("data-clipped") || tab.hasAttribute("data-displaced"))
    .filter((tab) => tab.getAttribute("aria-selected") !== "true")
    .map(tabValue);
}

/**
 * Vigila la tira y llama a `onChange` con las pestañas que no caben cada vez que cambian. Devuelve la función que
 * deja de vigilar. Sin IntersectionObserver (entornos sin documento), no hace nada.
 */
export function trackTabOverflow(list: HTMLElement, onChange: (values: string[]) => void): () => void {
  const view = list.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  if (!view || typeof view.IntersectionObserver === "undefined") return () => {};
  let last = "";
  const report = () => {
    revealSelected(list);
    const values = overflowedTabs(list);
    const key = values.join("\u0000");
    if (key === last) return;
    last = key;
    onChange(values);
  };
  let observer: IntersectionObserver | null = null;
  const observe = () => {
    observer?.disconnect();
    observer = new view.IntersectionObserver(
      (entries) => {
        for (const { target, intersectionRatio } of entries) target.toggleAttribute("data-clipped", intersectionRatio < 0.99);
        report();
      },
      { root: list, threshold: 1 },
    );
    for (const tab of tabsOf(list)) observer.observe(tab);
  };
  observe();
  // Pestañas nuevas o quitadas, o la elegida cambia: se vuelve a observar y a colocar.
  const mo = new view.MutationObserver((records) => {
    if (records.some((r) => r.type === "childList")) observe();
    else report();
  });
  mo.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
  return () => {
    observer?.disconnect();
    mo.disconnect();
    for (const tab of tabsOf(list)) {
      tab.removeAttribute("data-clipped");
      tab.removeAttribute("data-displaced");
    }
  };
}

/** Lleva la pestaña elegida a la vista dentro de la tira, sin desplazar la página (estrategia de desplazamiento). */
export function scrollTabIntoView(tab: HTMLElement | null | undefined): void {
  if (!tab) return;
  try {
    tab.scrollIntoView({ block: "nearest", inline: "nearest", container: "nearest" } as ScrollIntoViewOptions);
  } catch {
    tab.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}
