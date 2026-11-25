// @zuccadev-labs/zuix-zui/dom/forms — Cascader, TreeSelect y MaskedInput sin framework. Registro: init(formsModule) o
// use(formsModule) junto a @zuccadev-labs/zuix-zui/dom/core.
//
// Cascader    .z-cascader con data-name, data-multiple, data-searchable, data-change-on-select, data-clearable,
//             data-required, data-disabled, data-separator, data-strategy="parent|all|child", data-placeholder,
//             data-label y `<script type="application/json" data-props>{ "options": […], "value": […],
//             "levelLabels": […], "labels": {…} }</script>`. Carga diferida: setWidgetProps(el, { loadChildren }).
//             z:change { value, labels, option }, z:load { path, options }, z:loaderror { path, error }.
// TreeSelect  .z-treeselect con data-name, data-multiple, data-searchable="false", data-clearable, data-required,
//             data-disabled, data-strategy, data-max-chips, data-placeholder, data-label y `{ "nodes": […],
//             "value": …, "defaultExpanded": […] }` en data-props. z:change { value, label | labels }.
// MaskedInput ver ../forms-masked.
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { check } from "@zuccadev-labs/zuix-zicon/icons/check";
import { chevronDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-down";
import { chevronLeft } from "@zuccadev-labs/zuix-zicon/icons/chevron-left";
import { chevronRight } from "@zuccadev-labs/zuix-zicon/icons/chevron-right";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import { cascaderWidget } from "../../core/cascader-widget";
import { treeSelectWidget } from "../../core/tree-select-widget";
import { maskedPart } from "../forms-masked";
import type { DomModule } from "../shared";
import { widgetPart } from "../widgets";

export { setMask, setMaskedValue } from "../forms-masked";
export { destroyWidget, setWidgetProps } from "../widgets";
export { applyMask, extractRaw, maskTemplate, MASK_PRESETS, type MaskPreset, type MaskSpec } from "../../core/mask";
export { searchPaths, type CascaderOption } from "../../core/cascader";
export { filterTree, strategyValue, type ShowStrategy, type TreeSelectNode } from "../../core/tree-select";

registerIcons([check, chevronDown, chevronLeft, chevronRight, xMark]);

export const formsModule: DomModule = {
  name: "forms",
  parts: [widgetPart(45.1, [cascaderWidget, treeSelectWidget]), maskedPart],
};
