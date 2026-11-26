// BackToTop (core/widget): botón de volver arriba que aparece al desplazar más allá de un umbral. La colocación es
// CSS (`position: sticky` al pie de su contenedor, o `fixed` en la esquina); aquí solo se decide si se ve, como mucho
// una vez por fotograma. Al pulsar sube (suave salvo con movimiento reducido) y lleva el foco al principio: a
// `focusTarget`, al desplazador o al `<main>`. Si el botón se oculta con el foco dentro, el foco va al mismo sitio en
// vez de perderse en el `<body>`.
import { reducedMotion } from "./presence";
import { focusTarget, resolveElement, scrollerOf, scrollEventTarget, scrollMetrics, scrollToPosition } from "./scroller";
import { scrollBehaviorFor } from "./toc";
import { h, icon, on } from "./vnode";
import { num, yes, type Widget } from "./widget";

/** Se ve a partir de `threshold` px desplazados. */
export const backToTopVisible = (top: number, threshold: number) => Number.isFinite(top) && top > Math.max(0, threshold);

export interface BackToTopProps {
  /** Px desplazados a partir de los que aparece (400). */
  threshold?: number;
  /** Id del desplazador; por defecto, el ancestro que desplaza o el documento. */
  target?: string;
  /** Id de lo que recibe el foco al subir; por defecto, el desplazador o el `<main>`. */
  focusTarget?: string;
  /** `sticky` (al pie de su contenedor, por defecto) o `fixed` (esquina de la ventana). */
  placement?: "sticky" | "fixed";
  /** Texto visible junto al icono. */
  showLabel?: boolean;
  smooth?: boolean;
  label?: string;
}

interface Config {
  threshold: number;
  target?: string;
  focusTarget?: string;
  placement: "sticky" | "fixed";
  showLabel: boolean;
  smooth: boolean;
  label: string;
}

interface State {
  visible: boolean;
}

export const backToTopWidget: Widget<BackToTopProps, Config, State> = {
  root: "z-back-to-top",
  configure: (p) => ({
    threshold: Math.max(0, Number(p.threshold ?? 400) || 0),
    target: p.target,
    focusTarget: p.focusTarget,
    placement: p.placement === "fixed" ? "fixed" : "sticky",
    showLabel: Boolean(p.showLabel),
    smooth: p.smooth !== false,
    label: p.label ?? "Back to top",
  }),
  initial: () => ({ visible: false }),
  tree: (c, s) =>
    h(
      "div",
      { class: "z-back-to-top", "data-placement": c.placement, "data-visible": on(s.visible) },
      h(
        "button",
        {
          type: "button",
          class: `z-btn z-btn--secondary z-back-to-top__button${c.showLabel ? "" : " z-btn--icon"}`,
          "data-size": "md",
          "aria-label": c.showLabel ? undefined : c.label,
          title: c.showLabel ? undefined : c.label,
          // Oculto: fuera del orden de tabulación y del árbol accesible (visibility: hidden en la hoja).
          tabindex: s.visible ? undefined : -1,
        },
        icon("arrow-up", 16),
        c.showLabel ? h("span", { class: "z-back-to-top__label" }, c.label) : null,
      ),
    ),
  attach(root, host) {
    const doc = root.ownerDocument;
    const scroller = () => resolveElement(doc, host.config().target) ?? scrollerOf(root);
    let current = scroller();
    let events = scrollEventTarget(current, doc);
    let frame = 0;
    const home = () => resolveElement(doc, host.config().focusTarget) ?? current ?? doc.querySelector<HTMLElement>("main");
    const update = () => {
      frame = 0;
      const visible = backToTopVisible(scrollMetrics(current, doc).top, host.config().threshold);
      if (visible === host.state().visible) return;
      const hadFocus = !visible && root.contains(doc.activeElement);
      host.update({ visible });
      if (hadFocus) focusTarget(home());
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const listen = () => events.addEventListener("scroll", onScroll, { passive: true });
    listen();
    // El desplazador puede aparecer después (contenido que se carga): se vuelve a buscar al cambiar el tamaño.
    const onResize = () => {
      const next = scroller();
      if (next !== current) {
        events.removeEventListener("scroll", onScroll);
        current = next;
        events = scrollEventTarget(current, doc);
        listen();
      }
      onScroll();
    };
    doc.defaultView?.addEventListener("resize", onResize);
    const onClick = (event: MouseEvent) => {
      if (!(event.target as Element).closest?.(".z-back-to-top__button")) return;
      const c = host.config();
      scrollToPosition(current, doc, 0, scrollBehaviorFor(reducedMotion(), c.smooth));
      focusTarget(home());
      host.emit("click", {});
    };
    root.addEventListener("click", onClick);
    queueMicrotask(onResize);
    return () => {
      cancelAnimationFrame(frame);
      events.removeEventListener("scroll", onScroll);
      doc.defaultView?.removeEventListener("resize", onResize);
      root.removeEventListener("click", onClick);
    };
  },
  after() {},
  fromDom(el) {
    const d = el.dataset;
    return {
      threshold: d.threshold ? num(d.threshold, 400) : undefined,
      target: d.target,
      focusTarget: d.focusTarget,
      placement: d.placement === "fixed" ? "fixed" : undefined,
      showLabel: yes(d.showLabel),
      smooth: d.smooth === "false" ? false : undefined,
      label: d.label,
    };
  },
};
