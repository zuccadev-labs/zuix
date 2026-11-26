// Slider, OTPInput y FileUpload sin framework.
import { localize } from "../core/locale";
import { localeOf } from "./locale";
import { matchesAccept } from "../core/accept";
import { announce } from "../core/announcer";
import { isRtl } from "../core/dir";
import { columnsOf, gridTarget, moveItem, nearestIndex, REORDER_LABELS, type ReorderLabels } from "../core/reorder";
import { drawThumbnail } from "../core/thumbnail";
import { fill } from "../core/vnode";
import { closestThumb, keyValue, moveThumb as nextValues, percent as percentOf, snap, valueAt } from "../core/slider";
import { iconSvg, registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowsPointingOut } from "@zuccadev-labs/zuix-zicon/icons/arrows-pointing-out";
import { document as documentIcon } from "@zuccadev-labs/zuix-zicon/icons/document";
import { photo } from "@zuccadev-labs/zuix-zicon/icons/photo";
import { star } from "@zuccadev-labs/zuix-zicon/icons/star";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { all, emit, flag, inDom } from "./forms-popup";
import { setMarkup, type Listen } from "./shared";

registerIcons([arrowsPointingOut, documentIcon, photo, star, xMark]);

/* ---------- Slider ---------- */

const num = (raw: string | undefined | null, fallback: number) =>
  raw !== undefined && raw !== null && raw.trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : fallback;

function sliderConfig(slider: HTMLElement) {
  const min = num(slider.dataset.min, 0);
  const max = Math.max(min, num(slider.dataset.max, 100));
  const step = Math.max(num(slider.dataset.step, 1), Number.EPSILON);
  const thumbs = [...slider.querySelectorAll<HTMLElement>(".z-slider__thumb")];
  const declared = (slider.dataset.value ?? "")
    .split(",")
    .filter((v) => v.trim() !== "")
    .map(Number);
  const values = thumbs.map((thumb, i) =>
    Math.min(max, Math.max(min, num(String(declared[i] ?? thumb.getAttribute("aria-valuenow") ?? ""), min))),
  );
  return {
    min,
    max,
    step,
    thumbs,
    values,
    vertical: slider.dataset.orientation === "vertical",
    disabled: slider.hasAttribute("data-disabled"),
  };
}

/** Sentido del eje horizontal: -1 si la pista crece hacia la izquierda (RTL, o `data-inverted` en LTR). */
const sliderDir = (slider: HTMLElement): 1 | -1 => (isRtl(slider) !== slider.hasAttribute("data-inverted") ? -1 : 1);

function paintSlider(slider: HTMLElement, values: number[]): void {
  const { min, max, thumbs, vertical, disabled } = sliderConfig(slider);
  const percent = (value: number) => percentOf(value, min, max);
  // El origen de la pista: abajo en vertical; en horizontal, el inicio de la línea (derecha en RTL o con data-inverted).
  const [start, end] = vertical
    ? slider.hasAttribute("data-inverted")
      ? ["top", "bottom"]
      : ["bottom", "top"]
    : sliderDir(slider) === -1
      ? ["right", "left"]
      : ["left", "right"];
  for (const side of ["left", "right", "top", "bottom"])
    if (side !== start && side !== end) slider.querySelector<HTMLElement>(".z-slider__range")?.style.removeProperty(side);
  slider.dataset.value = values.join(",");
  slider.dataset.orientation = vertical ? "vertical" : "horizontal";
  const range = slider.querySelector<HTMLElement>(".z-slider__range");
  if (range) {
    // Un tirador: de 0 al valor. Varios: del menor al mayor.
    const low = values.length > 1 ? percent(Math.min(...values)) : 0;
    const high = percent(Math.max(...values, min));
    range.style.setProperty(start!, `${low}%`);
    range.style.setProperty(end!, `${100 - high}%`);
  }
  thumbs.forEach((thumb, i) => {
    const value = values[i] ?? min;
    // El tirador no sobresale de la pista: recorre el ancho menos su propio tamaño (medido).
    const size = vertical ? thumb.offsetHeight : thumb.offsetWidth;
    thumb.style.position = "absolute";
    for (const side of ["left", "right", "top", "bottom"]) if (side !== start) thumb.style.removeProperty(side);
    thumb.style.setProperty(start!, `calc(${percent(value) / 100} * (100% - ${size ? `${size}px` : "var(--z-slider-thumb)"}))`);
    if (!thumb.hasAttribute("role")) thumb.setAttribute("role", "slider");
    thumb.setAttribute("aria-valuemin", String(min));
    thumb.setAttribute("aria-valuemax", String(max));
    thumb.setAttribute("aria-valuenow", String(value));
    thumb.setAttribute("aria-orientation", vertical ? "vertical" : "horizontal");
    flag(thumb, "aria-disabled", disabled, "true");
    thumb.tabIndex = disabled ? -1 : 0;
  });
  // Marcas dentro del rango elegido, de acento.
  const low = values.length > 1 ? Math.min(...values) : min;
  const high = Math.max(...values, min);
  for (const mark of slider.querySelectorAll<HTMLElement>(".z-slider__mark[data-value]")) {
    const v = Number(mark.dataset.value);
    flag(mark, "data-in-range", v >= low && v <= high);
  }
  const inputs = [...slider.querySelectorAll<HTMLInputElement>("input")];
  if (inputs.length === 1) inputs[0]!.value = values.join(",");
  else
    inputs.forEach((input, i) => {
      input.value = String(values[i] ?? "");
    });
}

function moveThumb(slider: HTMLElement, index: number, raw: number): void {
  const { min, max, step, values } = sliderConfig(slider);
  // Cada tirador se mueve entre sus vecinos.
  const next = nextValues(values, index, raw, min, max, step);
  if (!next) return;
  paintSlider(slider, next);
  emit(slider, "change", { value: next.length === 1 ? next[0] : next, index });
}

/** Fija el valor de un Slider (un número, o una lista con un valor por tirador). Emite z:change si cambia. */
export function setSliderValue(slider: HTMLElement, value: number | ReadonlyArray<number>): void {
  const { min, max, step, values } = sliderConfig(slider);
  // Un valor que no es un número (NaN) no mueve su tirador.
  const wanted = (typeof value === "number" ? [value] : [...value])
    .map((v, i) => (Number.isNaN(v) ? values[i] : snap(v, min, max, step)))
    .sort((a, b) => (a ?? 0) - (b ?? 0));
  const next = values.map((current, i) => wanted[i] ?? current);
  if (next.every((v, i) => v === values[i])) return;
  paintSlider(slider, next);
  emit(slider, "change", { value: next.length === 1 ? next[0] : next, index: 0 });
}

function valueAtPointer(slider: HTMLElement, event: PointerEvent): number {
  const { min, max, vertical } = sliderConfig(slider);
  const rect = slider.getBoundingClientRect();
  const across = (event.clientX - rect.left) / (rect.width || 1);
  const up = (rect.bottom - event.clientY) / (rect.height || 1);
  return valueAt(
    vertical ? (slider.hasAttribute("data-inverted") ? 1 - up : up) : sliderDir(slider) === -1 ? 1 - across : across,
    min,
    max,
  );
}

let drag: { slider: HTMLElement; index: number; pointer: number } | undefined;

function onSliderDown(event: PointerEvent): void {
  const target = event.target as Element;
  const slider = target.closest?.<HTMLElement>(".z-slider");
  if (!slider || !inDom(slider) || event.button !== 0) return;
  const { thumbs, values, disabled } = sliderConfig(slider);
  if (disabled || !thumbs.length) return;
  const value = valueAtPointer(slider, event);
  const grabbed = target.closest<HTMLElement>(".z-slider__thumb");
  // En la pista: se mueve el tirador más cercano. Sobre un tirador: solo empieza el arrastre.
  const index = grabbed ? thumbs.indexOf(grabbed) : closestThumb(values, value);
  event.preventDefault();
  drag = { slider, index, pointer: event.pointerId };
  try {
    slider.setPointerCapture(event.pointerId);
  } catch {
    // Puntero sintético o ya liberado: el arrastre sigue por los eventos del documento.
  }
  thumbs[index]?.focus({ preventScroll: true });
  if (!grabbed) moveThumb(slider, index, value);
}

function onSliderKey(thumb: HTMLElement, event: KeyboardEvent): void {
  const slider = thumb.closest<HTMLElement>(".z-slider");
  if (!slider || !inDom(slider)) return;
  const { min, max, step, thumbs, values, disabled } = sliderConfig(slider);
  const index = thumbs.indexOf(thumb);
  if (disabled || index < 0) return;
  // En RTL (o con data-inverted) la flecha izquierda sube el valor: apunta hacia el final de la pista.
  const next = keyValue(
    event.key,
    event.shiftKey,
    values[index]!,
    min,
    max,
    step,
    sliderDir(slider),
    slider.hasAttribute("data-inverted") ? -1 : 1,
  );
  if (next === undefined) return;
  event.preventDefault();
  moveThumb(slider, index, next);
}

/* ---------- OTPInput ---------- */

const otpCells = (otp: Element) => [...otp.querySelectorAll<HTMLInputElement>(".z-otp__cell")];
const otpClean = (otp: HTMLElement, text: string) =>
  text.replace(
    (otp.dataset.mode ?? (otpCells(otp)[0]?.inputMode === "numeric" ? "numeric" : "text")) === "numeric" ? /\D/g : /[^a-zA-Z0-9]/g,
    "",
  );
const otpValue = (otp: HTMLElement) =>
  otp.dataset.value ??
  otpCells(otp)
    .map((cell) => cell.value.slice(0, 1))
    .join("");

function writeOtp(otp: HTMLElement, value: string): void {
  const cells = otpCells(otp);
  const next = value.slice(0, cells.length);
  otp.dataset.value = next;
  cells.forEach((cell, i) => {
    cell.value = next[i] ?? "";
  });
  const hidden = otp.querySelector<HTMLInputElement>('input[type="hidden"]');
  if (hidden) hidden.value = next;
}

function commitOtp(otp: HTMLElement, value: string): void {
  const before = otpValue(otp);
  writeOtp(otp, value);
  const next = otpValue(otp);
  if (next !== before) emit(otp, "change", { value: next, complete: next.length === otpCells(otp).length });
}

function focusCell(otp: HTMLElement, index: number): void {
  const cells = otpCells(otp);
  const cell = cells[Math.max(0, Math.min(cells.length - 1, index))];
  cell?.focus();
  cell?.select();
}

/** Fija el código de un OTPInput y emite z:change (con `detail.complete`) si cambia. */
export function setOtpValue(otp: HTMLElement, value: string): void {
  commitOtp(otp, otpClean(otp, value));
}

function onOtpInput(otp: HTMLElement, cell: HTMLInputElement): void {
  const cells = otpCells(otp);
  const index = cells.indexOf(cell);
  const current = otpValue(otp);
  const typed = otpClean(otp, cell.value);
  // Carácter no admitido o borrado directo: la casilla vuelve a su valor.
  if (!typed) {
    writeOtp(otp, current);
    return;
  }
  // Escribir sobre una casilla sustituye su carácter; el resto se conserva.
  commitOtp(otp, current.slice(0, index) + typed + current.slice(index + 1));
  focusCell(otp, Math.min(index + typed.length, cells.length - 1));
}

function onOtpKey(otp: HTMLElement, cell: HTMLInputElement, event: KeyboardEvent): void {
  const index = otpCells(otp).indexOf(cell);
  const current = otpValue(otp);
  if (event.key === "Backspace") {
    event.preventDefault();
    if (current[index]) commitOtp(otp, current.slice(0, index) + current.slice(index + 1));
    else if (index > 0) {
      commitOtp(otp, current.slice(0, index - 1) + current.slice(index));
      focusCell(otp, index - 1);
    }
  } else if (event.key === "Delete") {
    // Supr borra el carácter de la casilla sin mover el foco.
    event.preventDefault();
    if (current[index]) commitOtp(otp, current.slice(0, index) + current.slice(index + 1));
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    focusCell(otp, index - 1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    focusCell(otp, Math.min(index + 1, current.length));
  }
}

/* ---------- FileUpload ---------- */

function fileSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(bytes < 10_000 ? 1 : 0)} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/* ---------- FileUpload en rejilla: miniaturas, portada y reordenar ---------- */

const gridOf = (zone: HTMLElement) => zone.dataset.layout === "grid";
/** Orden provisional mientras se reordena con el teclado (Escape lo descarta). */
const sessions = new WeakMap<HTMLElement, { file: File; origin: number; order: File[] }>();
/** Vista previa de cada archivo: se reutiliza al repintar, así el lienzo no se vuelve a decodificar. */
const previews = new WeakMap<File, HTMLElement>();
const tiles = new WeakMap<File, HTMLLIElement>();
/** Zonas que se están repintando: el desenfoque del asa que eso provoca no suelta lo cogido. */
const repainting = new WeakSet<HTMLElement>();

function reorderLabels(zone: HTMLElement): ReorderLabels {
  try {
    return { ...localize("reorder", REORDER_LABELS, localeOf(zone)), ...(JSON.parse(zone.dataset.reorderLabels ?? "{}") as Partial<ReorderLabels>) };
  } catch {
    return localize("reorder", REORDER_LABELS, localeOf(zone));
  }
}
const zoneFiles = (zone: HTMLElement) =>
  sessions.get(zone)?.order ?? Array.from(zone.querySelector<HTMLInputElement>(".z-upload__input")?.files ?? []);

function setFiles(zone: HTMLElement, files: readonly File[]): void {
  const input = zone.querySelector<HTMLInputElement>(".z-upload__input");
  if (!input) return;
  try {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
  } catch {
    // Sin DataTransfer construible el campo no se puede reordenar.
  }
}

function previewOf(file: File): HTMLElement {
  let el = previews.get(file);
  if (el) return el;
  el = document.createElement("span");
  el.className = "z-upload__preview";
  el.setAttribute("aria-hidden", "true");
  const image = file.type.startsWith("image/");
  setMarkup(el, iconSvg(image ? "photo" : "document", { size: 24 }));
  if (image) {
    const canvas = document.createElement("canvas");
    const target = el;
    void drawThumbnail(canvas, file, 192).then((drawn) => {
      if (drawn) target.replaceChildren(canvas);
    });
  }
  previews.set(file, el);
  return el;
}

function button(className: string, label: string, iconName: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.setAttribute("aria-label", label);
  setMarkup(b, iconSvg(iconName, { size: 14 }));
  return b;
}

/** Pinta la rejilla reutilizando las casillas (los nodos se mueven, no se rehacen: el foco y el lienzo se conservan). */
function renderGrid(zone: HTMLElement, list: HTMLElement, files: readonly File[]): void {
  const l = reorderLabels(zone);
  const off = zone.hasAttribute("data-disabled");
  const sortable = zone.hasAttribute("data-sortable") && !off && files.length > 1;
  const cover = zone.hasAttribute("data-cover");
  const session = sessions.get(zone);
  if (!zone.id) zone.id = `z-upload-${Math.random().toString(36).slice(2, 8)}`;
  const hintId = `${zone.id}-reorder-hint`;
  list.classList.add("z-upload__grid");
  const items = files.map((file, index) => {
    let li = tiles.get(file);
    if (!li) {
      li = document.createElement("li");
      li.className = "z-upload__tile";
      tiles.set(file, li);
    }
    li.dataset.index = String(index);
    li.toggleAttribute("data-cover", cover && index === 0);
    li.toggleAttribute("data-grabbed", session?.file === file);
    const name = document.createElement("span");
    name.className = "z-upload__tile-name";
    name.textContent = file.name;
    const actions = document.createElement("span");
    actions.className = "z-upload__tile-actions";
    if (sortable) {
      const handle = button("z-upload__handle", fill(l.handle, { name: file.name }), "arrows-pointing-out");
      handle.dataset.index = String(index);
      handle.setAttribute("aria-describedby", hintId);
      handle.setAttribute("aria-pressed", String(session?.file === file));
      actions.append(handle);
    }
    if (cover && !off && index > 0) {
      const make = button("z-upload__make-cover", fill(l.makeCover, { name: file.name }), "star");
      make.title = make.getAttribute("aria-label") ?? "";
      make.dataset.index = String(index);
      actions.append(make);
    }
    if (!off) {
      const label = (zone.dataset.removeLabel ?? "Remove {name}").replace("{name}", file.name);
      const remove = button("z-upload__remove", label, "x-mark");
      remove.title = label;
      remove.dataset.index = String(index);
      actions.append(remove);
    }
    const kids: Node[] = [previewOf(file)];
    if (cover && index === 0) {
      const tag = document.createElement("span");
      tag.className = "z-upload__cover";
      tag.textContent = l.cover;
      kids.push(tag);
    }
    kids.push(name, actions);
    // Se rehace todo menos la vista previa; el asa enfocada se recupera después por su índice.
    li.replaceChildren(...kids);
    return li;
  });
  const move =
    "moveBefore" in Element.prototype
      ? (node: Node) => (list as unknown as { moveBefore(n: Node, r: Node | null): void }).moveBefore(node, null)
      : (node: Node) => list.append(node);
  for (const child of [...list.children]) if (!items.includes(child as HTMLLIElement)) child.remove();
  for (const item of items)
    if (item.parentNode === list) move(item);
    else list.append(item);
  let hint = zone.querySelector<HTMLElement>(":scope > .z-upload__reorder-hint");
  if (sortable && !hint) {
    hint = document.createElement("span");
    hint.className = "z-sr-only z-upload__reorder-hint";
    hint.id = hintId;
    list.after(hint);
  }
  if (hint) hint.textContent = l.hint;
}

const say = (zone: HTMLElement, template: string, file: File, position: number, count: number) =>
  announce(fill(template, { name: file.name, position: position + 1, count }), { source: zone, delay: 300 });

function focusHandle(zone: HTMLElement, index: number): void {
  const handle = zone.querySelector<HTMLElement>(`.z-upload__tile[data-index="${index}"] .z-upload__handle`);
  handle?.closest(".z-upload__tile")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  handle?.focus({ preventScroll: true });
}

/** Lleva el archivo de `from` a `to`, lo guarda en el campo y avisa (`z:reorder` y `z:change`). */
export function reorderUpload(zone: HTMLElement, from: number, to: number): void {
  const files = Array.from(zone.querySelector<HTMLInputElement>(".z-upload__input")?.files ?? []);
  if (from === to || from < 0 || from >= files.length) return;
  const next = moveItem(files, from, to);
  setFiles(zone, next);
  renderFiles(zone, next);
  emit(zone, "reorder", { files: next, from, to: Math.max(0, Math.min(files.length - 1, to)) });
  emit(zone, "change", { files: next, rejected: [] });
}

function dropGrab(zone: HTMLElement, cancel = false): void {
  const session = sessions.get(zone);
  if (!session) return;
  sessions.delete(zone);
  const l = reorderLabels(zone);
  const files = Array.from(zone.querySelector<HTMLInputElement>(".z-upload__input")?.files ?? []);
  if (cancel) {
    renderFiles(zone, files);
    focusHandle(zone, session.origin);
    say(zone, l.cancelled, session.file, session.origin, files.length);
    return;
  }
  const at = session.order.indexOf(session.file);
  if (at === session.origin) {
    renderFiles(zone, files);
    return;
  }
  setFiles(zone, session.order);
  renderFiles(zone, session.order);
  emit(zone, "reorder", { files: session.order, from: session.origin, to: at });
  emit(zone, "change", { files: session.order, rejected: [] });
  say(zone, l.dropped, session.file, at, files.length);
}

function onHandleKey(zone: HTMLElement, handle: HTMLElement, event: KeyboardEvent): void {
  const session = sessions.get(zone);
  if (!session) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    dropGrab(zone, true);
    return;
  }
  const from = session.order.indexOf(session.file);
  const tilesNow = [...zone.querySelectorAll<HTMLElement>(".z-upload__tile")];
  const to = gridTarget(from, event.key, {
    count: session.order.length,
    columns: columnsOf(tilesNow.map((t) => t.getBoundingClientRect())),
    rtl: isRtl(handle),
  });
  if (to === null) {
    if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") event.preventDefault();
    return;
  }
  event.preventDefault();
  session.order = moveItem(session.order, from, to);
  renderFiles(zone, session.order);
  focusHandle(zone, to);
  say(zone, reorderLabels(zone).moved, session.file, to, session.order.length);
}

/** Arrastre con el puntero desde el asa: la casilla sigue al puntero y el destino sale de la rejilla quieta. */
function onHandleDown(zone: HTMLElement, handle: HTMLElement, event: PointerEvent): void {
  if (event.button !== 0 || sessions.has(zone) || uploadOff(zone)) return;
  const tile = handle.closest<HTMLElement>(".z-upload__tile");
  const list = zone.querySelector<HTMLElement>(".z-upload__files");
  if (!tile || !list) return;
  event.preventDefault();
  const pointer = event.pointerId;
  const start = { x: event.clientX, y: event.clientY };
  const all = [...list.querySelectorAll<HTMLElement>(".z-upload__tile")];
  const rects = all.map((el) => el.getBoundingClientRect());
  const from = all.indexOf(tile);
  let target = from;
  handle.setPointerCapture?.(pointer);
  list.setAttribute("data-sorting", "");
  tile.setAttribute("data-dragging", "");
  tile.setAttribute("data-grabbed", "");
  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    tile.style.setProperty("--z-drag-x", `${e.clientX - start.x}px`);
    tile.style.setProperty("--z-drag-y", `${e.clientY - start.y}px`);
    const next = nearestIndex(e.clientX, e.clientY, rects);
    if (next === -1 || next === target) return;
    all[target]?.removeAttribute("data-drop-target");
    target = next;
    if (target !== from) all[target]?.setAttribute("data-drop-target", "");
  };
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", end);
    tile.style.removeProperty("--z-drag-x");
    tile.style.removeProperty("--z-drag-y");
    for (const el of all) el.removeAttribute("data-drop-target");
    tile.removeAttribute("data-dragging");
    tile.removeAttribute("data-grabbed");
    list.removeAttribute("data-sorting");
    if (e.type !== "pointerup" || target === from) return;
    const files = zoneFiles(zone);
    const file = files[from];
    reorderUpload(zone, from, target);
    if (file) say(zone, reorderLabels(zone).dropped, file, target, files.length);
  };
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
}

/** Pinta la lista de archivos de la zona (si tiene `ul.z-upload__files`): miniatura, nombre, tamaño y quitar. */
function renderFiles(zone: HTMLElement, files: File[]): void {
  const target = zone.querySelector<HTMLElement>(".z-upload__files");
  if (!target) return;
  if (gridOf(zone)) {
    repainting.add(zone);
    try {
      renderGrid(zone, target, files);
    } finally {
      repainting.delete(zone);
    }
    return;
  }
  const removable = !zone.hasAttribute("data-disabled");
  target.replaceChildren(
    ...files.map((file, index) => {
      const item = document.createElement("li");
      item.className = "z-upload__file";
      const thumb = document.createElement("span");
      thumb.className = "z-upload__thumb";
      thumb.setAttribute("aria-hidden", "true");
      if (file.type.startsWith("image/")) {
        // La miniatura se dibuja en un lienzo: el archivo no pasa por ninguna URL ni atributo `src`.
        setMarkup(thumb, iconSvg("photo", { size: 16 }));
        const canvas = document.createElement("canvas");
        void drawThumbnail(canvas, file, 28).then((drawn) => {
          if (drawn && thumb.isConnected) thumb.replaceChildren(canvas);
        });
      } else setMarkup(thumb, iconSvg("document", { size: 16 }));
      const main = document.createElement("span");
      main.className = "z-upload__file-main";
      const name = document.createElement("span");
      name.className = "z-upload__file-name";
      name.textContent = file.name;
      main.append(name);
      const size = document.createElement("span");
      size.className = "z-upload__file-size";
      size.textContent = fileSize(file.size);
      item.append(thumb, main, size);
      if (removable) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "z-upload__remove";
        remove.dataset.index = String(index);
        const label = (zone.dataset.removeLabel ?? "Remove {name}").replace("{name}", file.name);
        remove.setAttribute("aria-label", label);
        remove.title = label;
        setMarkup(remove, iconSvg("x-mark", { size: 14 }));
        item.append(remove);
      }
      return item;
    }),
  );
}

function removeFile(zone: HTMLElement, index: number): void {
  const input = zone.querySelector<HTMLInputElement>(".z-upload__input");
  if (!input) return;
  const files = Array.from(input.files ?? []).filter((_, i) => i !== index);
  try {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
  } catch {
    // Sin DataTransfer construible el campo no se puede recortar.
  }
  renderFiles(zone, files);
  emit(zone, "change", { files, rejected: [] });
}

/** Lo que tenía el campo antes de abrir el selector (el navegador lo vacía al elegir). */
const previous = new WeakMap<HTMLElement, File[]>();

function deliver(zone: HTMLElement, list: FileList | null | undefined): void {
  const input = zone.querySelector<HTMLInputElement>(".z-upload__input");
  if (!input) return;
  const every = Array.from(list ?? []);
  const picked = input.multiple ? every : every.slice(0, 1);
  const limit = num(zone.dataset.maxSize, Infinity);
  const accepted = picked.filter((file) => matchesAccept(file, input.accept) && file.size <= limit);
  const rejected = picked.filter((file) => !accepted.includes(file));
  // En rejilla con `multiple` se suman a las que ya había (añadir fotos a un anuncio no borra las anteriores).
  const files = gridOf(zone) && input.multiple ? [...(previous.get(zone) ?? []), ...accepted] : accepted;
  // El campo conserva solo lo aceptado: el formulario envía lo mismo que se muestra.
  try {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
  } catch {
    // Navegador sin DataTransfer construible: el campo queda como estaba.
  }
  previous.set(zone, files);
  renderFiles(zone, files);
  emit(zone, "change", { files, rejected });
}

const uploadZone = (target: EventTarget | null) => {
  const zone = target instanceof Element ? target.closest<HTMLElement>(".z-upload") : null;
  return zone && inDom(zone) ? zone : null;
};
const uploadOff = (zone: HTMLElement) =>
  zone.hasAttribute("data-disabled") || zone.querySelector<HTMLInputElement>(".z-upload__input")?.disabled === true;

/* ---------- Delegación ---------- */

export function setup(on: Listen): void {
  on(document, "pointerdown", onSliderDown);
  on(document, "pointermove", (event) => {
    if (drag && event.pointerId === drag.pointer) moveThumb(drag.slider, drag.index, valueAtPointer(drag.slider, event));
  });
  const release = (event: PointerEvent) => {
    if (drag && event.pointerId === drag.pointer) drag = undefined;
  };
  on(document, "pointerup", release);
  on(document, "pointercancel", release);

  on(document, "keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || event.defaultPrevented || typeof event.key !== "string") return;
    if (target.matches(".z-slider__thumb")) return onSliderKey(target, event);
    if (target.matches(".z-upload__handle")) {
      const zone = uploadZone(target);
      if (zone) onHandleKey(zone, target, event);
      return;
    }
    const otp = target.matches(".z-otp__cell") ? target.closest<HTMLElement>(".z-otp") : null;
    if (otp && inDom(otp)) onOtpKey(otp, target as HTMLInputElement, event);
  });
  on(document, "input", (event) => {
    const cell = event.target as HTMLElement;
    const otp = cell.matches?.(".z-otp__cell") ? cell.closest<HTMLElement>(".z-otp") : null;
    if (otp && inDom(otp)) onOtpInput(otp, cell as HTMLInputElement);
  });
  on(document, "paste", (event) => {
    const cell = event.target as HTMLElement;
    const otp = cell.matches?.(".z-otp__cell") ? cell.closest<HTMLElement>(".z-otp") : null;
    if (!otp || !inDom(otp)) return;
    event.preventDefault();
    const pasted = otpClean(otp, event.clipboardData?.getData("text") ?? "");
    if (!pasted) return;
    commitOtp(otp, pasted);
    focusCell(otp, Math.min(pasted.length, otpCells(otp).length - 1));
  });
  on(document, "focusin", (event) => {
    const cell = event.target as HTMLElement;
    if (cell.matches?.(".z-otp__cell") && inDom(cell)) (cell as HTMLInputElement).select();
  });

  on(document, "dragover", (event) => {
    const zone = uploadZone(event.target);
    if (!zone) return;
    event.preventDefault();
    if (!uploadOff(zone)) zone.setAttribute("data-dragging", "true");
  });
  on(document, "dragleave", (event) => {
    const zone = uploadZone(event.target);
    if (zone && !zone.contains(event.relatedTarget as Node | null)) zone.removeAttribute("data-dragging");
  });
  on(document, "drop", (event) => {
    const zone = uploadZone(event.target);
    if (!zone) return;
    event.preventDefault();
    zone.removeAttribute("data-dragging");
    if (!uploadOff(zone)) deliver(zone, event.dataTransfer?.files);
  });
  on(document, "click", (event) => {
    const target = (event.target as Element).closest?.<HTMLElement>(".z-upload__remove, .z-upload__handle, .z-upload__make-cover");
    const zone = target ? uploadZone(target) : null;
    if (!target || !zone) return;
    // Dentro de la etiqueta: los botones de la lista no abren el selector.
    event.preventDefault();
    const index = Number(target.dataset.index);
    if (target.matches(".z-upload__remove")) {
      sessions.delete(zone);
      removeFile(zone, index);
    } else if (target.matches(".z-upload__make-cover")) {
      const file = zoneFiles(zone)[index];
      reorderUpload(zone, index, 0);
      if (file) {
        emit(zone, "cover", { file });
        announce(fill(reorderLabels(zone).coverChanged, { name: file.name }), { source: zone, delay: 300 });
      }
      focusHandle(zone, 0);
    } else if (event.detail === 0) {
      // Asa: Espacio o Intro (o la activación de un lector, clic sin puntero) cogen y sueltan. Un clic de ratón no.
      if (sessions.has(zone)) dropGrab(zone);
      else {
        const files = zoneFiles(zone);
        const file = files[index];
        if (!file) return;
        sessions.set(zone, { file, origin: index, order: files });
        renderFiles(zone, files);
        focusHandle(zone, index);
        say(zone, reorderLabels(zone).grabbed, file, index, files.length);
      }
    }
  });
  on(document, "pointerdown", (event) => {
    const handle = (event.target as Element).closest?.<HTMLElement>(".z-upload__handle");
    const zone = handle ? uploadZone(handle) : null;
    if (handle && zone) onHandleDown(zone, handle, event);
  });
  // El asa que pierde el foco (Tab a otro control) suelta; el desenfoque que causa el repintado no cuenta.
  on(document, "focusout", (event) => {
    const handle = (event.target as Element).closest?.<HTMLElement>(".z-upload__handle");
    const zone = handle ? uploadZone(handle) : null;
    if (!zone || !sessions.has(zone) || repainting.has(zone)) return;
    const next = event.relatedTarget as Element | null;
    if (next?.matches?.(".z-upload__handle") && zone.contains(next)) return;
    dropGrab(zone);
  });
  on(document, "change", (event) => {
    const input = event.target as HTMLElement;
    const zone = input.matches?.(".z-upload__input") ? uploadZone(input) : null;
    if (zone) deliver(zone, (input as HTMLInputElement).files);
  });
}

export function hydrate(root: ParentNode): void {
  for (const slider of all(root, ".z-slider")) paintSlider(slider, sliderConfig(slider).values);
  for (const otp of all(root, ".z-otp")) writeOtp(otp, otpClean(otp, otpValue(otp)));
}
