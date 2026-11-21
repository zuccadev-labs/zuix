// ImageCropper: imagen con un área de recorte que se mueve y se redimensiona desde ocho asas, con relación de aspecto
// fija u opcional y forma rectangular o circular. Teclado en el área (flechas mueven, Mayúsculas + flechas
// redimensionan, Alt multiplica el paso) con anuncio del recorte en una región viva. Un solo árbol (core/vnode) y una
// sola interacción para React y el modo DOM (core/widget). La salida se dibuja con `cropImage` / `cropImageBlob`.

import { clampCrop, CROP_HANDLES, cropPixels, initialCrop, keyCrop, moveCrop, resizeCrop, type Crop, type CropHandle } from "./crop";
import { isRtl } from "./dir";
import { fill, h, on, type VEl } from "./vnode";
import { announceIn, num, type Widget, type WidgetHost } from "./widget";

export interface ImageCropperLabels {
  area: string;
  /** Instrucciones del teclado (aria-describedby del área). */
  instructions: string;
  /** «Crop {w}% × {h}% at {x}%, {y}%». */
  status: string;
}

export const IMAGE_CROPPER_LABELS: ImageCropperLabels = {
  area: "Crop area",
  instructions: "Arrow keys move the crop area. Shift and arrow keys resize it. Hold Alt for larger steps.",
  status: "Crop {w}% × {h}% at {x}%, {y}%",
};

export interface ImageCropperProps {
  src: string;
  alt: string;
  /** Relación de aspecto del recorte (ancho / alto), p. ej. 1, 16 / 9. Sin ella, libre. */
  aspect?: number;
  /** Recorte controlado, en fracciones de la imagen (0–1). */
  crop?: Crop;
  defaultCrop?: Crop;
  /** Forma del área: con `circle` la salida de cropImage deja transparente lo de fuera. */
  shape?: "rect" | "circle";
  /** Tamaño mínimo del recorte, en fracción del lado (por defecto 0,05). */
  minSize?: number;
  /** Rejilla de tercios dentro del área. */
  grid?: boolean;
  disabled?: boolean;
  /** Para imágenes de otro origen con CORS (y poder exportar el recorte). */
  crossOrigin?: "anonymous" | "use-credentials";
  labels?: Partial<ImageCropperLabels>;
}

interface Config extends ImageCropperProps {
  labels: ImageCropperLabels;
  min: number;
}

interface State {
  crop: Crop | null;
  /** Relación de la imagen (ancho / alto), conocida al cargarse. */
  imageAspect: number;
  natural: { width: number; height: number };
  prop: string | null;
}

const key = (c: Crop | undefined) => (c ? `${c.x},${c.y},${c.width},${c.height}` : null);
const pct = (n: number) => `${Math.round(n * 10000) / 100}%`;

function current(c: Config, s: State): Crop {
  return s.crop ?? clampCrop(c.defaultCrop ?? initialCrop(c.aspect, s.imageAspect), c.aspect, s.imageAspect, c.min);
}

function tree(c: Config, s: State, uid: string): VEl {
  const crop = current(c, s);
  return h(
    "div",
    {
      class: "z-cropper",
      "data-shape": c.shape === "circle" ? "circle" : "rect",
      "data-aspect": c.aspect,
      "data-src": c.src,
      "data-alt": c.alt,
      "data-grid": c.grid === false ? "false" : undefined,
      "data-min-size": c.minSize,
      "data-disabled": on(c.disabled),
      "data-cross-origin": c.crossOrigin,
      "data-default-crop": c.defaultCrop
        ? `${c.defaultCrop.x},${c.defaultCrop.y},${c.defaultCrop.width},${c.defaultCrop.height}`
        : undefined,
      "data-crop": `${crop.x},${crop.y},${crop.width},${crop.height}`,
      s: {
        "--z-crop-x": pct(crop.x),
        "--z-crop-y": pct(crop.y),
        "--z-crop-w": pct(crop.width),
        "--z-crop-h": pct(crop.height),
      },
    },
    h("img", { class: "z-cropper__image", src: c.src, alt: c.alt, draggable: "false", crossorigin: c.crossOrigin }),
    h(
      "div",
      {
        class: "z-cropper__area",
        "data-part": "area",
        role: "group",
        tabindex: c.disabled ? -1 : 0,
        "aria-label": c.labels.area,
        "aria-describedby": `${uid}-help`,
      },
      c.grid === false ? null : h("span", { class: "z-cropper__grid", "aria-hidden": "true" }),
      ...CROP_HANDLES.map((handle) => h("span", { key: handle, class: "z-cropper__handle", "data-handle": handle, "aria-hidden": "true" })),
    ),
    h("p", { id: `${uid}-help`, class: "z-sr-only" }, c.labels.instructions),
    h("span", { class: "z-sr-only", "data-live": "", "aria-live": "polite" }),
  );
}

type Host = WidgetHost<Config, State>;

function commit(root: HTMLElement, host: Host, crop: Crop, end: boolean, announce = false): void {
  const s = host.state();
  const before = key(current(host.config(), s));
  if (key(crop) !== before) {
    host.update({ crop });
    host.emit("change", { crop, pixels: cropPixels(crop, s.natural.width, s.natural.height) });
  }
  if (end) host.emit("change-end", { crop, pixels: cropPixels(crop, s.natural.width, s.natural.height) });
  if (announce) {
    const t = host.config().labels.status;
    announceIn(
      root,
      fill(t, {
        w: Math.round(crop.width * 100),
        h: Math.round(crop.height * 100),
        x: Math.round(crop.x * 100),
        y: Math.round(crop.y * 100),
      }),
    );
  }
}

function attach(root: HTMLElement, host: Host): () => void {
  const img = () => root.querySelector<HTMLImageElement>(".z-cropper__image");
  const measure = () => {
    const el = img();
    if (!el?.naturalWidth) return;
    const s = host.state();
    const aspect = el.naturalWidth / el.naturalHeight;
    if (Math.abs(aspect - s.imageAspect) < 1e-6 && s.natural.width === el.naturalWidth) return;
    const c = host.config();
    // La relación de la imagen cambia la del recorte en fracciones: se recoloca.
    const next = clampCrop(s.crop ?? c.defaultCrop ?? initialCrop(c.aspect, aspect), c.aspect, aspect, c.min);
    host.update({
      imageAspect: aspect,
      natural: { width: el.naturalWidth, height: el.naturalHeight },
      crop: s.crop || c.crop ? next : null,
    });
    host.emit("load", {
      crop: current(host.config(), host.state()),
      pixels: cropPixels(current(host.config(), host.state()), el.naturalWidth, el.naturalHeight),
    });
  };
  const onLoad = (event: Event) => {
    if (event.target === img()) measure();
  };
  root.addEventListener("load", onLoad, true);
  if (img()?.complete) measure();

  let drag: { pointer: number; handle: CropHandle | null; x: number; y: number; start: Crop } | null = null;
  const down = (event: PointerEvent) => {
    const c = host.config();
    if (event.button !== 0 || c.disabled || !(event.target instanceof Element)) return;
    const area = event.target.closest<HTMLElement>(".z-cropper__area");
    if (!area || !root.contains(area)) return;
    event.preventDefault();
    const handle = (event.target.closest<HTMLElement>(".z-cropper__handle")?.dataset.handle as CropHandle | undefined) ?? null;
    drag = { pointer: event.pointerId, handle, x: event.clientX, y: event.clientY, start: current(c, host.state()) };
    try {
      root.setPointerCapture(event.pointerId);
    } catch {
      // Puntero sintético.
    }
    area.focus({ preventScroll: true });
    root.dataset.dragging = handle ? "resize" : "move";
  };
  const moveTo = (event: PointerEvent) => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const c = host.config();
    const s = host.state();
    const rect = root.getBoundingClientRect();
    const dx = (event.clientX - drag.x) / (rect.width || 1);
    const dy = (event.clientY - drag.y) / (rect.height || 1);
    const next = drag.handle ? resizeCrop(drag.start, drag.handle, dx, dy, c.aspect, s.imageAspect, c.min) : moveCrop(drag.start, dx, dy);
    commit(root, host, next, false);
  };
  const up = (event: PointerEvent) => {
    if (!drag || drag.pointer !== event.pointerId) return;
    drag = null;
    delete root.dataset.dragging;
    commit(root, host, current(host.config(), host.state()), true, true);
  };
  const keydown = (event: KeyboardEvent) => {
    const c = host.config();
    if (c.disabled || !(event.target instanceof HTMLElement) || !event.target.classList.contains("z-cropper__area")) return;
    const s = host.state();
    const next = keyCrop(
      current(c, s),
      event.key,
      { shift: event.shiftKey, alt: event.altKey },
      c.aspect,
      s.imageAspect,
      isRtl(root) ? -1 : 1,
    );
    if (!next) return;
    event.preventDefault();
    commit(root, host, clampCrop(next, c.aspect, s.imageAspect, c.min), true, true);
  };
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", moveTo);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", up);
  root.addEventListener("keydown", keydown);
  return () => {
    root.removeEventListener("load", onLoad, true);
    root.removeEventListener("pointerdown", down);
    root.removeEventListener("pointermove", moveTo);
    root.removeEventListener("pointerup", up);
    root.removeEventListener("pointercancel", up);
    root.removeEventListener("keydown", keydown);
  };
}

export const imageCropperWidget: Widget<ImageCropperProps, Config, State> = {
  root: "z-cropper",
  configure: (p) => ({
    ...p,
    labels: { ...IMAGE_CROPPER_LABELS, ...p.labels },
    min: Number.isFinite(p.minSize) ? Math.min(0.9, Math.max(0.01, p.minSize!)) : 0.05,
  }),
  initial: (c) => ({ crop: c.crop ?? null, imageAspect: c.aspect ?? 1, natural: { width: 0, height: 0 }, prop: key(c.crop) }),
  control: (c, s) => (c.crop && key(c.crop) !== s.prop ? { ...s, crop: c.crop, prop: key(c.crop) } : s),
  tree,
  attach,
  after: () => {},
  fromDom(el, json) {
    const d = el.dataset;
    // `data-default-crop` es configuración; `data-crop` lo escribe el pintado (el recorte actual) y no se lee.
    const parts = (d.defaultCrop ?? "").split(",").map(Number);
    const defaultCrop =
      (json.defaultCrop as Crop | undefined) ??
      (parts.length === 4 && parts.every(Number.isFinite)
        ? { x: parts[0]!, y: parts[1]!, width: parts[2]!, height: parts[3]! }
        : undefined);
    const img = el.querySelector("img");
    // El modo DOM sustituye los hijos por el árbol: la imagen del marcado mínimo se guarda en la raíz la primera vez.
    if (img && !d.src) {
      el.dataset.src = img.getAttribute("src") ?? "";
      el.dataset.alt = img.getAttribute("alt") ?? "";
      if (img.hasAttribute("crossorigin")) el.dataset.crossOrigin = img.getAttribute("crossorigin") ?? "anonymous";
    }
    return {
      src: d.src ?? img?.getAttribute("src") ?? "",
      alt: d.alt ?? img?.getAttribute("alt") ?? "",
      aspect: d.aspect ? num(d.aspect, 0) || undefined : undefined,
      defaultCrop,
      shape: d.shape === "circle" ? "circle" : undefined,
      minSize: d.minSize ? Number(d.minSize) : undefined,
      grid: d.grid === "false" ? false : undefined,
      disabled: d.disabled !== undefined,
      crossOrigin: (d.crossOrigin as ImageCropperProps["crossOrigin"]) ?? undefined,
      labels: json.labels as Partial<ImageCropperLabels> | undefined,
    };
  },
};
