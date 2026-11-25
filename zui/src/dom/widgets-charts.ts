// Piezas de árbol de la familia de gráficos: Chart (área, barras, bala, combinado, dispersión, donut, líneas, mapa de
// calor, radar, tarta), CategoryBar, AnimatedNumber y Sparkline.
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { tableCells } from "@zuccadev-labs/zuix-zicon/icons/table-cells";
import { animatedNumberWidget } from "../core/animated-number";
import { categoryBarWidget } from "../core/category-bar";
import { chartWidget } from "../core/chart-widget";
import { sparklineWidget } from "../core/sparkline";
import { widgetPart } from "./widgets";

registerIcons([tableCells]);

export const chartWidgets = /* @__PURE__ */ widgetPart(45.1, [chartWidget, categoryBarWidget, animatedNumberWidget, sparklineWidget]);
