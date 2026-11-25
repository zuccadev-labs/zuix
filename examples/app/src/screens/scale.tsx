// Escala y rejilla (0.5): DataTable editable, agrupada, en árbol, con detalle y con 10 000 filas; listas largas y del
// servidor (Select, Combobox, Listbox, TransferList); árbol que se arrastra y carga ramas; pestañas con menú «Más»;
// Command, ConversationList y MemberList con miles de entradas. Datos deterministas para las pruebas.
import { useMemo, useState } from "react";
import { Grid, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Card,
  CardHeader,
  Combobox,
  Command,
  ConversationList,
  DataTable,
  Listbox,
  MemberList,
  Select,
  Tabs,
  TransferList,
  Tree,
  type AsyncLoader,
  type ConversationItem,
  type DataTableColumn,
  type Member,
  type RowKey,
  type TreeDrop,
  type TreeNode,
} from "@zuccadev-labs/zuix-zui";

/* ---------- Datos ---------- */

interface Person {
  id: string;
  name: string;
  role: string;
  seats: number;
  joined: Date;
  manager?: string;
  reports?: Person[];
}

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

const PEOPLE: Person[] = [
  { id: "ana", name: "Ana Torres", role: "admin", seats: 4, joined: new Date("2025-03-02T12:00:00Z") },
  { id: "ben", name: "Ben Okafor", role: "editor", seats: 12, joined: new Date("2026-01-15T12:00:00Z") },
  { id: "chen", name: "Chen Wei", role: "editor", seats: 7, joined: new Date("2024-11-20T12:00:00Z") },
  { id: "dara", name: "Dara Singh", role: "viewer", seats: 1, joined: new Date("2026-06-01T12:00:00Z") },
  { id: "eli", name: "Eli Moreau", role: "viewer", seats: 3, joined: new Date("2025-09-09T12:00:00Z") },
];

const ORG: Person[] = [
  {
    id: "ceo",
    name: "Iris Vega",
    role: "admin",
    seats: 2,
    joined: new Date("2023-01-10T12:00:00Z"),
    reports: [
      {
        id: "cto",
        name: "Omar Haddad",
        role: "admin",
        seats: 5,
        joined: new Date("2023-04-02T12:00:00Z"),
        reports: [
          { id: "dev1", name: "Lia Kim", role: "editor", seats: 1, joined: new Date("2024-02-12T12:00:00Z") },
          { id: "dev2", name: "Tom Berg", role: "editor", seats: 1, joined: new Date("2024-07-30T12:00:00Z") },
        ],
      },
      { id: "cfo", name: "Rosa Pinto", role: "viewer", seats: 3, joined: new Date("2023-05-21T12:00:00Z") },
    ],
  },
];

interface Item {
  id: number;
  name: string;
  team: string;
  value: number;
  updated: Date;
}

const TEAMS = ["North", "South", "East", "West", "Central"];
function bigRows(n: number): Item[] {
  let seed = 7;
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    name: `Item ${String(i + 1).padStart(5, "0")}`,
    team: TEAMS[i % TEAMS.length]!,
    value: Math.round(next() * 10000) / 10,
    updated: new Date(Date.UTC(2026, 0, 1) + Math.floor(next() * 300) * 86400000),
  }));
}

const BIG_COLUMNS: DataTableColumn<Item>[] = [
  { key: "name", header: "Name", accessor: (r) => r.name, sortable: true, filterable: true, pinned: "start", width: "160px" },
  { key: "team", header: "Team", accessor: (r) => r.team, sortable: true, filterable: true },
  { key: "value", header: "Value", accessor: (r) => r.value, sortable: true, align: "end", mono: true, aggregate: "sum" },
  { key: "updated", header: "Updated", accessor: (r) => r.updated, sortable: true },
];

const show = (keys: ReadonlyArray<RowKey>) => (keys.length ? keys.join(",") : "none");

/* ---------- DataTable como rejilla ---------- */

export function DataGridSections() {
  const [people, setPeople] = useState(PEOPLE);
  const [lastEdit, setLastEdit] = useState("none");
  const [order, setOrder] = useState<string[]>([]);
  const [picked, setPicked] = useState<RowKey[]>([]);
  const [rowEdit, setRowEdit] = useState("none");
  const [big, setBig] = useState<Item[] | null>(null);
  const [bigSelected, setBigSelected] = useState<RowKey[]>([]);

  const columns: DataTableColumn<Person>[] = [
    {
      key: "name",
      header: "Name",
      accessor: (p) => p.name,
      pinned: "start",
      width: "170px",
      editable: true,
      required: true,
      sortable: true,
    },
    {
      key: "role",
      header: "Role",
      accessor: (p) => p.role,
      render: (p) => ROLES.find((r) => r.value === p.role)?.label ?? p.role,
      editable: true,
      editor: "select",
      options: ROLES,
    },
    {
      key: "seats",
      header: "Seats",
      accessor: (p) => p.seats,
      align: "end",
      mono: true,
      editable: true,
      editor: "number",
      min: 1,
      max: 50,
      validate: (v) => (Number(v) === 13 ? "13 seats are not sold" : null),
    },
    { key: "joined", header: "Joined", accessor: (p) => p.joined, pinned: "end", sortable: true },
  ];

  return (
    <>
      <PageSection title="Editable grid" description="Cells edit in place: F2, Enter or a letter; Enter or Tab confirm, Escape cancels.">
        <Stack gap={2}>
          <div data-testid="g-edit">
            <DataTable
              caption="Editable team"
              captionHidden
              locale="es-ES"
              rows={people}
              rowKey={(p) => p.id}
              selectable
              selectedKeys={picked}
              onSelectionChange={setPicked}
              reorderable
              onColumnOrderChange={setOrder}
              onCellEdit={({ rowKey, key, value }) => {
                if (key === "name" && value.trim().toLowerCase() === "taken") return "That name is taken";
                setPeople((list) => list.map((p) => (p.id === rowKey ? { ...p, [key]: key === "seats" ? Number(value) : value } : p)));
                setLastEdit(`${String(rowKey)}.${key}=${value}`);
              }}
              columns={columns}
            />
          </div>
          <p className="app-muted">
            Edit: <output data-testid="g-edit-last">{lastEdit}</output> · Order:{" "}
            <output data-testid="g-edit-order">{order.join(",") || "default"}</output> · Selected:{" "}
            <output data-testid="g-edit-selected">{show(picked)}</output>
          </p>
        </Stack>
      </PageSection>

      <Grid min={420}>
        <PageSection title="Row editing">
          <Stack gap={2}>
            <div data-testid="g-row">
              <DataTable
                caption="Row editing"
                captionHidden
                rows={people.slice(0, 3)}
                rowKey={(p) => p.id}
                editMode="row"
                onRowEdit={({ rowKey, values }) => setRowEdit(`${String(rowKey)}:${values.name}/${values.seats}`)}
                columns={columns.filter((c) => c.key === "name" || c.key === "seats")}
              />
            </div>
            <p className="app-muted">
              Row edit: <output data-testid="g-row-last">{rowEdit}</output>
            </p>
          </Stack>
        </PageSection>
        <PageSection title="Grouped with totals">
          <div data-testid="g-group">
            <DataTable
              caption="Seats by role"
              captionHidden
              locale="en-US"
              rows={people}
              rowKey={(p) => p.id}
              groupBy="role"
              groupLabel={(_c, value, count) => `${ROLES.find((r) => r.value === value)?.label ?? String(value)} · ${count}`}
              columns={[
                { key: "role", header: "Role", accessor: (p) => p.role, render: () => "" },
                { key: "name", header: "Name", accessor: (p) => p.name, aggregate: "count", formatAggregate: (n) => `${n} people` },
                { key: "seats", header: "Seats", accessor: (p) => p.seats, align: "end", mono: true, aggregate: "sum" },
              ]}
            />
          </div>
        </PageSection>
      </Grid>

      <PageSection title="Tree data and details">
        <div data-testid="g-tree">
          <DataTable
            caption="Organisation"
            captionHidden
            locale="en-GB"
            rows={ORG}
            rowKey={(p) => p.id}
            getRowChildren={(p) => p.reports}
            defaultExpandedRows={["ceo"]}
            renderDetail={(p) => `${p.name} joined on ${p.joined.toISOString().slice(0, 10)} with ${p.seats} seats.`}
            detailLabel={(p) => `Details of ${p.name}`}
            columns={[
              { key: "name", header: "Name", accessor: (p) => p.name },
              { key: "role", header: "Role", accessor: (p) => p.role },
              { key: "joined", header: "Joined", accessor: (p) => p.joined },
            ]}
          />
        </div>
      </PageSection>

      <PageSection
        title="10 000 rows"
        description="Only the rows in view are in the document; sorting, filters and selection work on all of them."
      >
        <Stack gap={2}>
          <div>
            <button
              type="button"
              className="z-btn z-btn--secondary"
              data-size="sm"
              data-testid="g-big-mount"
              onClick={() => setBig(bigRows(10000))}
            >
              Load 10 000 rows
            </button>{" "}
            <button
              type="button"
              className="z-btn z-btn--ghost"
              data-size="sm"
              data-testid="g-big-mount-1k"
              onClick={() => setBig(bigRows(1000))}
            >
              Load 1 000 rows
            </button>
          </div>
          {big ? (
            <div data-testid="g-big">
              <DataTable
                caption="Inventory"
                captionHidden
                grid
                locale="en-US"
                rows={big}
                rowKey={(r) => r.id}
                selectable
                selectedKeys={bigSelected}
                onSelectionChange={setBigSelected}
                columns={BIG_COLUMNS}
              />
            </div>
          ) : null}
          <p className="app-muted">
            Selected: <output data-testid="g-big-selected">{bigSelected.length}</output>
          </p>
        </Stack>
      </PageSection>
    </>
  );
}

/* ---------- Listas largas y del servidor ---------- */

const COUNTRIES = Array.from({ length: 1200 }, (_, i) => ({ value: `c${i}`, label: `Country ${String(i + 1).padStart(4, "0")}` }));
const GROUPED = [
  { label: "Europe", options: COUNTRIES.slice(0, 400) },
  { label: "Americas", options: COUNTRIES.slice(400, 800) },
  { label: "Asia", options: COUNTRIES.slice(800) },
];
const CITIES = Array.from({ length: 240 }, (_, i) => `City ${String(i + 1).padStart(3, "0")}`);

/** Servidor de mentira: 20 por página, 300 ms de espera, cancelable; «error» falla una vez. */
function fakeServer(): { load: AsyncLoader<{ value: string; label: string }>; calls: () => number } {
  let calls = 0;
  let failed = false;
  return {
    calls: () => calls,
    load: (query, { signal, page }) =>
      new Promise((resolve, reject) => {
        calls += 1;
        const timer = setTimeout(() => {
          if (query === "error" && !failed) {
            failed = true;
            reject(new Error("Server unavailable"));
            return;
          }
          const hits = CITIES.filter((c) => c.toLowerCase().includes(query.toLowerCase()));
          const slice = hits.slice((page - 1) * 20, page * 20).map((c) => ({ value: c.toLowerCase().replace(/\s+/g, "-"), label: c }));
          resolve({ options: slice, hasMore: page * 20 < hits.length });
        }, 300);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("aborted", "AbortError"));
        });
      }),
  };
}

const TRANSFER = Array.from({ length: 1000 }, (_, i) => ({ value: `p${i}`, label: `Person ${String(i + 1).padStart(4, "0")}` }));

export function LargeListsSection() {
  const [country, setCountry] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [remote, setRemote] = useState("");
  const [many, setMany] = useState("");
  const [team, setTeam] = useState<string[]>([]);
  const server = useMemo(() => fakeServer(), []);
  const server2 = useMemo(() => fakeServer(), []);
  return (
    <PageSection
      title="Large and remote lists"
      description="Long lists render only what is in view; remote lists debounce, cancel and page."
    >
      <Grid min={300}>
        <Card className="app-demo" data-testid="l-select">
          <CardHeader title="Select with search" subtitle="1 200 options in three groups" />
          <Select
            searchable
            aria-label="Country"
            placeholder="Choose a country"
            options={GROUPED}
            value={country}
            onValueChange={setCountry}
          />
          <output className="app-muted" data-testid="l-select-value">
            {country || "none"}
          </output>
        </Card>
        <Card className="app-demo" data-testid="l-combo">
          <CardHeader title="Remote combobox" subtitle="Debounce, cancel, pages of 20" />
          <Combobox
            aria-label="City"
            placeholder="Search a city"
            loadOptions={server.load}
            value={city}
            onValueChange={(v) => setCity(v)}
          />
          <output className="app-muted" data-testid="l-combo-value">
            {city ?? "none"}
          </output>
        </Card>
        <Card className="app-demo" data-testid="l-remote-select">
          <CardHeader title="Remote select" subtitle="Search in the server" />
          <Select aria-label="Office" placeholder="Choose an office" loadOptions={server2.load} value={remote} onValueChange={setRemote} />
          <output className="app-muted" data-testid="l-remote-value">
            {remote || "none"}
          </output>
        </Card>
        <Card className="app-demo" data-testid="l-listbox">
          <CardHeader title="Long listbox" subtitle="1 200 options" />
          <div className="app-listbox-tall">
            <Listbox label="Countries" options={COUNTRIES} value={many} onValueChange={setMany} />
          </div>
          <output className="app-muted" data-testid="l-listbox-value">
            {many || "none"}
          </output>
        </Card>
      </Grid>
      <div data-testid="l-transfer">
        <TransferList searchable labels={{ source: "People", target: "Team" }} items={TRANSFER} value={team} onValueChange={setTeam} />
      </div>
      <output className="app-muted" data-testid="l-transfer-value">
        {team.length}
      </output>
    </PageSection>
  );
}

/* ---------- Árbol y pestañas ---------- */

const DRAG_TREE: TreeNode[] = [
  {
    id: "docs",
    label: "docs",
    icon: "folder",
    children: [
      { id: "intro", label: "intro.md", icon: "document-text" },
      { id: "guide", label: "guide.md", icon: "document-text" },
    ],
  },
  { id: "archive", label: "archive", icon: "folder", hasChildren: true },
  { id: "notes", label: "notes.md", icon: "document-text" },
  { id: "todo", label: "todo.md", icon: "document-text" },
];

function bigTree(): TreeNode[] {
  return Array.from({ length: 60 }, (_, i) => ({
    id: `f${i}`,
    label: `Folder ${String(i + 1).padStart(2, "0")}`,
    icon: "folder" as const,
    children: Array.from({ length: 40 }, (_, j) => ({ id: `f${i}-${j}`, label: `File ${i + 1}.${j + 1}`, icon: "document-text" as const })),
  }));
}

const TAB_ITEMS = [
  "Overview",
  "Activity",
  "Members",
  "Billing",
  "Security",
  "Integrations",
  "Webhooks",
  "Audit log",
  "Advanced",
  "Danger zone",
].map((label) => ({ value: label.toLowerCase().replace(/\s+/g, "-"), label, content: `${label} panel` }));

export function TreeAndTabsSections() {
  const [nodes, setNodes] = useState(DRAG_TREE);
  const [moves, setMoves] = useState("none");
  const [big] = useState(bigTree);
  const [tab, setTab] = useState("overview");
  return (
    <>
      <Grid min={320}>
        <PageSection title="Tree: move and load">
          <Card padding="sm" data-testid="t-drag">
            <Tree
              label="Project files"
              nodes={nodes}
              draggable
              defaultExpanded={["docs"]}
              onMove={(drop: TreeDrop, next) => {
                setNodes(next);
                setMoves(`${drop.id} ${drop.position} ${drop.target}`);
              }}
              // Solo las carpetas admiten hijos.
              canDrop={(drop) => drop.position !== "inside" || drop.target === "docs" || drop.target === "archive"}
              loadChildren={(node) =>
                new Promise((resolve) =>
                  setTimeout(
                    () =>
                      resolve([
                        { id: `${node.id}-2024`, label: "2024.md", icon: "document-text" },
                        { id: `${node.id}-2025`, label: "2025.md", icon: "document-text" },
                      ]),
                    250,
                  ),
                )
              }
            />
          </Card>
          <span className="app-muted">
            Last move: <output data-testid="t-drag-last">{moves}</output>
          </span>
        </PageSection>
        <PageSection title="Tree: 2 400 rows">
          <Card padding="sm" data-testid="t-big">
            <Tree label="Big tree" nodes={big} defaultExpanded={big.map((n) => n.id)} checkable />
          </Card>
        </PageSection>
      </Grid>
      <PageSection title="Tabs that do not fit">
        <Stack gap={3}>
          <div data-testid="t-tabs-menu" className="app-tabs-narrow">
            <Tabs items={TAB_ITEMS} value={tab} onValueChange={setTab} overflow="menu" label="Settings sections" variant="underline" />
          </div>
          <div data-testid="t-tabs-scroll" className="app-tabs-narrow">
            <Tabs items={TAB_ITEMS} defaultValue="overview" label="Settings sections (scroll)" variant="underline" />
          </div>
          <span className="app-muted">
            Tab: <output data-testid="t-tabs-value">{tab}</output>
          </span>
        </Stack>
      </PageSection>
    </>
  );
}

/* ---------- Comandos, conversaciones y miembros por miles ---------- */

const MANY_COMMANDS = [
  {
    heading: "Files",
    commands: Array.from({ length: 1000 }, (_, i) => ({
      id: `file-${i}`,
      label: `Open file ${String(i + 1).padStart(4, "0")}`,
      onSelect: () => {},
    })),
  },
  {
    heading: "Symbols",
    commands: Array.from({ length: 1000 }, (_, i) => ({
      id: `sym-${i}`,
      label: `Go to symbol ${String(i + 1).padStart(4, "0")}`,
      onSelect: () => {},
    })),
  },
];

export function BigCommandSection({ onRun }: { onRun: (id: string) => void }) {
  const groups = useMemo(
    () => MANY_COMMANDS.map((g) => ({ ...g, commands: g.commands.map((c) => ({ ...c, onSelect: () => onRun(c.id) })) })),
    [onRun],
  );
  return (
    <PageSection title="Command with 2 000 entries">
      <Card className="app-demo">
        <div data-testid="c-big-command">
          <Command id="c-big" label="Go to anything" groups={groups} />
        </div>
      </Card>
    </PageSection>
  );
}

const NOW = Date.parse("2026-11-19T10:00:00Z");
const CHATS: ConversationItem[] = Array.from({ length: 1000 }, (_, i) => ({
  id: `chat-${i}`,
  title: `Chat ${String(i + 1).padStart(4, "0")}`,
  lastMessage: `Message number ${i + 1}`,
  lastAt: NOW - i * 3600000,
  unread: i % 7 === 0 ? (i % 5) + 1 : 0,
}));
const MEMBERS: Member[] = Array.from({ length: 1000 }, (_, i) => ({
  id: `m${i}`,
  name: `Member ${String(i + 1).padStart(4, "0")}`,
  email: `member${i + 1}@example.com`,
  role: i % 10 === 0 ? "admin" : i % 3 === 0 ? "editor" : "viewer",
  presence: i % 4 === 0 ? "online" : "offline",
}));

export function ScaleListsStage() {
  const [chat, setChat] = useState("none");
  return (
    <div className="app-scale" data-testid="scale-lists">
      <div className="app-scale__chats" data-testid="s-chats">
        <ConversationList items={CHATS} now={NOW} timeZone="UTC" locale="en-GB" onSelect={({ id }) => setChat(id)} />
        <output data-testid="s-chat-value">{chat}</output>
      </div>
      <div data-testid="s-members">
        <MemberList
          title="1 000 members"
          members={MEMBERS}
          roles={[
            { id: "admin", label: "Admins" },
            { id: "editor", label: "Editors" },
            { id: "viewer", label: "Viewers" },
          ]}
          editable
        />
      </div>
    </div>
  );
}
