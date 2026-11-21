// Piezas de árbol de la familia de agenda: año perpetuo, línea temporal, buscar hueco, franjas (SlotPicker, con un
// Calendar incrustado que pinta ./forms-calendar), mapa de calor y rachas.
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { buildingOffice } from "@zuccadev-labs/zuix-zicon/icons/building-office";
import { check } from "@zuccadev-labs/zuix-zicon/icons/check";
import { chevronDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-down";
import { chevronLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-left";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { chevronUpDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-up-down";
import { exclamationTriangle } from "@zuccadev-labs/zuix-zicon/icons/exclamation-triangle";
import { fire } from "@zuccadev-labs/zuix-zicon/icons/fire";
import { flag } from "@zuccadev-labs/zuix-zicon/icons/flag";
import { globeAlt } from "@zuccadev-labs/zuix-zicon/icons/globe-alt";
import { tableCells } from "@zuccadev-labs/zuix-zicon/icons/table-cells";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { freeBusyWidget } from "../core/freebusy-widget";
import { habitWidget } from "../core/habit-widget";
import { heatmapWidget } from "../core/heatmap-widget";
import { perpetualWidget } from "../core/perpetual-widget";
import { slotPickerWidget } from "../core/slots-widget";
import { timelineWidget } from "../core/timeline-widget";
import { findSlots, type VAttr, type VNode } from "../core/vnode";
import { setCalendarOptions, type CalendarOptions } from "./forms-calendar";
import { registerSlotFill, widgetPart } from "./widgets";

registerIcons([
  buildingOffice,
  check,
  chevronDown,
  chevronLeft,
  chevronRight,
  chevronUpDown,
  exclamationTriangle,
  fire,
  flag,
  globeAlt,
  tableCells,
  xMark,
]);

export const agendaWidgets = /* @__PURE__ */ widgetPart(45, [
  perpetualWidget,
  timelineWidget,
  freeBusyWidget,
  slotPickerWidget,
  heatmapWidget,
  habitWidget,
]);

// Calendar incrustados: atributos del modo DOM y funciones con setCalendarOptions (que lo pinta).
registerSlotFill((el: HTMLElement, nodes: VNode[]) => {
  for (const slot of findSlots(nodes, "calendar")) {
    const cal = el.querySelector<HTMLElement>(`.z-calendar[data-slot="${CSS.escape(String(slot.p.name ?? ""))}"]`);
    if (!cal) continue;
    const attrs = (slot.p.attrs ?? {}) as Record<string, VAttr>;
    for (const [k, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) cal.removeAttribute(k);
      else if (cal.getAttribute(k) !== String(value === true ? "" : value)) cal.setAttribute(k, value === true ? "" : String(value));
    }
    setCalendarOptions(cal, (slot.p.options ?? {}) as CalendarOptions);
  }
});
