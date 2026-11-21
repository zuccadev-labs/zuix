// SignaturePad: lienzo para firmar con el puntero (presión si la hay), deshacer, borrar y exportar en PNG o SVG, con
// una alternativa accesible: escribir el nombre (modo «Type»). Un solo árbol (core/vnode) y una sola interacción para
// React y el modo DOM (core/widget). Los trazos viven fuera del estado pintado (cambian a cada punto): el lienzo se
// redibuja a mano y el árbol solo sabe cuántos hay.

import { addPoint, signatureSvg, strokeWidth, strokePath, type SignatureStroke } from "./signature";
import { h, icon, on, type VEl } from "./vnode";
import { yes, type Widget, type WidgetHost } from "./widget";

export interface SignaturePadLabels {
  /** Nombre del lienzo. */
  pad: string;
  /** Texto de ayuda sobre la línea mientras está vacío. */
  placeholder: string;
  draw: string;
  type: string;
  /** Etiqueta del campo del modo «Type». */
  name: string;
  undo: string;
  clear: string;
  /** Nombre del grupo de modos. */
  mode: string;
}

export const SIGNATURE_LABELS: SignaturePadLabels = {
  pad: "Signature pad",
  placeholder: "Sign here",
  draw: "Draw",
  type: "Type",
  name: "Type your full name",
  undo: "Undo last stroke",
  clear: "Clear signature",
  mode: "Signature method",
};

export interface SignaturePadProps {
  /** Modo de partida: dibujar o escribir el nombre. */
  defaultMode?: "draw" | "type";
  /** Nombre escrito de partida (modo «Type»). */
  defaultName?: string;
  /** Sin la pestaña «Type» (solo dibujo). */
  drawOnly?: boolean;
  /** Grosor base del trazo en píxeles (la presión lo modula). */
  strokeWidth?: number;
  /** Alto del lienzo en píxeles (por defecto 180). */
  height?: number;
  disabled?: boolean;
  /** Campo oculto con la firma en SVG (o el nombre escrito), para enviar un formulario. */
  name?: string;
  form?: string;
  labels?: Partial<SignaturePadLabels>;
}

interface Config extends SignaturePadProps {
  labels: SignaturePadLabels;
  base: number;
  height: number;
}

interface State {
  mode: "draw" | "type";
  typed: string;
  /** Trazos dibujados (el detalle está fuera del estado). */
  count: number;
  /** Valor del campo oculto: la firma en SVG o el nombre escrito. */
  out: string;
}

/** Trazos de cada lienzo montado. */
const strokesOf = new WeakMap<HTMLElement, SignatureStroke[]>();
const strokes = (root: HTMLElement) => {
  const found = strokesOf.get(root);
  if (found) return found;
  const list: SignatureStroke[] = [];
  strokesOf.set(root, list);
  return list;
};

export interface SignatureValue {
  /** Nada dibujado ni escrito. */
  empty: boolean;
  mode: "draw" | "type";
  /** Trazos en fracciones del lienzo. */
  strokes: SignatureStroke[];
  /** Nombre escrito (modo «Type»). */
  typed: string;
  /** La firma en SVG (trazos o el nombre como texto). */
  svg: string;
}

function inkOf(root: HTMLElement): string {
  const canvas = root.querySelector<HTMLElement>(".z-signature__canvas") ?? root;
  return getComputedStyle(canvas).color || "currentColor";
}

/** Firma actual de un SignaturePad montado (React o modo DOM). */
export function signatureValue(root: HTMLElement, color?: string): SignatureValue {
  const list = strokes(root).map((s) => s.map((p) => ({ ...p })));
  const canvas = root.querySelector<HTMLCanvasElement>(".z-signature__canvas");
  const width = Math.round(canvas?.clientWidth || 480);
  const height = Math.round(canvas?.clientHeight || 180);
  const mode = root.dataset.mode === "type" ? "type" : "draw";
  const typed = root.querySelector<HTMLInputElement>(".z-signature__typed")?.value.trim() ?? "";
  const ink = color ?? "currentColor";
  const svg =
    mode === "type"
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><text x="${width / 2}" y="${Math.round(height * 0.62)}" text-anchor="middle" font-family="cursive" font-style="italic" font-size="${Math.round(height * 0.3)}" fill="${ink}">${typed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text></svg>`
      : signatureSvg(list, width, height, ink, Number(root.dataset.stroke) || 2.5);
  return { empty: mode === "type" ? typed === "" : list.length === 0, mode, strokes: list, typed, svg };
}

/**
 * Firma en PNG: los trazos (o el nombre escrito) en un canvas a `scale` píxeles por píxel CSS, fondo transparente.
 * `color` por defecto es el de la tinta en pantalla.
 */
export function signatureBlob(root: HTMLElement, options: { color?: string; scale?: number } = {}): Promise<Blob> {
  const value = signatureValue(root);
  const canvas = root.querySelector<HTMLCanvasElement>(".z-signature__canvas");
  const width = canvas?.clientWidth || 480;
  const height = canvas?.clientHeight || 180;
  const scale = options.scale ?? 2;
  const out = root.ownerDocument.createElement("canvas");
  out.width = Math.round(width * scale);
  out.height = Math.round(height * scale);
  const ctx = out.getContext("2d");
  const color = options.color ?? inkOf(root);
  if (ctx) {
    ctx.scale(scale, scale);
    if (value.mode === "type") {
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.font = `italic ${Math.round(height * 0.3)}px ${getComputedStyle(root.querySelector(".z-signature__preview") ?? root).fontFamily}`;
      ctx.fillText(value.typed, width / 2, height * 0.62);
    } else paint(ctx, value.strokes, width, height, color, Number(root.dataset.stroke) || 2.5);
  }
  return new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo exportar la firma"))), "image/png"),
  );
}

function paint(
  ctx: CanvasRenderingContext2D,
  list: readonly SignatureStroke[],
  width: number,
  height: number,
  color: string,
  base: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of list) {
    if (!s.length) continue;
    ctx.lineWidth = strokeWidth(s, base);
    ctx.stroke(new Path2D(strokePath(s, width, height)));
  }
}

function redraw(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>(".z-signature__canvas");
  if (!canvas) return;
  const dpr = root.ownerDocument.defaultView?.devicePixelRatio ?? 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  paint(ctx, strokes(root), width, height, inkOf(root), Number(root.dataset.stroke) || 2.5);
}

function tree(c: Config, s: State, uid: string): VEl {
  const empty = s.mode === "draw" ? s.count === 0 : s.typed.trim() === "";
  const tab = (mode: "draw" | "type", label: string) =>
    h(
      "button",
      {
        key: mode,
        type: "button",
        class: "z-signature__mode",
        "data-mode": mode,
        role: "radio",
        "aria-checked": s.mode === mode ? "true" : "false",
        tabindex: s.mode === mode ? 0 : -1,
        disabled: c.disabled || undefined,
      },
      icon(mode === "draw" ? "pencil" : "language", 14),
      label,
    );
  return h(
    "div",
    {
      class: "z-signature",
      role: "group",
      "aria-label": c.labels.pad,
      "data-mode": s.mode,
      "data-empty": on(empty),
      "data-disabled": on(c.disabled),
      "data-stroke": c.base,
      "data-height": c.height,
      "data-draw-only": c.drawOnly ? "" : undefined,
      "data-name": c.name,
      "data-typed": c.defaultName,
      s: { "--z-signature-height": `${c.height}px` },
    },
    c.drawOnly
      ? null
      : h(
          "div",
          { class: "z-signature__modes", role: "radiogroup", "aria-label": c.labels.mode },
          tab("draw", c.labels.draw),
          tab("type", c.labels.type),
        ),
    h(
      "div",
      { class: "z-signature__pad" },
      h("canvas", {
        class: "z-signature__canvas",
        role: "img",
        "aria-label": c.labels.pad,
        hidden: s.mode !== "draw" || undefined,
      }),
      s.mode === "type" ? h("span", { class: "z-signature__preview", "aria-hidden": "true" }, s.typed) : null,
      h("span", { class: "z-signature__line", "aria-hidden": "true" }),
      empty && s.mode === "draw" ? h("span", { class: "z-signature__placeholder", "aria-hidden": "true" }, c.labels.placeholder) : null,
    ),
    s.mode === "type"
      ? h(
          "label",
          { class: "z-signature__field" },
          h("span", { class: "z-signature__field-label" }, c.labels.name),
          h(
            "span",
            { class: "z-input", "data-size": "md", "data-disabled": on(c.disabled) },
            h("input", {
              id: `${uid}-name`,
              class: "z-input__control z-signature__typed",
              type: "text",
              value: s.typed,
              autocomplete: "name",
              disabled: c.disabled || undefined,
            }),
          ),
        )
      : null,
    h(
      "div",
      { class: "z-signature__actions" },
      s.mode === "draw"
        ? h(
            "button",
            {
              type: "button",
              class: "z-btn z-btn--ghost z-signature__undo",
              "data-size": "sm",
              "data-action": "undo",
              disabled: c.disabled || s.count === 0 || undefined,
            },
            icon("arrow-uturn-down-left", 14),
            c.labels.undo,
          )
        : null,
      h(
        "button",
        {
          type: "button",
          class: "z-btn z-btn--ghost z-signature__clear",
          "data-size": "sm",
          "data-action": "clear",
          disabled: c.disabled || empty || undefined,
        },
        icon("trash", 14),
        c.labels.clear,
      ),
    ),
    c.name ? h("input", { type: "hidden", name: c.name, form: c.form, value: s.out, "data-signature": "" }) : null,
  );
}

type Host = WidgetHost<Config, State>;

function changed(root: HTMLElement, host: Host): void {
  const value = signatureValue(root);
  const out = value.empty ? "" : value.mode === "type" ? value.typed : value.svg;
  if (out !== host.state().out) host.update({ out });
  const hidden = root.querySelector<HTMLInputElement>("input[data-signature]");
  if (hidden) hidden.value = out;
  host.emit("change", value);
}

function attach(root: HTMLElement, host: Host): () => void {
  const list = strokes(root);
  let current: SignatureStroke | null = null;
  let pointer: number | null = null;
  const canvas = () => root.querySelector<HTMLCanvasElement>(".z-signature__canvas");
  const down = (event: PointerEvent) => {
    const c = canvas();
    if (event.target !== c || event.button !== 0 || host.config().disabled) return;
    event.preventDefault();
    pointer = event.pointerId;
    try {
      c!.setPointerCapture(event.pointerId);
    } catch {
      // Puntero sintético.
    }
    current = [];
    list.push(current);
    addPoint(current, event.clientX, event.clientY, c!.getBoundingClientRect(), event.pressure, 0);
    redraw(root);
  };
  const moveTo = (event: PointerEvent) => {
    if (pointer !== event.pointerId || !current) return;
    const rect = canvas()!.getBoundingClientRect();
    const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
    let added = false;
    for (const e of events.length ? events : [event]) added = addPoint(current, e.clientX, e.clientY, rect, e.pressure) || added;
    if (added) redraw(root);
  };
  const up = (event: PointerEvent) => {
    if (pointer !== event.pointerId) return;
    pointer = null;
    current = null;
    host.update({ count: list.length });
    changed(root, host);
  };
  const click = (event: MouseEvent) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
    if (!button || !root.contains(button) || host.config().disabled) return;
    if (button.dataset.mode === "draw" || button.dataset.mode === "type") {
      const mode = button.dataset.mode;
      if (mode === host.state().mode) return;
      host.update({ mode });
      root.dataset.mode = mode;
      changed(root, host);
      if (mode === "type") root.querySelector<HTMLInputElement>(".z-signature__typed")?.focus();
      return;
    }
    if (button.dataset.action === "undo") {
      list.pop();
      host.update({ count: list.length }, false);
      changed(root, host);
    } else if (button.dataset.action === "clear") {
      if (host.state().mode === "type") host.update({ typed: "" });
      else {
        list.length = 0;
        host.update({ count: 0 });
      }
      const typed = root.querySelector<HTMLInputElement>(".z-signature__typed");
      if (typed) typed.value = "";
      changed(root, host);
      // El botón queda desactivado al vaciar: el foco pasa al lienzo o al campo.
      (
        root.querySelector<HTMLElement>(".z-signature__typed") ?? root.querySelector<HTMLElement>(".z-signature__mode[aria-checked='true']")
      )?.focus();
    }
  };
  // Modos como grupo de radios (APG): las flechas cambian de modo y llevan el foco.
  const keydown = (event: KeyboardEvent) => {
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(".z-signature__mode") : null;
    if (!target || !root.contains(target) || host.config().disabled) return;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next = target.dataset.mode === "draw" ? "type" : "draw";
    host.update({ mode: next });
    root.dataset.mode = next;
    changed(root, host);
    root.querySelector<HTMLElement>(`.z-signature__mode[data-mode="${next}"]`)?.focus();
  };
  const input = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains("z-signature__typed")) return;
    host.update({ typed: target.value });
    changed(root, host);
  };
  const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => redraw(root));
  const c = canvas();
  if (c && resize) resize.observe(c);
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", moveTo);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", up);
  root.addEventListener("click", click);
  root.addEventListener("input", input);
  root.addEventListener("keydown", keydown);
  redraw(root);
  return () => {
    resize?.disconnect();
    root.removeEventListener("pointerdown", down);
    root.removeEventListener("pointermove", moveTo);
    root.removeEventListener("pointerup", up);
    root.removeEventListener("pointercancel", up);
    root.removeEventListener("click", click);
    root.removeEventListener("input", input);
    root.removeEventListener("keydown", keydown);
  };
}

export const signaturePadWidget: Widget<SignaturePadProps, Config, State> = {
  root: "z-signature",
  configure: (p) => ({
    ...p,
    labels: { ...SIGNATURE_LABELS, ...p.labels },
    base: Number.isFinite(p.strokeWidth) && p.strokeWidth! > 0 ? p.strokeWidth! : 2.5,
    height: Number.isFinite(p.height) && p.height! > 40 ? p.height! : 180,
  }),
  initial: (c) => ({
    mode: c.drawOnly ? "draw" : c.defaultMode === "type" ? "type" : "draw",
    typed: c.defaultName ?? "",
    count: 0,
    out: c.defaultMode === "type" ? (c.defaultName ?? "") : "",
  }),
  tree,
  attach,
  after: (root) => redraw(root),
  fromDom(el, json) {
    const d = el.dataset;
    return {
      defaultMode: d.mode === "type" ? "type" : undefined,
      defaultName: d.typed ?? (json.defaultName as string | undefined),
      drawOnly: d.drawOnly === undefined ? undefined : d.drawOnly === "" || yes(d.drawOnly),
      strokeWidth: d.stroke ? Number(d.stroke) : undefined,
      height: d.height ? Number(d.height) : undefined,
      disabled: d.disabled !== undefined,
      name: d.name,
      form: d.form,
      labels: json.labels as Partial<SignaturePadLabels> | undefined,
    };
  },
};
