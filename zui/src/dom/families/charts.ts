// @zuccadev-labs/zuix-zui/dom/charts — AnimatedNumber, AreaChart, BarChart, BulletChart, CategoryBar, ComboChart,
// DonutChart, HeatmapChart, LineChart, PieChart, RadarChart, ScatterChart y Sparkline sin
// framework. Registro: init(chartsModule) o use(chartsModule) junto a @zuccadev-labs/zuix-zui/dom/core.
import type { DomModule } from "../shared";
import { chartWidgets } from "../widgets-charts";

export { destroyWidget, setWidgetProps } from "../widgets";

export const chartsModule: DomModule = { name: "charts", parts: [chartWidgets] };
