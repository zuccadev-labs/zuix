import { useState } from "react";
import { Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  Chip,
  CircularProgress,
  DataTable,
  DescriptionList,
  IconButton,
  Item,
  ItemGroup,
  Progress,
  StatusDot,
  Timeline,
  TimelineItem,
  type RowKey,
} from "@zuccadev-labs/zuix-zui";
import { DataGridSections } from "./scale";

interface Member {
  id: string;
  name: string;
  role: string;
  seats: number;
  active: boolean;
}

const MEMBERS: Member[] = [
  { id: "ana", name: "Ana Ruiz", role: "Owner", seats: 3, active: true },
  { id: "leo", name: "Leo Park", role: "Editor", seats: 12, active: true },
  { id: "mia", name: "Mia Chen", role: "Viewer", seats: 1, active: false },
  { id: "zoe", name: "Zoe Katz", role: "Editor", seats: 7, active: true },
  { id: "iker", name: "Iker Sanz", role: "Viewer", seats: 5, active: true },
  { id: "noa", name: "Noa Gil", role: "Billing", seats: 2, active: false },
  { id: "eva", name: "Eva Mora", role: "Editor", seats: 9, active: true },
];

const show = (keys: ReadonlyArray<RowKey>) => (keys.length ? keys.join(",") : "none");

/** Piezas de datos con su valor a la vista, para las pruebas en navegador. */
export function DataScreen() {
  const [selected, setSelected] = useState<RowKey[]>(["leo"]);
  const [page, setPage] = useState(1);
  const [upload, setUpload] = useState(64);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [resized, setResized] = useState("none");

  return (
    <Page width="full">
      <PageHeader title="Data" description="Selectable tables, timelines, progress, descriptions, items and status." />
      <PageSection title="DataTable">
        <Stack gap={3}>
          <div data-testid="d-table">
            <DataTable
              caption="Members"
              captionHidden
              rows={MEMBERS}
              rowKey={(member) => member.id}
              selectable
              selectedKeys={selected}
              onSelectionChange={setSelected}
              isRowSelectable={(member) => member.role !== "Owner"}
              selectRowLabel={(member) => `Select ${member.name}`}
              pageSize={4}
              page={page}
              onPageChange={setPage}
              defaultSort={{ key: "name", direction: "asc" }}
              columns={[
                { key: "name", header: "Name", accessor: (m) => m.name, sortable: true, footer: "Total" },
                { key: "role", header: "Role", accessor: (m) => m.role, sortable: true },
                {
                  key: "status",
                  header: "Status",
                  render: (m) => <StatusDot tone={m.active ? "success" : "neutral"} label={m.active ? "Active" : "Invited"} />,
                },
                {
                  key: "seats",
                  header: "Seats",
                  accessor: (m) => m.seats,
                  sortable: true,
                  align: "end",
                  mono: true,
                  footer: (all) => all.reduce((sum, m) => sum + m.seats, 0),
                },
              ]}
            />
          </div>
          <p className="app-muted">
            Selected: <output data-testid="d-table-selected">{show(selected)}</output> · Page:{" "}
            <output data-testid="d-table-page">{page}</output>
          </p>
        </Stack>
      </PageSection>
      <PageSection title="Data grid">
        <Stack gap={3}>
          <div data-testid="d-grid">
            <DataTable
              caption="Members grid"
              captionHidden
              rows={MEMBERS}
              rowKey={(member) => member.id}
              exportable
              exportFileName="members.csv"
              filters={filters}
              onFiltersChange={setFilters}
              onColumnResize={(key, width) => setResized(`${key} ${width}`)}
              columns={[
                {
                  key: "name",
                  header: "Name",
                  accessor: (m) => m.name,
                  sortable: true,
                  filterable: true,
                  resizable: true,
                  pinned: "start",
                  width: "180px",
                },
                { key: "role", header: "Role", accessor: (m) => m.role, sortable: true, filterable: true, resizable: true, width: "160px" },
                { key: "seats", header: "Seats", accessor: (m) => m.seats, sortable: true, align: "end", mono: true, width: "120px" },
                {
                  key: "active",
                  header: "Status",
                  text: (m) => (m.active ? "Active" : "Invited"),
                  render: (m) => (m.active ? "Active" : "Invited"),
                  filterable: true,
                },
              ]}
            />
          </div>
          <p className="app-muted">
            Filters: <output data-testid="d-grid-filters">{JSON.stringify(filters)}</output> · Resized:{" "}
            <output data-testid="d-grid-resized">{resized}</output>
          </p>
        </Stack>
      </PageSection>
      <DataGridSections />
      <PageSection title="Progress">
        <Grid min={280}>
          <Card className="app-demo">
            <CardHeader title="CircularProgress" subtitle="Native progress, conic ring" />
            <Stack gap={3}>
              <div className="app-row" data-testid="d-rings">
                <CircularProgress label="Upload" value={upload} showValue size="lg" />
                <CircularProgress label="Storage" value={92} tone="danger" showValue />
                <CircularProgress label="Files" value={3} max={5} size="xl" thickness={10} tone="success" valueText="3 of 5 files">
                  3/5
                </CircularProgress>
                <CircularProgress label="Loading" size="sm" />
              </div>
              <div className="app-row">
                <IconButton icon="minus" label="Less" size="sm" onClick={() => setUpload((v) => Math.max(0, v - 10))} />
                <IconButton icon="plus" label="More" size="sm" onClick={() => setUpload((v) => Math.min(100, v + 10))} />
              </div>
            </Stack>
          </Card>
          <Card className="app-demo">
            <CardHeader title="Progress" subtitle="Segmented and vertical" />
            <Stack gap={3}>
              <Progress label="Onboarding" value={3} max={5} segments={5} valueText="3 of 5 steps" tone="success" />
              <Progress label="Quota" value={upload} segments={10} showValue />
              <div className="app-row app-row--tall" data-testid="d-vertical">
                <Progress label="CPU" value={72} orientation="vertical" showValue />
                <Progress label="Memory" value={38} orientation="vertical" tone="info" showValue />
                <Progress label="Disk" value={4} max={5} segments={5} orientation="vertical" tone="warning" />
                <Progress label="Sync" orientation="vertical" />
              </div>
            </Stack>
          </Card>
        </Grid>
      </PageSection>
      <PageSection title="Timeline">
        <Stack gap={4}>
          <Card className="app-demo">
            <CardHeader title="Activity" subtitle="Icons, tones and status" />
            <Timeline animated>
              <TimelineItem
                index={0}
                icon="rocket-launch"
                tone="success"
                title="Deployed to production"
                time="2026-11-20T10:42"
                timeLabel="10:42"
                description="Build 4812 is live in all regions."
                status="done"
              />
              <TimelineItem
                index={1}
                icon="check"
                tone="info"
                title="Review approved"
                time="2026-11-20T09:15"
                timeLabel="09:15"
                status="done"
              />
              <TimelineItem index={2} icon="clock" tone="accent" title="Smoke tests" timeLabel="Running" status="current" />
              <TimelineItem index={3} title="Announce release" timeLabel="Next" status="upcoming" />
            </Timeline>
          </Card>
          <Card className="app-demo">
            <CardHeader title="Roadmap" subtitle="Alternate, rings and dashed line" />
            <div data-testid="d-timeline-alt">
              <Timeline align="alternate" dot="ring" line="dashed">
                <TimelineItem tone="accent" title="Kick-off" time="2026-01-12" timeLabel="Jan 12" description="Scope and team." />
                <TimelineItem tone="info" title="Beta" time="2026-04-02" timeLabel="Apr 2" description="First 200 customers." />
                <TimelineItem tone="success" title="General availability" time="2026-09-30" timeLabel="Sep 30" />
              </Timeline>
            </div>
          </Card>
        </Stack>
      </PageSection>
      <PageSection title="Details">
        <Grid min={300}>
          <Card className="app-demo">
            <CardHeader title="DescriptionList" subtitle="Horizontal, divided" />
            <DescriptionList
              divided
              items={[
                { term: "Status", description: <Badge tone="success">Active</Badge> },
                { term: "Region", description: "eu-west-1", info: "Primary" },
                { term: "Created", description: "Nov 2, 2026" },
                { term: "Owner", description: "ana@example.com" },
              ]}
            />
          </Card>
          <Card className="app-demo">
            <CardHeader title="Items" subtitle="Group, link and actions" />
            <ItemGroup header="Team" divided>
              <Item
                media={<Avatar name="Ana Ruiz" />}
                title="Ana Ruiz"
                description="Owner"
                meta={<StatusDot tone="success" label="Online" pulse />}
                actions={<IconButton icon="ellipsis-horizontal" label="More for Ana" variant="ghost" size="sm" />}
              />
              <Item media={<Avatar name="Leo Park" />} title="Leo Park" description="Editor" meta="2 h ago" />
              <Item icon="document-text" title="Quarterly report.pdf" description="2.4 MB · PDF" href="#report" />
            </ItemGroup>
          </Card>
          <Card className="app-demo">
            <CardHeader title="Status" subtitle="Dots and toned chips" />
            <Stack gap={3}>
              <div className="app-row">
                <StatusDot tone="success" label="Online" pulse />
                <StatusDot tone="warning" label="Degraded" />
                <StatusDot tone="danger" label="Unreachable" />
                <StatusDot tone="info" label="Deploying" />
                <StatusDot label="Offline" />
              </div>
              <div className="app-row">
                <Chip tone="success" dot>
                  Running
                </Chip>
                <Chip tone="warning" dot>
                  Paused
                </Chip>
                <Chip tone="danger" dot count={3}>
                  Errors
                </Chip>
                <Chip tone="info" icon="cloud">
                  Remote
                </Chip>
              </div>
            </Stack>
          </Card>
        </Grid>
      </PageSection>
    </Page>
  );
}
