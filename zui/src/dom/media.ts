// Piezas de medios sin framework (oleada 7): QRCode, CircularSlider, CompareSlider, ImageCropper, SignaturePad,
// ShortcutInput, Confetti y DownloadTrigger. Cada una se pinta con el mismo árbol que el binding de React
// (core/vnode) y la misma interacción (core/widget), dentro de `[data-z-dom]`. Configuración en `data-*` o en
// `<script type="application/json" data-props>`; datos por propiedad con setWidgetProps(el, props).
import { circularSliderWidget } from "../core/circular-widget";
import { imageCropperWidget } from "../core/cropper-widget";
import { qrcodeWidget } from "../core/qr-widget";
import { shortcutInputWidget } from "../core/shortcut-widget";
import { signaturePadWidget } from "../core/signature-widget";
import { registerIcons, iconSvg } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowsRightLeft } from "@zuccadev-labs/zuix-zicon/icons/arrows-right-left";
import { arrowsUpDown } from "@zuccadev-labs/zuix-zicon/icons/arrows-up-down";
import { arrowUturnDownLeft } from "@zuccadev-labs/zuix-zicon/icons/arrow-uturn-down-left";
import { language } from "@zuccadev-labs/zuix-zicon/icons/language";
import { pencil } from "@zuccadev-labs/zuix-zicon/icons/pencil";
import { trash } from "@zuccadev-labs/zuix-zicon/icons/trash";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { compareKey, comparePosition } from "../core/compare-slider";
import { inDom } from "./forms-popup";
import { setMarkup } from "./shared";
import { registerWidget } from "./widgets";

registerIcons([arrowsRightLeft, arrowsUpDown, pencil, language, arrowUturnDownLeft, trash, xMark]);

for (const widget of [qrcodeWidget, circularSliderWidget, imageCropperWidget, signaturePadWidget, shortcutInputWidget])
  registerWidget(widget);

function pick(root: ParentNode, selector: string): HTMLElement[] {
  const list = [...root.querySelectorAll<HTMLElement>(selector)];
  if (root instanceof HTMLElement && root.matches(selector)) list.unshift(root);
  return list.filter(inDom);
}

/* ---------- CompareSlider ---------- */

const compares = new WeakMap<HTMLElement, (value: number, end?: boolean) => void>();

/** Mueve el divisor de un CompareSlider (0–100). */
export function setCompareValue(el: HTMLElement, value: number): void {
  compares.get(el)?.(value);
}

function compare(el: HTMLElement): void {
  if (compares.has(el)) return;
  const vertical = el.dataset.orientation === "vertical";
  const doc = el.ownerDocument;
  // Marcado mínimo: dos hijos (antes y después). Se envuelven y se añaden divisor y asa.
  if (!el.querySelector(":scope > .z-compare__handle")) {
    const [first, second] = [...el.children] as HTMLElement[];
    const wrap = (node: HTMLElement | undefined, cls: string, label: string | undefined, side: string) => {
      const item = doc.createElement("div");
      item.className = `z-compare__item ${cls}`;
      if (node) item.append(node);
      if (label) {
        const chip = doc.createElement("span");
        chip.className = "z-compare__label";
        chip.dataset.side = side;
        chip.setAttribute("aria-hidden", "true");
        chip.textContent = label;
        item.append(chip);
      }
      return item;
    };
    const labels = el.dataset.labels !== "false";
    const after = wrap(second, "z-compare__after", labels ? (el.dataset.labelAfter ?? "After") : undefined, "after");
    const before = wrap(first, "z-compare__before", labels ? (el.dataset.labelBefore ?? "Before") : undefined, "before");
    const divider = doc.createElement("span");
    divider.className = "z-compare__divider";
    divider.setAttribute("aria-hidden", "true");
    const handle = doc.createElement("span");
    handle.className = "z-compare__handle";
    handle.setAttribute("role", "slider");
    handle.tabIndex = 0;
    handle.setAttribute("aria-label", el.dataset.labelSlider ?? "Image comparison");
    handle.setAttribute("aria-valuemin", "0");
    handle.setAttribute("aria-valuemax", "100");
    handle.setAttribute("aria-orientation", vertical ? "vertical" : "horizontal");
    setMarkup(handle, iconSvg(vertical ? "arrows-up-down" : "arrows-right-left", { size: 16 }));
    el.replaceChildren(after, before, divider, handle);
  }
  const handle = el.querySelector<HTMLElement>(":scope > .z-compare__handle")!;
  const beforeLabel = el.dataset.labelBefore ?? "Before";
  let value = Number(el.dataset.value);
  if (!Number.isFinite(value)) value = 50;
  const set = (next: number, end = false) => {
    value = Math.min(100, Math.max(0, next));
    el.dataset.value = String(value);
    el.style.setProperty("--z-compare-pos", `${value}%`);
    handle.setAttribute("aria-valuenow", String(value));
    handle.setAttribute("aria-valuetext", `${Math.round(value)}% ${beforeLabel}`);
    el.dispatchEvent(new CustomEvent(end ? "z:changeend" : "z:change", { bubbles: true, detail: { value } }));
  };
  set(value);
  compares.set(el, set);
  let drag: number | null = null;
  const at = (event: PointerEvent) => comparePosition({ x: event.clientX, y: event.clientY }, el.getBoundingClientRect(), vertical);
  el.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    drag = event.pointerId;
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      // Puntero sintético.
    }
    handle.focus({ preventScroll: true });
    set(at(event));
  });
  el.addEventListener("pointermove", (event) => {
    if (drag === event.pointerId) set(at(event));
  });
  const end = (event: PointerEvent) => {
    if (drag !== event.pointerId) return;
    drag = null;
    set(value, true);
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  handle.addEventListener("keydown", (event) => {
    const next = compareKey(event.key, event.shiftKey, value, vertical);
    if (next === undefined) return;
    event.preventDefault();
    set(next, true);
  });
}

export function setup(): void {}

export function hydrate(root: ParentNode): void {
  for (const el of pick(root, ".z-compare")) compare(el);
}
