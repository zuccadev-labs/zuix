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
import { confetti } from "../core/confetti-runtime";
import { download, downloadUrl, mimeFromName, type DownloadSource } from "../core/download";
import { qrcodeSvg } from "../core/qr-widget";
import { signatureBlob, signatureValue } from "../core/signature-widget";
import { inDom } from "./forms-popup";
import { byRef, setMarkup, type Listen } from "./shared";
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

/* ---------- DownloadTrigger ---------- */

/** Contenido de lo que nombra `data-z-download`: un QRCode, un SignaturePad, un canvas o el texto de un elemento. */
function sourceOf(target: Element, name: string): DownloadSource {
  const png = /\.png$/i.test(name);
  if (target instanceof HTMLElement && target.classList.contains("z-signature"))
    return png ? () => signatureBlob(target) : () => signatureValue(target).svg;
  if (target instanceof HTMLElement && target.classList.contains("z-qrcode")) {
    const svg =
      qrcodeSvg({
        value: target.dataset.value ?? "",
        level: target.dataset.level as "L" | "M" | "Q" | "H" | undefined,
        size: Number(target.dataset.size) || undefined,
        margin: target.dataset.margin ? Number(target.dataset.margin) : undefined,
      }) ?? "";
    return png ? () => rasterSvg(svg, Number(target.dataset.size) || 160) : svg;
  }
  if (target instanceof HTMLCanvasElement)
    return () =>
      new Promise<Blob>((resolve, reject) =>
        target.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas vacío"))), mimeFromName(name)),
      );
  if (target instanceof HTMLTemplateElement) return target.content.textContent ?? "";
  return target.textContent ?? "";
}

/** Un SVG dibujado en un canvas de `size` × 2 y exportado en PNG. */
function rasterSvg(svg: string, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size * 2;
      canvas.getContext("2d")?.drawImage(img, 0, 0, size * 2, size * 2);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG vacío"))), "image/png");
    };
    img.onerror = () => reject(new Error("SVG no válido"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export function setup(on: Listen): void {
  // `data-z-download="#id"` (con data-file-name) descarga el contenido de ese elemento; `data-href` una URL.
  on(document, "click", (event) => {
    const el = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-z-download]") : null;
    if (!el || !inDom(el) || el.matches(":disabled, [aria-busy='true']")) return;
    const name = el.dataset.fileName ?? "download";
    if (el.dataset.href) {
      downloadUrl(el.dataset.href, name);
      el.dispatchEvent(new CustomEvent("z:download", { bubbles: true, detail: { name } }));
      return;
    }
    const target = byRef(el.dataset.zDownload ?? "");
    if (!target) return;
    el.setAttribute("aria-busy", "true");
    el.dataset.loading = "";
    void download(sourceOf(target, name), name, el.dataset.mime ?? mimeFromName(name))
      .then((blob) =>
        el.dispatchEvent(new CustomEvent("z:download", { bubbles: true, detail: { name, size: blob.size, type: blob.type } })),
      )
      .catch((error: unknown) => el.dispatchEvent(new CustomEvent("z:downloaderror", { bubbles: true, detail: { name, error } })))
      .finally(() => {
        el.removeAttribute("aria-busy");
        delete el.dataset.loading;
      });
  });

  // `data-z-confetti` en un botón (o cualquier elemento pulsable): la ráfaga sale de él. `data-count`, `data-spread`.
  on(document, "click", (event) => {
    const el = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-z-confetti]") : null;
    if (!el || !inDom(el) || el.matches(":disabled, [aria-disabled='true']")) return;
    void confetti({
      origin: el,
      count: el.dataset.count ? Number(el.dataset.count) : undefined,
      spread: el.dataset.spread ? Number(el.dataset.spread) : undefined,
    });
  });
}

export function hydrate(root: ParentNode): void {
  for (const el of pick(root, ".z-compare")) compare(el);
}
