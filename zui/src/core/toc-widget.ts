// TableOfContents (core/widget): índice de la página con la sección que se lee marcada (`aria-current="true"`).
// Scrollspy propio con IntersectionObserver: una banda fina en la línea de lectura avisa cuando un encabezado la cruza
// y entonces se mide (no en cada `scroll`); `scrollend` cubre los saltos largos (Inicio, Fin) que la banda no ve. El
// clic desplaza suave salvo con movimiento reducido, actualiza la dirección y lleva el foco a la sección. En modo
// compacto el índice es un `<details>` que muestra la sección actual. Un solo árbol para React y el modo DOM.
import { reducedMotion } from "./presence";
import { focusTarget, scrollerOf, scrollEventTarget, scrollMetrics, scrollToPosition } from "./scroller";
import { activeHeading, fragmentId, readingLine, scrollBehaviorFor, tocRows, type TocItem } from "./toc";
import { h, icon, on } from "./vnode";
import { num, yes, type Widget, type WidgetHost } from "./widget";

export type { TocItem };

export interface TableOfContentsLabels {
  /** Nombre de la navegación y título visible. */
  title: string;
}

export const TOC_LABELS: TableOfContentsLabels = { title: "On this page" };

export interface TableOfContentsProps {
  items?: readonly TocItem[];
  /** Sección marcada (controlado). Sin él, la marca el desplazamiento. */
  active?: string | null;
  defaultActive?: string | null;
  /** Desplegable con la sección actual en el resumen (para columnas estrechas). */
  compact?: boolean;
  /** Abierto al empezar, en modo compacto. */
  defaultOpen?: boolean;
  /** Lo que tapa arriba (una barra fija), en px: la línea de lectura y el destino del desplazamiento lo descuentan. */
  offset?: number;
  /** Desplazamiento suave al elegir (siempre instantáneo con movimiento reducido). */
  smooth?: boolean;
  /** Sin título visible (el nombre de la navegación se mantiene). */
  hideTitle?: boolean;
  labels?: Partial<TableOfContentsLabels>;
}

interface Config {
  items: readonly TocItem[];
  active?: string | null;
  defaultActive?: string | null;
  compact: boolean;
  defaultOpen: boolean;
  offset: number;
  smooth: boolean;
  hideTitle: boolean;
  labels: TableOfContentsLabels;
}

interface State {
  active: string | null;
  open: boolean;
}

interface Spy {
  ids: string;
  disconnect(): void;
}
const spies = new WeakMap<HTMLElement, Spy>();
const linkItems = new WeakMap<HTMLElement, TocItem[]>();

/** Observa los encabezados del índice; `onActive` recibe el id de la sección que se lee. */
function watchHeadings(root: HTMLElement, host: WidgetHost<Config, State>): Spy {
  const doc = root.ownerDocument;
  const ids = host.config().items.map((i) => i.id);
  const targets = ids.map((id) => doc.getElementById(id));
  const first = targets.find(Boolean) ?? null;
  const scroller = scrollerOf(first);
  let frame = 0;
  // Tras un clic, el desplazamiento suave cruza otras secciones: no se marcan hasta que termina.
  let lockedUntil = 0;
  const measure = () => {
    frame = 0;
    if (performance.now() < lockedUntil) return;
    const m = scrollMetrics(scroller, doc);
    const line = readingLine(m.height, host.config().offset);
    const tops = targets.map((t) => (t?.isConnected ? t.getBoundingClientRect().top - m.viewTop : null));
    const atEnd = m.top > 0 && m.top + m.height >= m.total - 2;
    const index = activeHeading(tops, line, atEnd);
    const id = index >= 0 ? (ids[index] ?? null) : null;
    if (id && id !== host.state().active) {
      if (host.config().active === undefined) host.update({ active: id });
      host.emit("active-change", { id });
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(measure);
  };
  const View = doc.defaultView?.IntersectionObserver;
  let observer: IntersectionObserver | null = null;
  if (View) {
    const m = scrollMetrics(scroller, doc);
    const line = Math.round(readingLine(m.height, host.config().offset));
    // Banda de 1 px en la línea de lectura: avisa cuando un encabezado la cruza en cualquier sentido.
    observer = new View(schedule, {
      root: scroller,
      rootMargin: `${-line}px 0px ${-(Math.max(0, m.height - line - 1))}px 0px`,
      threshold: [0, 1],
    });
    for (const t of targets) if (t) observer.observe(t);
  }
  const events = scrollEventTarget(scroller, doc);
  const onEnd = () => {
    lockedUntil = 0;
    schedule();
  };
  events.addEventListener("scrollend", onEnd);
  // Sin IntersectionObserver ni `scrollend`: el desplazamiento, como mucho una vez por fotograma.
  const onScroll = () => schedule();
  if (!View) events.addEventListener("scroll", onScroll, { passive: true });
  schedule();
  return {
    ids: ids.join("\n"),
    disconnect() {
      observer?.disconnect();
      events.removeEventListener("scrollend", onEnd);
      events.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    },
    // Lo usa el clic para no marcar las secciones que cruza el desplazamiento suave.
    lock(ms: number) {
      lockedUntil = performance.now() + ms;
    },
  } as Spy & { lock(ms: number): void };
}

/** Lleva a la sección `id`: desplaza (suave si se puede), cambia la dirección y enfoca la sección. */
export function goToSection(root: HTMLElement, id: string, offset: number, smooth: boolean): boolean {
  const doc = root.ownerDocument;
  const target = doc.getElementById(id);
  if (!target) return false;
  const scroller = scrollerOf(target);
  const m = scrollMetrics(scroller, doc);
  const top = target.getBoundingClientRect().top - m.viewTop + m.top - Math.max(0, offset);
  scrollToPosition(scroller, doc, top, scrollBehaviorFor(reducedMotion(), smooth));
  const view = doc.defaultView;
  if (view && view.location.hash !== `#${encodeURIComponent(id)}`) view.history?.pushState?.(view.history.state, "", `#${encodeURIComponent(id)}`);
  focusTarget(target);
  return true;
}

export const tableOfContentsWidget: Widget<TableOfContentsProps, Config, State> = {
  root: "z-toc",
  configure: (p) => ({
    items: p.items ?? [],
    active: p.active,
    defaultActive: p.defaultActive,
    compact: Boolean(p.compact),
    defaultOpen: Boolean(p.defaultOpen),
    offset: Math.max(0, Number(p.offset) || 0),
    smooth: p.smooth !== false,
    hideTitle: Boolean(p.hideTitle),
    labels: { ...TOC_LABELS, ...p.labels },
  }),
  initial: (c) => ({ active: c.active ?? c.defaultActive ?? null, open: c.defaultOpen }),
  control: (c, s) => (c.active !== undefined && c.active !== s.active ? { ...s, active: c.active } : s),
  tree(c, s) {
    const rows = tocRows(c.items);
    const current = rows.find((r) => r.id === s.active);
    const list = h(
      "ol",
      { class: "z-toc__list", key: "list" },
      ...rows.map((r) =>
        h(
          "li",
          { class: "z-toc__entry", key: r.id, "data-depth": r.depth },
          h(
            "a",
            {
              class: "z-toc__link",
              href: `#${encodeURIComponent(r.id)}`,
              "aria-current": r.id === s.active ? "true" : undefined,
            },
            r.label,
          ),
        ),
      ),
    );
    return h(
      "div",
      { class: "z-toc", role: "navigation", "aria-label": c.labels.title, "data-compact": on(c.compact) },
      c.compact
        ? h(
            "details",
            { class: "z-toc__compact", key: "compact", open: s.open || undefined },
            h(
              "summary",
              { class: "z-toc__summary" },
              h("span", { class: "z-toc__summary-title" }, c.labels.title),
              current ? h("span", { class: "z-toc__summary-current" }, current.label) : null,
              h("span", { class: "z-toc__chevron", "aria-hidden": "true" }, icon("chevron-down", 14)),
            ),
            list,
          )
        : null,
      !c.compact && !c.hideTitle ? h("p", { class: "z-toc__title", key: "title", "aria-hidden": "true" }, c.labels.title) : null,
      c.compact ? null : list,
    );
  },
  attach(root, host) {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.<HTMLAnchorElement>(".z-toc__link");
      if (!link || !root.contains(link) || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const id = fragmentId(link.getAttribute("href"));
      if (!id) return;
      const c = host.config();
      if (!root.ownerDocument.getElementById(id)) return;
      event.preventDefault();
      (spies.get(root) as (Spy & { lock?(ms: number): void }) | undefined)?.lock?.(c.smooth && !reducedMotion() ? 1500 : 0);
      goToSection(root, id, c.offset, c.smooth);
      if (c.active === undefined) host.update({ active: id, open: false });
      else if (host.state().open) host.update({ open: false });
      host.emit("active-change", { id });
    };
    // `toggle` no burbujea: se escucha en captura para seguir el desplegable abierto o cerrado.
    const onToggle = (event: Event) => {
      const details = event.target as HTMLDetailsElement;
      if (!details.classList?.contains("z-toc__compact") || details.open === host.state().open) return;
      host.update({ open: details.open });
    };
    root.addEventListener("click", onClick);
    root.addEventListener("toggle", onToggle, true);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("toggle", onToggle, true);
      spies.get(root)?.disconnect();
      spies.delete(root);
    };
  },
  after(root, host) {
    // Los encabezados se observan tras pintar (y de nuevo si cambia la lista).
    const ids = host
      .config()
      .items.map((i) => i.id)
      .join("\n");
    const spy = spies.get(root);
    if (spy?.ids === ids) return;
    spy?.disconnect();
    spies.set(root, watchHeadings(root, host));
  },
  fromDom(el, json) {
    const d = el.dataset;
    // Sin lista en data-props, la de los enlaces ya escritos (el marcado del servidor o el que pinta React).
    const links = [...el.querySelectorAll<HTMLAnchorElement>(".z-toc__link")];
    const fromLinks = links
      .map((a) => ({
        id: fragmentId(a.getAttribute("href")) ?? "",
        label: a.textContent ?? "",
        level: 2 + (Number(a.closest<HTMLElement>("[data-depth]")?.dataset.depth) || 0),
      }))
      .filter((i) => i.id);
    // Al montar, el árbol sustituye a los enlaces: la lista leída la primera vez se guarda para los pintados siguientes.
    if (fromLinks.length && !linkItems.has(el)) linkItems.set(el, fromLinks);
    return {
      items: Array.isArray(json.items) ? (json.items as TocItem[]) : linkItems.get(el),
      defaultActive: d.active ?? (links.find((a) => a.getAttribute("aria-current") === "true") ? fragmentId(links.find((a) => a.getAttribute("aria-current") === "true")!.getAttribute("href")) : undefined),
      compact: yes(d.compact),
      defaultOpen: yes(d.open),
      offset: num(d.offset, 0),
      smooth: d.smooth === "false" ? false : undefined,
      hideTitle: yes(d.hideTitle),
      labels: { ...(json.labels as Partial<TableOfContentsLabels> | undefined), ...(d.label ? { title: d.label } : {}) },
    };
  },
};
