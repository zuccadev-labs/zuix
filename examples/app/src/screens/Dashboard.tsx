import { useState } from "react";
import { DashboardLayout, Page } from "@zuccadev-labs/zuix-zout";
import {
  ActivityFeed,
  AreaChart,
  BarList,
  Button,
  DashboardGrid,
  DashboardGridItem,
  FunnelChart,
  Gauge,
  IconButton,
  Leaderboard,
  MetricCard,
  MetricGroup,
  ProgressGoal,
  SegmentedControl,
  serializeLayout,
  SplitButton,
  Tracker,
  type GridLayout,
  type TrackerDay,
} from "@zuccadev-labs/zuix-zui";

const STORE = "zuix-example-dashboard";

const DEFAULT_LAYOUT: GridLayout = [
  { id: "revenue", x: 0, y: 0, w: 8, h: 4, minW: 4, minH: 4 },
  { id: "cpu", x: 8, y: 0, w: 4, h: 4, minW: 3, minH: 3 },
  { id: "sources", x: 0, y: 4, w: 4, h: 4, minW: 3 },
  { id: "funnel", x: 4, y: 4, w: 4, h: 4, minW: 3 },
  { id: "goal", x: 8, y: 4, w: 4, h: 2, minW: 3, minH: 2 },
  { id: "uptime", x: 8, y: 6, w: 4, h: 2, minW: 3, minH: 2 },
  { id: "activity", x: 0, y: 8, w: 7, h: 5, minW: 4 },
  { id: "sellers", x: 7, y: 8, w: 5, h: 5, minW: 4 },
];

function savedLayout(): GridLayout {
  try {
    const raw = localStorage.getItem(STORE);
    const parsed = raw ? (JSON.parse(raw) as GridLayout) : null;
    if (Array.isArray(parsed) && parsed.length === DEFAULT_LAYOUT.length) return parsed;
  } catch {
    // Sin almacenamiento (ventana privada): la disposición por defecto.
  }
  return DEFAULT_LAYOUT;
}

const REVENUE = [
  { day: "2026-11-01", revenue: 3820, previous: 3410 },
  { day: "2026-11-04", revenue: 4210, previous: 3600 },
  { day: "2026-11-07", revenue: 3980, previous: 3720 },
  { day: "2026-11-10", revenue: 4630, previous: 3880 },
  { day: "2026-11-13", revenue: 5120, previous: 4010 },
  { day: "2026-11-16", revenue: 4870, previous: 4170 },
  { day: "2026-11-19", revenue: 5560, previous: 4300 },
  { day: "2026-11-22", revenue: 6010, previous: 4420 },
];

const UPTIME: TrackerDay[] = Array.from({ length: 45 }, (_, i) => {
  const day = new Date(Date.UTC(2026, 9, 9 + i));
  const label = day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  if (i === 17) return { status: "error", label, note: "Outage, 41 min" };
  if (i === 29 || i === 30) return { status: "warning", label, note: "Degraded, 12 min" };
  if (i === 8) return { status: "maintenance", label, note: "Planned maintenance" };
  return { status: "ok", label };
});

const NOW = "2026-11-22T15:00:00Z";

export function DashboardScreen() {
  const [layout, setLayout] = useState<GridLayout>(savedLayout);
  const [editing, setEditing] = useState(false);
  const [period, setPeriod] = useState("30d");
  const [saved, setSaved] = useState("");
  const onLayoutChange = (next: GridLayout) => {
    setLayout(next);
    setSaved(serializeLayout(next));
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      // Sin almacenamiento: la disposición vive solo en esta sesión.
    }
  };
  return (
    <Page label="Dashboard" width="full">
      <DashboardLayout
        eyebrow="Acme Inc."
        title="Overview"
        description="Sales and product health for November."
        actions={
          <>
            <Button
              icon={editing ? "check" : "squares-2x2"}
              variant={editing ? "primary" : "secondary"}
              aria-pressed={editing}
              onClick={() => setEditing(!editing)}
              data-testid="dash-edit"
            >
              {editing ? "Done" : "Edit layout"}
            </Button>
            <SplitButton
              variant="secondary"
              icon="arrow-down-tray"
              items={[
                { id: "csv", label: "Export as CSV", icon: "table-cells" },
                { id: "pdf", label: "Export as PDF", icon: "document-text" },
              ]}
            >
              Export
            </SplitButton>
          </>
        }
        filters={
          <>
            <SegmentedControl
              label="Period"
              size="sm"
              value={period}
              onValueChange={setPeriod}
              items={[
                { value: "7d", label: "7 days" },
                { value: "30d", label: "30 days" },
                { value: "90d", label: "Quarter" },
              ]}
            />
            <span className="app-muted" data-testid="dash-saved">
              {saved ? `Layout saved: ${saved}` : "Layout from this browser"}
            </span>
            <Button size="sm" variant="ghost" icon="arrow-path" onClick={() => onLayoutChange(DEFAULT_LAYOUT)} data-testid="dash-reset">
              Reset layout
            </Button>
          </>
        }
      >
        <MetricGroup label="Key figures" columns={4} data-testid="dash-kpis">
          <MetricCard
            variant="plain"
            label="Revenue"
            icon="banknotes"
            value={128400}
            format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
            previous={114200}
            period="last month"
            trend={[42, 44, 41, 48, 52, 50, 57, 61, 59, 66, 70, 74]}
            locale="en-US"
          />
          <MetricCard
            variant="plain"
            label="New customers"
            icon="user-plus"
            value={1284}
            previous={1210}
            period="last month"
            trend={[30, 34, 31, 36, 38, 41, 39, 44]}
            trendType="bar"
            color={2}
            locale="en-US"
          />
          <MetricCard
            variant="plain"
            label="Churn"
            icon="arrow-trending-down-right"
            value={0.021}
            format={{ style: "percent", maximumFractionDigits: 1 }}
            delta={-0.08}
            positive="down"
            period="last month"
            trend={[2.8, 2.6, 2.7, 2.4, 2.3, 2.2, 2.1]}
            trendType="line"
            color={3}
            locale="en-US"
          />
          <MetricCard
            variant="plain"
            label="Q4 target"
            icon="trophy"
            value={96000}
            format={{ style: "currency", currency: "USD", notation: "compact" }}
            target={150000}
            elapsed={0.72}
            locale="en-US"
          />
        </MetricGroup>
        <div data-testid="dash-grid">
          <DashboardGrid label="Widgets" editable={editing} layout={layout} onLayoutChange={onLayoutChange}>
            <DashboardGridItem
              id="revenue"
              title="Revenue"
              description="Daily, against the previous period"
              actions={<IconButton icon="ellipsis-horizontal" label="Revenue options" variant="ghost" size="sm" />}
            >
              <AreaChart
                summary="Revenue by day this period against the previous one: up from $3.8k to $6.0k."
                framed={false}
                height={180}
                data={REVENUE}
                xKey="day"
                series={[
                  { key: "revenue", label: "This period" },
                  { key: "previous", label: "Previous period" },
                ]}
                valueFormat={{ style: "currency", currency: "USD", notation: "compact" }}
                locale="en-US"
              />
            </DashboardGridItem>
            <DashboardGridItem id="cpu" title="Cluster load" description="Last 5 minutes">
              <div className="app-center">
                <Gauge
                  label="CPU"
                  value={72}
                  valueFormat={{ style: "unit", unit: "percent" }}
                  hint="12 of 16 cores"
                  zones={[
                    { to: 60, tone: "success", label: "Healthy" },
                    { to: 85, tone: "warning", label: "Warning" },
                    { to: 100, tone: "danger", label: "Critical" },
                  ]}
                  size="lg"
                  locale="en-US"
                />
              </div>
            </DashboardGridItem>
            <DashboardGridItem id="sources" title="Top sources">
              <BarList
                label="Top sources"
                sort="desc"
                locale="en-US"
                items={[
                  { label: "Google", value: 4021, icon: "globe-alt" },
                  { label: "Direct", value: 2390, icon: "link" },
                  { label: "GitHub", value: 1310, icon: "code-bracket" },
                  { label: "Newsletter", value: 864, icon: "envelope" },
                  { label: "Partners", value: 512, icon: "users" },
                ]}
              />
            </DashboardGridItem>
            <DashboardGridItem id="funnel" title="Checkout">
              <FunnelChart
                title="Checkout funnel"
                locale="en-US"
                color={2}
                stages={[
                  { label: "Visited", value: 12400 },
                  { label: "Added to cart", value: 4210 },
                  { label: "Checkout", value: 2380 },
                  { label: "Paid", value: 1612 },
                ]}
              />
            </DashboardGridItem>
            <DashboardGridItem id="goal" title="Monthly goal">
              <ProgressGoal label="Signups" value={1284} target={1600} elapsed={0.73} locale="en-US" />
            </DashboardGridItem>
            <DashboardGridItem id="uptime" title="API status">
              <div data-testid="dash-tracker">
                <Tracker label="API" days={UPTIME} locale="en-US" />
              </div>
            </DashboardGridItem>
            <DashboardGridItem id="activity" title="Activity">
              <ActivityFeed
                label="Recent activity"
                now={NOW}
                timeZone="UTC"
                locale="en-US"
                hasMore
                onLoadMore={() => {}}
                items={[
                  {
                    id: "a1",
                    actor: { name: "Ana López" },
                    verb: "closed",
                    object: "#42 Login timeout",
                    href: "#",
                    at: "2026-11-22T13:10:00Z",
                  },
                  {
                    id: "a2",
                    actor: { name: "Deploy bot" },
                    icon: "rocket-launch",
                    tone: "success",
                    verb: "shipped",
                    object: "v2.8.0 to production",
                    at: "2026-11-22T09:30:00Z",
                  },
                  {
                    id: "a3",
                    actor: { name: "Marco Rossi" },
                    verb: "commented on",
                    object: "Pricing page",
                    href: "#",
                    at: "2026-11-21T17:45:00Z",
                    detail: "The annual toggle should default to monthly for new visitors.",
                  },
                  { id: "a4", actor: { name: "Yuki Tanaka" }, verb: "invited", object: "Lea Martin", at: "2026-11-21T10:05:00Z" },
                ]}
              />
            </DashboardGridItem>
            <DashboardGridItem id="sellers" title="Top sellers" description="This month">
              <Leaderboard
                label="Top sellers"
                highlight="u3"
                valueFormat={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
                locale="en-US"
                entries={[
                  { id: "u1", name: "Ana López", secondary: "Enterprise", value: 48200, previous: 41000 },
                  { id: "u2", name: "Marco Rossi", secondary: "SMB", value: 41900, previous: 44100 },
                  { id: "u3", name: "Yuki Tanaka", secondary: "Mid-market", value: 36700, previous: 30200 },
                  { id: "u4", name: "Lea Martin", secondary: "SMB", value: 29100, previous: 29000 },
                  { id: "u5", name: "Omar Haddad", secondary: "Enterprise", value: 24800, previous: 26300 },
                ]}
              />
            </DashboardGridItem>
          </DashboardGrid>
        </div>
      </DashboardLayout>
    </Page>
  );
}
