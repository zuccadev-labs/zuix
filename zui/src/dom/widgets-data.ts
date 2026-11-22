// Piezas de árbol de la familia de datos sin framework: TransferList, con el mismo árbol (core/vnode) y la misma
// interacción que el binding de React. Los elementos llegan en `<script type="application/json" data-props>`
// (`{ "items": […], "value": […] }`) o por `setWidgetProps(el, { items, value })`; los cambios salen como `z:change`.
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { check } from "@zuccadev-labs/zuix-zicon/icons/check";
import { chevronDoubleLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-double-left";
import { chevronDoubleRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-double-right";
import { chevronLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-left";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { magnifyingGlass } from "@zuccadev-labs/zuix-zicon/icons/magnifying-glass";
import { transferListWidget } from "../core/transfer-widget";
import { widgetPart } from "./widgets";

registerIcons([check, chevronDoubleLeft, chevronDoubleRight, chevronLeft, chevronRight, magnifyingGlass]);

export const dataWidgets = /* @__PURE__ */ widgetPart(45.05, [transferListWidget]);
