// Piezas de árbol de la familia de gráficos: Chart (área, barras, donut, líneas, tarta) y Sparkline.
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { tableCells } from "@zuccadev-labs/zuix-zicon/icons/table-cells";
import { chartWidget } from "../core/chart-widget";
import { sparklineWidget } from "../core/sparkline";
import { widgetPart } from "./widgets";

registerIcons([tableCells]);

export const chartWidgets = /* @__PURE__ */ widgetPart(45.1, [chartWidget, sparklineWidget]);
