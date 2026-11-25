// @zuccadev-labs/zuix-zui/dom/dashboard — Gauge, DeltaBadge, ProgressGoal, BarList, FunnelChart, Tracker, KanbanBoard
// y DashboardGrid sin framework. Registro: init(dashboardModule) o use(dashboardModule) junto a
// @zuccadev-labs/zuix-zui/dom/core. MetricCard, MetricGroup, ActivityFeed y Leaderboard son solo marcado.
import type { DomModule } from "../shared";
import { dashboardGridPart, dashboardWidgets } from "../widgets-dashboard";

export { getDashboardLayout, setDashboardLayout } from "../widgets-dashboard";
export { destroyWidget, setWidgetProps } from "../widgets";
export { moveCard, locateCard } from "../../core/kanban";
export {
  moveItem as moveGridItem,
  normalizeLayout,
  parseLayout,
  resizeItem as resizeGridItem,
  serializeLayout,
} from "../../core/grid-layout";

export const dashboardModule: DomModule = { name: "dashboard", parts: [dashboardWidgets, dashboardGridPart] };
