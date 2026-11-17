// Slider, OTPInput y FileUpload sin framework.
import { matchesAccept } from "../core/accept";
import { isRtl } from "../core/dir";
import { closestThumb, keyValue, moveThumb as nextValues, percent as percentOf, snap, valueAt } from "../core/slider";
import { all, emit, flag, inDom } from "./forms-popup";
import type { Listen } from "./shared";

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

function deliver(zone: HTMLElement, list: FileList | null | undefined): void {
  const input = zone.querySelector<HTMLInputElement>(".z-upload__input");
  if (!input) return;
  const every = Array.from(list ?? []);
  const picked = input.multiple ? every : every.slice(0, 1);
  const limit = num(zone.dataset.maxSize, Infinity);
  const files = picked.filter((file) => matchesAccept(file, input.accept) && file.size <= limit);
  const rejected = picked.filter((file) => !files.includes(file));
  // El campo conserva solo lo aceptado: el formulario envía lo mismo que se muestra.
  try {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
  } catch {
    // Navegador sin DataTransfer construible: el campo queda como estaba.
  }
  const target = zone.querySelector<HTMLElement>(".z-upload__files");
  if (target) {
    target.replaceChildren(
      ...files.map((file) => {
        const item = document.createElement("li");
        item.className = "z-upload__file";
        const name = document.createElement("span");
        name.className = "z-upload__file-name";
        name.textContent = file.name;
        const size = document.createElement("span");
        size.className = "z-upload__file-size";
        size.textContent = fileSize(file.size);
        item.append(name, size);
        return item;
      }),
    );
  }
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
