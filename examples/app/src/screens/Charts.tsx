import { useState } from "react";
import { AreaChart, BarChart, DonutChart, LineChart, PieChart, Sparkline, StatTile } from "@zuccadev-labs/zuix-zui";

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

export function ChartsScreen() {
  const [last, setLast] = useState("—");
  const [hidden, setHidden] = useState<string[]>([]);
  return (
    <div className="app-charts" data-testid="charts">
      <div className="app-charts__tiles">
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
      <p className="app-charts__spark">
        Weekly visits <Sparkline values={[120, 132, 101, 154, 190, 230, 210, 340]} label="Weekly visits" locale="en-US" /> Errors{" "}
        <Sparkline values={[9, 7, 8, 4, 5, 3, 2]} type="bar" color={5} label="Errors" locale="en-US" />
      </p>
      <output data-testid="chart-last">{last}</output>
    </div>
  );
}
