// Piezas de árbol de la familia de datos sin framework: TransferList, NotificationCenter y FilterBar, con el mismo
// árbol (core/vnode) y la misma interacción que el binding de React. Los datos llegan en
// `<script type="application/json" data-props>` (`{ "items": […], "value": […] }`, `{ "notifications": […] }`,
// `{ "filters": […] }`) o por `setWidgetProps(el, props)`; los cambios salen como `z:change` (TransferList y
// FilterBar) y `z:readchange`, `z:readall`, `z:action` y `z:openchange` (NotificationCenter).
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { bell } from "@zuccadev-labs/zuix-zicon/icons/bell";
import { bellAlert } from "@zuccadev-labs/zuix-zicon/icons/bell-alert";
import { bellSlash } from "@zuccadev-labs/zuix-zicon/icons/bell-slash";
import { check } from "@zuccadev-labs/zuix-zicon/icons/check";
import { chevronDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-down";
import { chevronDoubleLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-double-left";
import { chevronDoubleRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-double-right";
import { chevronLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-left";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { magnifyingGlass } from "@zuccadev-labs/zuix-zicon/icons/magnifying-glass";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { filterBarWidget } from "../core/filter-bar-widget";
import { notificationCenterWidget } from "../core/notification-center-widget";
import { transferListWidget } from "../core/transfer-widget";
import { widgetPart } from "./widgets";

registerIcons([
  bell,
  bellAlert,
  bellSlash,
  check,
  chevronDown,
  xMark,
  chevronDoubleLeft,
  chevronDoubleRight,
  chevronLeft,
  chevronRight,
  magnifyingGlass,
]);

export const dataWidgets = /* @__PURE__ */ widgetPart(45.05, [transferListWidget, notificationCenterWidget, filterBarWidget]);
