// OverflowList: una fila de elementos en la que los que no caben pasan a un menú «+N». Cuántos caben es puro
// (`fitCount`); la medida la hace `attachOverflowList` con un ResizeObserver sobre la fila. Los que sobran siguen en
// el documento, fuera del flujo, invisibles e inertes (así se pueden medir), y el menú repite sus entradas. React
// recibe la cuenta y vuelve a pintar; el modo DOM marca los atributos directamente.

export type OverflowSide = "end" | "start";

/**
 * Cuántos elementos caben en `available` px: todos si caben sin el botón «+N»; si no, los que caben junto al botón
 * (`moreWidth`), con `gap` entre cada dos. Nunca menos de `minVisible` ni más de los que hay. Con `side = "start"`
 * se recorta por el principio (los que quedan son los últimos).
 */
export function fitCount(widths: readonly number[], available: number, gap = 0, moreWidth = 0, minVisible = 0, side: OverflowSide = "end"): number {
  const list = (side === "start" ? [...widths].reverse() : [...widths]).map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const n = list.length;
  const space = Number.isFinite(available) ? Math.max(0, available) : 0;
  const g = Math.max(0, Number.isFinite(gap) ? gap : 0);
  const min = Math.max(0, Math.min(n, Math.floor(minVisible)));
  const total = list.reduce((a, w) => a + w, 0) + g * Math.max(0, n - 1);
  if (total <= space + 0.5) return n;
  let used = Math.max(0, moreWidth);
  let k = 0;
  while (k < n && used + list[k]! + g <= space + 0.5) {
    used += list[k]! + g;
    k += 1;
  }
  return Math.max(min, Math.min(n - 1, k));
}

/** Índices visibles para una cuenta: los primeros (`end`) o los últimos (`start`). */
export function visibleIndexes(total: number, count: number, side: OverflowSide = "end"): number[] {
  const n = Math.max(0, Math.floor(total));
  const k = Math.max(0, Math.min(n, Math.floor(count)));
  return side === "start" ? Array.from({ length: k }, (_, i) => n - k + i) : Array.from({ length: k }, (_, i) => i);
}

export interface OverflowHost {
  /** Nueva cuenta de visibles. */
  apply(count: number): void;
  side(): OverflowSide;
  minVisible(): number;
}

const items = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(":scope > .z-overflow-list__item")];

/** Mide la fila y avisa de cuántos caben; vuelve a medir al cambiar de tamaño la fila o sus elementos. */
export function attachOverflowList(root: HTMLElement, host: OverflowHost): () => void {
  const View = root.ownerDocument.defaultView;
  let last = -1;
  let frame = 0;
  const measure = () => {
    frame = 0;
    const list = items(root);
    const more = root.querySelector<HTMLElement>(":scope > .z-overflow-list__more");
    const style = getComputedStyle(root);
    const available = root.clientWidth - (Number.parseFloat(style.paddingInlineStart) || 0) - (Number.parseFloat(style.paddingInlineEnd) || 0);
    const gap = Number.parseFloat(style.columnGap) || 0;
    const count = fitCount(
      list.map((el) => el.getBoundingClientRect().width),
      available,
      gap,
      more ? more.getBoundingClientRect().width : 0,
      host.minVisible(),
      host.side(),
    );
    if (count === last) return;
    last = count;
    host.apply(count);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(measure);
  };
  const Observer = View?.ResizeObserver;
  const observer = Observer ? new Observer(schedule) : null;
  const observeAll = () => {
    observer?.disconnect();
    observer?.observe(root);
    for (const el of items(root)) observer?.observe(el);
  };
  observeAll();
  // Elementos que se añaden o se quitan: se observan y se vuelve a medir.
  const mutations = View?.MutationObserver ? new View.MutationObserver(() => {
    observeAll();
    last = -1;
    schedule();
  }) : null;
  mutations?.observe(root, { childList: true });
  if (!observer) View?.addEventListener("resize", schedule);
  measure();
  return () => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    mutations?.disconnect();
    View?.removeEventListener("resize", schedule);
  };
}

/** Aplica una cuenta al marcado del modo DOM: elementos, botón «+N» y entradas del menú (`data-overflow-for`). */
export function paintOverflow(root: HTMLElement, count: number, side: OverflowSide, moreLabel: string): void {
  const list = items(root);
  const shown = new Set(visibleIndexes(list.length, count, side));
  const hiddenIds = new Set<string>();
  list.forEach((el, i) => {
    const hidden = !shown.has(i);
    el.toggleAttribute("data-overflow", hidden);
    el.toggleAttribute("inert", hidden);
    if (hidden) el.setAttribute("aria-hidden", "true");
    else el.removeAttribute("aria-hidden");
    if (hidden && el.dataset.id) hiddenIds.add(el.dataset.id);
  });
  const hiddenCount = list.length - shown.size;
  const more = root.querySelector<HTMLElement>(":scope > .z-overflow-list__more");
  if (more) {
    more.toggleAttribute("data-overflow", hiddenCount === 0);
    more.toggleAttribute("inert", hiddenCount === 0);
    const text = more.querySelector(".z-overflow-list__count");
    if (text) text.textContent = `+${hiddenCount}`;
    more.setAttribute("aria-label", moreLabel.replace("{count}", String(hiddenCount)));
    const menu = root.ownerDocument.getElementById((more.getAttribute("data-z-open") ?? "").replace(/^#/, ""));
    for (const entry of menu?.querySelectorAll<HTMLElement>("[data-overflow-for]") ?? [])
      entry.hidden = !hiddenIds.has(entry.dataset.overflowFor ?? "");
  }
  root.dataset.hiddenCount = String(hiddenCount);
}
