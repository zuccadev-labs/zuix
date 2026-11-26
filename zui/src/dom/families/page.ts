// @zuccadev-labs/zuix-zui/dom/page — piezas de página sin framework: TableOfContents, BackToTop, Affix, TopProgress,
// DataView, OverflowList, SearchView y Popconfirm. Registro: init(pageModule) o use(pageModule) junto a
// @zuccadev-labs/zuix-zui/dom/core.
//
// TableOfContents  .z-toc con data-label, data-compact, data-open, data-offset, data-smooth="false", data-active y
//                  `{ "items": [{ "id", "label", "level" }] }` en data-props. z:activechange { id }.
// BackToTop        .z-back-to-top con data-threshold, data-target, data-focus-target, data-placement="fixed",
//                  data-show-label y data-label. z:click.
// TopProgress      .z-top-progress (sin data-value sigue a `topProgress`), data-value (0–100), data-active,
//                  data-indeterminate, data-inline, data-label. `topProgress.start()` / `.done()`.
// Affix            .z-affix con data-side y --z-affix-offset. z:stuckchange { stuck }.
// DataView         .z-dataview con data-layout y data-persist="clave"; el conmutador es un SegmentedControl
//                  .z-dataview__switch. z:layoutchange { layout }.
// OverflowList     .z-overflow-list con .z-overflow-list__item[data-id], el botón .z-overflow-list__more
//                  (data-z-open al menú) y en el menú una entrada [data-overflow-for] por elemento. data-side="start",
//                  data-min-visible, data-more-label="{count} more".
// SearchView       .z-searchview con la barra y el <dialog class="z-searchview__view">. z:open, z:close,
//                  z:valuechange { value }, z:submit { value }. setSearchViewOpen(el, open).
// Popconfirm       .z-popover.z-popconfirm[popover] con un botón [data-z-close] (Cancelar, con autofocus) y otro
//                  [data-z-confirm]: z:confirm en la capa, que se cierra salvo preventDefault().
import { registerIcons } from "@zuccadev-labs/zuix-zicon/dom";
import { arrowLeft } from "@zuccadev-labs/zuix-zicon/icons/arrow-left";
import { arrowUp } from "@zuccadev-labs/zuix-zicon/icons/arrow-up";
import { chevronDown } from "@zuccadev-labs/zuix-zicon/icons/chevron-down";
import { exclamationTriangle } from "@zuccadev-labs/zuix-zicon/icons/exclamation-triangle";
import { listBullet } from "@zuccadev-labs/zuix-zicon/icons/list-bullet";
import { magnifyingGlass } from "@zuccadev-labs/zuix-zicon/icons/magnifying-glass";
import { questionMarkCircle } from "@zuccadev-labs/zuix-zicon/icons/question-mark-circle";
import { squares2x2 } from "@zuccadev-labs/zuix-zicon/icons/squares-2x2";
import { xMark } from "@zuccadev-labs/zuix-zicon/icons/x-mark";
import type { DomModule } from "../shared";
import { pagePart, pageWidgets } from "../page";

export { setSearchViewOpen } from "../page";
export { destroyWidget, setWidgetProps } from "../widgets";
export { createProgress, topProgress, type ProgressController, type ProgressSnapshot } from "../../core/top-progress";
export { goToSection } from "../../core/toc-widget";
export { fitCount } from "../../core/overflow-list";

registerIcons([arrowLeft, arrowUp, chevronDown, exclamationTriangle, listBullet, magnifyingGlass, questionMarkCircle, squares2x2, xMark]);

export const pageModule: DomModule = { name: "page", parts: [pageWidgets, pagePart] };
