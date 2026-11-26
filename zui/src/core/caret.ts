// Posición del cursor de un `<textarea>` o un `<input>` en la ventana, para anclar una lista (las menciones) donde se
// escribe. Un espejo invisible con la misma tipografía, ancho y desplazamiento que el campo y el texto hasta el cursor:
// el marcador al final es el cursor. Solo toca el documento al llamarse; el espejo se crea y se retira en la llamada.

const COPIED = [
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
  "direction",
] as const;

export interface CaretBox {
  x: number;
  y: number;
  height: number;
}

/** Caja del cursor (en `position`) en coordenadas de la ventana. */
export function caretBox(field: HTMLTextAreaElement | HTMLInputElement, position = field.selectionStart ?? field.value.length): CaretBox {
  const doc = field.ownerDocument;
  const style = getComputedStyle(field);
  const mirror = doc.createElement("div");
  const s = mirror.style;
  for (const prop of COPIED) s.setProperty(prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), style.getPropertyValue(prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)));
  s.position = "absolute";
  s.visibility = "hidden";
  s.top = "0";
  s.left = "-9999px";
  s.whiteSpace = field instanceof HTMLTextAreaElement ? "pre-wrap" : "pre";
  s.overflowWrap = field instanceof HTMLTextAreaElement ? "break-word" : "normal";
  mirror.textContent = field.value.slice(0, position);
  const marker = doc.createElement("span");
  marker.textContent = field.value.slice(position) || ".";
  mirror.append(marker);
  doc.body.append(mirror);
  const box = field.getBoundingClientRect();
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.3 || 16;
  const x = box.left + marker.offsetLeft - field.scrollLeft + (Number.parseFloat(style.borderLeftWidth) || 0);
  const y = box.top + marker.offsetTop - field.scrollTop + (Number.parseFloat(style.borderTopWidth) || 0);
  mirror.remove();
  return { x: Math.min(Math.max(x, box.left), box.right), y: Math.min(Math.max(y, box.top), box.bottom - lineHeight), height: lineHeight };
}
