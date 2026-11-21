// ImageCropper: el recorte es un rectángulo en fracciones de la imagen (0–1), independiente de su tamaño en pantalla.
// Mover, redimensionar desde ocho asas con relación de aspecto fija u opcional, teclado y paso a píxeles. Sin
// documento: el dibujo del recorte está en ./crop-image.

export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export const CROP_HANDLES: readonly CropHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const round = (c: Crop): Crop => ({ x: r4(c.x), y: r4(c.y), width: r4(c.width), height: r4(c.height) });

/**
 * Relación del recorte en fracciones: un recorte de `aspect` (ancho/alto en píxeles) sobre una imagen de
 * `imageAspect` tiene `width / height = aspect / imageAspect` en fracciones.
 */
const fracAspect = (aspect: number, imageAspect: number) => aspect / (imageAspect > 0 ? imageAspect : 1);

/** Recorte inicial: centrado, el mayor con esa relación que cabe en `fill` (0–1) de la imagen. */
export function initialCrop(aspect: number | undefined, imageAspect: number, fill = 0.8): Crop {
  if (!aspect || !(aspect > 0)) return round({ x: (1 - fill) / 2, y: (1 - fill) / 2, width: fill, height: fill });
  const ratio = fracAspect(aspect, imageAspect);
  let width = fill;
  let height = width / ratio;
  if (height > fill) {
    height = fill;
    width = height * ratio;
  }
  return round({ x: (1 - width) / 2, y: (1 - height) / 2, width, height });
}

/** Lleva un recorte dentro de la imagen y por encima del tamaño mínimo (sin deformar la relación si la hay). */
export function clampCrop(c: Crop, aspect: number | undefined, imageAspect: number, min = 0.05): Crop {
  let { width, height } = c;
  width = clamp(width, min, 1);
  height = clamp(height, min, 1);
  if (aspect && aspect > 0) {
    const ratio = fracAspect(aspect, imageAspect);
    // La dimensión que se pasa de la imagen manda.
    if (width / ratio > 1) width = ratio;
    height = width / ratio;
    if (height > 1) {
      height = 1;
      width = ratio;
    }
    if (height < min) {
      height = min;
      width = Math.min(1, min * ratio);
    }
  }
  return round({ x: clamp(c.x, 0, 1 - width), y: clamp(c.y, 0, 1 - height), width, height });
}

/** Desplaza sin salirse de la imagen. */
export function moveCrop(c: Crop, dx: number, dy: number): Crop {
  return round({ ...c, x: clamp(c.x + dx, 0, 1 - c.width), y: clamp(c.y + dy, 0, 1 - c.height) });
}

/**
 * Redimensiona desde un asa: el lado o la esquina opuestos quedan fijos. Con relación de aspecto, en una esquina
 * manda el eje que más se mueve y en un lado la otra dimensión crece centrada.
 */
export function resizeCrop(
  c: Crop,
  handle: CropHandle,
  dx: number,
  dy: number,
  aspect: number | undefined,
  imageAspect: number,
  min = 0.05,
): Crop {
  const left0 = c.x;
  const top0 = c.y;
  const right0 = c.x + c.width;
  const bottom0 = c.y + c.height;
  let left = left0;
  let top = top0;
  let right = right0;
  let bottom = bottom0;
  if (handle.includes("w")) left = clamp(left0 + dx, 0, right0 - min);
  if (handle.includes("e")) right = clamp(right0 + dx, left0 + min, 1);
  if (handle.includes("n")) top = clamp(top0 + dy, 0, bottom0 - min);
  if (handle.includes("s")) bottom = clamp(bottom0 + dy, top0 + min, 1);
  if (!aspect || !(aspect > 0)) return round({ x: left, y: top, width: right - left, height: bottom - top });

  const ratio = fracAspect(aspect, imageAspect);
  let width = right - left;
  let height = bottom - top;
  const corner = handle.length === 2;
  if (corner) {
    // Manda el eje con más cambio relativo; el otro se deduce.
    if (Math.abs(width - c.width) * 1 >= Math.abs(height - c.height) * ratio) height = width / ratio;
    else width = height * ratio;
  } else if (handle === "e" || handle === "w") height = width / ratio;
  else width = height * ratio;
  // Lo que se sale de la imagen se recorta manteniendo la relación.
  const anchorX = handle.includes("w") ? right0 : handle.includes("e") ? left0 : c.x + c.width / 2;
  const anchorY = handle.includes("n") ? bottom0 : handle.includes("s") ? top0 : c.y + c.height / 2;
  const maxW = handle.includes("w") ? anchorX : handle.includes("e") ? 1 - anchorX : 2 * Math.min(anchorX, 1 - anchorX);
  const maxH = handle.includes("n") ? anchorY : handle.includes("s") ? 1 - anchorY : 2 * Math.min(anchorY, 1 - anchorY);
  const scale = Math.min(1, maxW / width, maxH / height);
  width *= scale;
  height *= scale;
  if (width < min || height < min) {
    const grow = Math.max(min / width, min / height);
    width *= grow;
    height *= grow;
  }
  const x = handle.includes("w") ? anchorX - width : handle.includes("e") ? anchorX : anchorX - width / 2;
  const y = handle.includes("n") ? anchorY - height : handle.includes("s") ? anchorY : anchorY - height / 2;
  return round({ x: clamp(x, 0, 1 - width), y: clamp(y, 0, 1 - height), width, height });
}

/**
 * Teclado del área de recorte: flechas mueven; con Mayúsculas redimensionan desde la esquina inferior final (abajo y
 * a la derecha); `step` es la fracción de un paso (0,01) y con Alt el paso es diez veces mayor. `dirX` es -1 en RTL.
 * Inicio y Fin llevan el recorte al borde izquierdo y derecho. `undefined` si la tecla no hace nada.
 */
export function keyCrop(
  c: Crop,
  key: string,
  mods: { shift?: boolean; alt?: boolean },
  aspect: number | undefined,
  imageAspect: number,
  dirX: 1 | -1 = 1,
  step = 0.01,
): Crop | undefined {
  const s = mods.alt ? step * 10 : step;
  const dx = key === "ArrowRight" ? s * dirX : key === "ArrowLeft" ? -s * dirX : 0;
  const dy = key === "ArrowDown" ? s : key === "ArrowUp" ? -s : 0;
  if (key === "Home") return moveCrop(c, -1, 0);
  if (key === "End") return moveCrop(c, 1, 0);
  if (!dx && !dy) return undefined;
  if (mods.shift) {
    // Con relación fija, las dos flechas del mismo sentido hacen crecer o encoger la esquina.
    const grow = aspect ? dx || dy : 0;
    return resizeCrop(c, "se", aspect ? grow : dx, aspect ? grow : dy, aspect, imageAspect);
  }
  return moveCrop(c, dx, dy);
}

/** Recorte en píxeles enteros de la imagen original. */
export function cropPixels(c: Crop, naturalWidth: number, naturalHeight: number): { x: number; y: number; width: number; height: number } {
  const x = Math.round(c.x * naturalWidth);
  const y = Math.round(c.y * naturalHeight);
  return {
    x,
    y,
    width: Math.max(1, Math.min(naturalWidth - x, Math.round(c.width * naturalWidth))),
    height: Math.max(1, Math.min(naturalHeight - y, Math.round(c.height * naturalHeight))),
  };
}

/** Lado de salida: el del recorte en píxeles, reducido para no pasar de `maxSize` en su lado mayor. */
export function outputSize(width: number, height: number, maxSize?: number): { width: number; height: number } {
  if (!maxSize || !(maxSize > 0) || Math.max(width, height) <= maxSize) return { width, height };
  const k = maxSize / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}
