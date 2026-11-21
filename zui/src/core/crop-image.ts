// Dibujo del recorte de ImageCropper (core/crop) en un canvas o un Blob. Toca el documento solo al llamarse.

import { cropPixels, outputSize, type Crop } from "./crop";

export interface CropImageOptions {
  /** Lado mayor de la salida en píxeles. */
  maxSize?: number;
  /** Recorte circular: lo de fuera queda transparente. */
  shape?: "rect" | "circle";
}

/**
 * Dibuja el recorte de una imagen en un canvas nuevo. La imagen debe estar cargada y, si es de otro origen, servida
 * con CORS (si no, el canvas queda «contaminado» y `toBlob` falla).
 */
export function cropImage(image: HTMLImageElement | HTMLCanvasElement, crop: Crop, options: CropImageOptions = {}): HTMLCanvasElement {
  const nw = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const nh = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  const px = cropPixels(crop, nw, nh);
  const out = outputSize(px.width, px.height, options.maxSize);
  const canvas = image.ownerDocument.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  if (options.shape === "circle") {
    ctx.beginPath();
    ctx.ellipse(out.width / 2, out.height / 2, out.width / 2, out.height / 2, 0, 0, Math.PI * 2);
    ctx.clip();
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, px.x, px.y, px.width, px.height, 0, 0, out.width, out.height);
  return canvas;
}

/** El recorte como Blob (PNG por defecto; `image/jpeg` o `image/webp` con calidad). */
export function cropImageBlob(
  image: HTMLImageElement | HTMLCanvasElement,
  crop: Crop,
  options: CropImageOptions & { type?: string; quality?: number } = {},
): Promise<Blob> {
  const canvas = cropImage(image, crop, options);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo exportar el recorte"))),
      options.type ?? "image/png",
      options.quality,
    ),
  );
}
