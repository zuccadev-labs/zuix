/**
 * Miniatura de una imagen elegida por la persona, dibujada en un `<canvas>`.
 *
 * El archivo se decodifica con `createImageBitmap` y se pinta recortado al centro: no pasa por ninguna URL
 * (`blob:` ni `data:`) ni por un atributo `src`, así que el contenido del archivo nunca se interpreta como marcado
 * ni como dirección. Devuelve `false` si el navegador no puede decodificarlo (formato no admitido, archivo dañado o
 * sin `createImageBitmap`); quien llama pone entonces su icono.
 */
export async function drawThumbnail(canvas: HTMLCanvasElement, file: Blob, size: number): Promise<boolean> {
  if (typeof createImageBitmap !== "function") return false;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return false;
  }
  try {
    const ratio = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));
    const px = Math.round(size * ratio);
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    if (!ctx || !bitmap.width || !bitmap.height) return false;
    const side = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, px, px);
    return true;
  } finally {
    bitmap.close();
  }
}
