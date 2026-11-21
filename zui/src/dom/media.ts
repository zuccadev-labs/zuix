// Piezas de medios sin framework (oleada 7): QRCode, CircularSlider, CompareSlider, ImageCropper, SignaturePad,
// ShortcutInput, Confetti y DownloadTrigger. Cada una se pinta con el mismo árbol que el binding de React
// (core/vnode) y la misma interacción (core/widget), dentro de `[data-z-dom]`. Configuración en `data-*` o en
// `<script type="application/json" data-props>`; datos por propiedad con setWidgetProps(el, props).
import { qrcodeWidget } from "../core/qr-widget";
import { registerWidget } from "./widgets";

for (const widget of [qrcodeWidget]) registerWidget(widget);

export function setup(): void {}
export function hydrate(): void {}
