// QRCode: el código de `core/qr` dibujado como un único `path` de SVG, oscuro sobre claro siempre (los lectores
// esperan ese contraste) con su zona de silencio. Imagen con nombre; un icono opcional en el centro, que sube la
// corrección a H. Un solo árbol (core/vnode) para React (sin estado: vale en un Server Component) y el modo DOM.

import { encodeQr, isQrLevel, logoModules, qrPath, type QrLevel } from "./qr";
import { fill, h, icon, type VEl } from "./vnode";
import type { Widget } from "./widget";

export interface QRCodeLabels {
  /** Nombre accesible: «QR code: {value}». */
  image: string;
  /** Texto cuando no cabe ni en la versión 40. */
  tooLong: string;
}
export const QRCODE_LABELS: QRCodeLabels = { image: "QR code: {value}", tooLong: "Text too long for a QR code" };

export interface QRCodeProps {
  /** Texto o URL que codifica (UTF-8, modo byte). */
  value: string;
  /** Corrección de errores: L 7 %, M 15 %, Q 25 %, H 30 %. */
  level?: QrLevel;
  /** Lado en píxeles (por defecto 160). */
  size?: number;
  /** Zona de silencio en módulos (por defecto 4, lo que pide la norma; mínimo 0). */
  margin?: number;
  /** Icono de zicon en el centro (sube la corrección a H). */
  icon?: string;
  /** Nombre accesible propio (por defecto «QR code: {value}»). */
  label?: string;
  labels?: Partial<QRCodeLabels>;
}

export function qrcodeTree(p: QRCodeProps): VEl {
  const labels = { ...QRCODE_LABELS, ...p.labels };
  const value = String(p.value ?? "");
  const level: QrLevel = p.icon ? "H" : isQrLevel(p.level) ? p.level : "M";
  const margin = Number.isFinite(p.margin) ? Math.max(0, Math.min(8, Math.floor(p.margin!))) : 4;
  const size = Number.isFinite(p.size) && p.size! > 0 ? p.size! : 160;
  const code = encodeQr(value, { level });
  const attrs = {
    class: "z-qrcode",
    role: "img",
    "aria-label": p.label ?? fill(labels.image, { value }),
    "data-value": value,
    "data-level": level,
    "data-margin": margin,
    "data-size": size,
    "data-icon": p.icon,
    s: { "--z-qrcode-size": `${size}px` },
  };
  if (!code)
    return h(
      "div",
      { ...attrs, "data-invalid": "", "aria-label": labels.tooLong },
      h("span", { class: "z-qrcode__error" }, labels.tooLong),
    );
  // Con icono, se vacían los módulos del centro (la corrección H los recupera).
  let modules = code.modules;
  const hole = p.icon ? logoModules(code.size, level) : 0;
  if (hole) {
    const from = Math.floor((code.size - hole) / 2);
    modules = code.modules.map((row, y) => row.map((m, x) => m && !(x >= from && x < from + hole && y >= from && y < from + hole)));
  }
  const n = code.size + margin * 2;
  return h(
    "div",
    { ...attrs, "data-version": code.version, "data-mask": code.mask, s: { ...attrs.s, "--z-qrcode-hole": hole / n } },
    h(
      "svg",
      { class: "z-qrcode__svg", viewBox: `0 0 ${n} ${n}`, "aria-hidden": "true", focusable: "false", "shape-rendering": "crispEdges" },
      h("path", { class: "z-qrcode__modules", d: qrPath({ size: code.size, modules }, margin) }),
    ),
    p.icon ? h("span", { class: "z-qrcode__logo", "aria-hidden": "true" }, icon(p.icon, 24)) : null,
  );
}

export const qrcodeWidget: Widget<QRCodeProps, QRCodeProps, null> = {
  root: "z-qrcode",
  configure: (p) => p,
  initial: () => null,
  tree: (config) => qrcodeTree(config),
  attach: () => () => {},
  after: () => {},
  fromDom(el, json) {
    const d = el.dataset;
    return {
      value: (json.value as string | undefined) ?? d.value ?? "",
      level: isQrLevel(d.level) ? d.level : undefined,
      size: d.size ? Number(d.size) : (json.size as number | undefined),
      margin: d.margin ? Number(d.margin) : undefined,
      icon: d.icon,
      label: d.label,
      labels: json.labels as Partial<QRCodeLabels> | undefined,
    };
  },
};
