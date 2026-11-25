import { useState } from "react";
import {
  AnimatedNumber,
  AreaChart,
  BarChart,
  BulletChart,
  Button,
  CategoryBar,
  ComboChart,
  DonutChart,
  HeatmapChart,
  LineChart,
  MetricCard,
  PieChart,
  RadarChart,
  ScatterChart,
  Sparkline,
  StatTile,
} from "@zuccadev-labs/zuix-zui";

const MONTHS = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
  "2026-11",
  "2026-12",
];
const REVENUE = [42, 48, 45, 61, 66, 72, 69, 84, 90, 88, 97, 112];
const COSTS = [38, 40, 41, 44, 47, 50, 52, 55, 57, 58, 61, 66];
const SALES = MONTHS.map((month, i) => ({ month, revenue: REVENUE[i]! * 1000, costs: COSTS[i]! * 1000 }));
const TRAFFIC = MONTHS.slice(0, 8).map((month, i) => ({
  month,
  organic: [12, 14, 15, 18, 21, 22, 24, 27][i]! * 100,
  referral: [6, 7, 7, 8, 9, 11, 12, 12][i]! * 100,
  paid: [3, 4, 6, 6, 5, 7, 8, 9][i]! * 100,
}));
const TEAMS = [
  { team: "Design", shipped: 18, review: 6, blocked: 2 },
  { team: "Platform", shipped: 24, review: 9, blocked: 4 },
  { team: "Mobile", shipped: 12, review: 4, blocked: 5 },
  { team: "Growth", shipped: 15, review: 7, blocked: 1 },
];
const BALANCE = [
  { quarter: "Q1", net: 12 },
  { quarter: "Q2", net: -4 },
  { quarter: "Q3", net: 8 },
  { quarter: "Q4", net: 15 },
];
const STORAGE = [
  { label: "Media", value: 412 },
  { label: "Documents", value: 186 },
  { label: "Backups", value: 132 },
  { label: "Other", value: 58 },
];
const money: Intl.NumberFormatOptions = { style: "currency", currency: "USD", maximumFractionDigits: 0 };
const COMPANIES = [
  { name: "Acme", revenue: 12, margin: 18, staff: 120, segment: "SMB" },
  { name: "Birch", revenue: 21, margin: 24, staff: 210, segment: "SMB" },
  { name: "Cobalt", revenue: 33, margin: 20, staff: 260, segment: "SMB" },
  { name: "Delta", revenue: 46, margin: 27, staff: 410, segment: "Enterprise" },
  { name: "Ember", revenue: 59, margin: 31, staff: 520, segment: "Enterprise" },
  { name: "Fjord", revenue: 74, margin: 36, staff: 780, segment: "Enterprise" },
];
const MODELS = [
  { axis: "Speed", a: 82, b: 64 },
  { axis: "Range", a: 58, b: 88 },
  { axis: "Comfort", a: 71, b: 76 },
  { axis: "Safety", a: 90, b: 81 },
  { axis: "Price", a: 52, b: 72 },
  { axis: "Tech", a: 86, b: 60 },
];
const MARGIN = [0.18, 0.21, 0.19, 0.24, 0.26, 0.28, 0.27, 0.3, 0.31, 0.3, 0.32, 0.35];
const COMBO = SALES.map((row, i) => ({ month: row.month, revenue: row.revenue, margin: MARGIN[i]! }));
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const TICKETS = DAYS.flatMap((day, d) =>
  Array.from({ length: 12 }, (_, k) => {
    const h = k + 8;
    return {
      day,
      hour: String(h).padStart(2, "0"),
      value: Math.round(((h - 7) * (20 - h) * ((d % 3) + 2)) / 6 + (h === 12 || h === 13 ? 5 : 0)),
    };
  }),
);
const CHANGE = [
  [4, 7, -2, -6, 3, 9],
  [-8, -5, -3, 1, 4, 2],
  [12, 9, 6, 2, -1, -4],
  [-3, -9, -12, -7, -2, 5],
].flatMap((row, r) => row.map((value, m) => ({ region: ["North", "South", "East", "West"][r]!, month: MONTHS[m]!.slice(5), value })));
const SATISFACTION = [
  { label: "North", value: 82, target: 85 },
  { label: "South", value: 64, target: 75 },
  { label: "East", value: 91, target: 80 },
  { label: "West", value: 47, target: 70 },
];

export function ChartsScreen() {
  const [last, setLast] = useState("—");
  const [hidden, setHidden] = useState<string[]>([]);
  const [orders, setOrders] = useState(1284);
  return (
    <div className="app-charts" data-testid="charts">
      <div className="app-charts__tiles">
        <StatTile
          label="Orders"
          value={<AnimatedNumber value={orders} locale="en-US" live="polite" id="chart-orders" />}
          hint={
            <Button size="sm" variant="ghost" onClick={() => setOrders((n) => n + 216)} data-testid="chart-orders-more">
              Add orders
            </Button>
          }
        />
        <MetricCard label="Revenue (animated)" value={orders * 87} format={money} animate locale="en-US" id="chart-metric" />
        <StatTile label="Revenue" value="$112k" delta="+15%" deltaTone="success" trend={REVENUE} />
        <StatTile label="Costs" value="$66k" delta="+8%" deltaTone="warning" trend={COSTS} trendProps={{ color: 2, type: "line" }} />
        <StatTile
          label="Signups"
          value="1,284"
          variant="soft"
          trend={[8, 12, 9, 14, 18, 16, 22, 19, 25]}
          trendProps={{ type: "bar", color: 4 }}
        />
        <StatTile
          label="Uptime"
          value="99.98%"
          variant="solid"
          trend={[99.9, 99.95, 99.97, 99.92, 99.99, 99.98]}
          trendProps={{ type: "line" }}
        />
      </div>
      <LineChart
        title="Revenue and costs"
        description="Monthly, 2026"
        data={SALES}
        xKey="month"
        series={[
          { key: "revenue", label: "Revenue" },
          { key: "costs", label: "Costs" },
        ]}
        valueFormat={money}
        curve="monotone"
        markers
        onPointClick={({ index }) => setLast(`Line: ${MONTHS[index]}`)}
        id="chart-line"
        locale="en-US"
      />
      <AreaChart
        title="Traffic by source"
        data={TRAFFIC}
        xKey="month"
        series={[
          { key: "organic", label: "Organic" },
          { key: "referral", label: "Referral" },
          { key: "paid", label: "Paid" },
        ]}
        stacked
        hidden={hidden}
        onHiddenChange={({ hidden: next }) => setHidden(next)}
        id="chart-area"
        locale="en-US"
      />
      <div className="app-charts__row">
        <BarChart
          title="Tasks by team"
          data={TEAMS}
          xKey="team"
          series={[
            { key: "shipped", label: "Shipped" },
            { key: "review", label: "In review" },
            { key: "blocked", label: "Blocked" },
          ]}
          patterns
          id="chart-bar"
          locale="en-US"
        />
        <BarChart
          title="Workload by team"
          data={TEAMS}
          xKey="team"
          orientation="horizontal"
          stacked
          series={[
            { key: "shipped", label: "Shipped" },
            { key: "review", label: "In review" },
            { key: "blocked", label: "Blocked" },
          ]}
          id="chart-hbar"
          locale="en-US"
        />
      </div>
      <div className="app-charts__row">
        <DonutChart
          title="Storage"
          description="GB by type"
          data={STORAGE}
          valueFormat={{ style: "unit", unit: "gigabyte" }}
          id="chart-donut"
          locale="en-US"
        />
        <PieChart title="Storage share" data={STORAGE} patterns id="chart-pie" locale="en-US" />
        <BarChart
          title="Net balance"
          data={BALANCE}
          xKey="quarter"
          series={[{ key: "net", label: "Net" }]}
          valueFormat={money}
          id="chart-net"
          locale="en-US"
        />
      </div>
      <ScatterChart
        title="Revenue and margin"
        description="Bubble size: employees"
        data={COMPANIES}
        xKey="revenue"
        yKey="margin"
        sizeKey="staff"
        seriesKey="segment"
        labelKey="name"
        xLabel="Revenue"
        yLabel="Margin"
        sizeLabel="Employees"
        xValueFormat={money}
        valueFormat={{ style: "unit", unit: "percent" }}
        trend
        onPointClick={({ datum }) => setLast(`Scatter: ${String(datum?.name)}`)}
        id="chart-scatter"
        locale="en-US"
      />
      <div className="app-charts__row">
        <RadarChart
          title="Model comparison"
          data={MODELS}
          xKey="axis"
          series={[
            { key: "a", label: "Model A" },
            { key: "b", label: "Model B" },
          ]}
          yMax={100}
          yTicks={4}
          markers
          id="chart-radar"
          locale="en-US"
        />
        <ComboChart
          title="Revenue and margin"
          description="Monthly, 2026"
          data={COMBO}
          xKey="month"
          series={[
            { key: "revenue", label: "Revenue" },
            { key: "margin", label: "Margin", type: "line", axis: "end" },
          ]}
          valueFormat={money}
          y2Format={{ style: "percent" }}
          markers
          id="chart-combo"
          locale="en-US"
        />
      </div>
      <HeatmapChart
        title="Support tickets"
        description="By weekday and hour"
        data={TICKETS}
        xKey="hour"
        yKey="day"
        xLabel="Hour"
        yLabel="Day"
        series={[{ key: "value", label: "Tickets" }]}
        onPointClick={({ datum }) => setLast(`Heatmap: ${String(datum?.day)} ${String(datum?.hour)}`)}
        id="chart-heatmap"
        locale="en-US"
      />
      <div className="app-charts__row">
        <HeatmapChart
          title="Change vs last year"
          data={CHANGE}
          xKey="month"
          yKey="region"
          yLabel="Region"
          scale="diverging"
          showValues
          series={[{ key: "value", label: "Change" }]}
          valueFormat={{ style: "unit", unit: "percent", signDisplay: "exceptZero" }}
          id="chart-diverging"
          locale="en-US"
        />
        <BulletChart
          title="Customer satisfaction"
          description="Score out of 100"
          data={SATISFACTION}
          ranges={[50, 75, 100]}
          rangeLabels={["Poor", "Fair", "Good"]}
          xLabel="Region"
          id="chart-bullet"
          locale="en-US"
        />
        <BulletChart
          title="Satisfaction (vertical)"
          data={SATISFACTION}
          ranges={[50, 75, 100]}
          rangeLabels={["Poor", "Fair", "Good"]}
          orientation="vertical"
          id="chart-bullet-v"
          locale="en-US"
        />
      </div>
      <div className="app-charts__budget z-liquid">
        <CategoryBar
          label="Error budget"
          values={[40, 30, 20, 10]}
          categories={["Healthy", "Watch", "At risk", "Critical"]}
          colors={[4, 1, 2, 3]}
          marker={{ value: 62 }}
          showLabels
          legend
          id="chart-category"
          locale="en-US"
        />
      </div>
      <p className="app-charts__spark">
        Weekly visits <Sparkline values={[120, 132, 101, 154, 190, 230, 210, 340]} label="Weekly visits" locale="en-US" /> Errors{" "}
        <Sparkline values={[9, 7, 8, 4, 5, 3, 2]} type="bar" color={5} label="Errors" locale="en-US" />
      </p>
      <output data-testid="chart-last">{last}</output>
    </div>
  );
}
