import { useState, type ReactNode } from "react";
import Layout from "@theme/Layout";
import zui from "@zuccadev-labs/zuix-zui/manifest.json";
import zout from "@zuccadev-labs/zuix-zout/manifest.json";
import zuiHtml from "@zuccadev-labs/zuix-zui/html.json";
import zoutHtml from "@zuccadev-labs/zuix-zout/html.json";
import {
  Accordion, Alert, Avatar, AvatarGroup, Badge, Breadcrumb, Button, Calendar, Callout, Card, CardFooter, CardHeader, Checkbox, Chip, CodeBlock, Combobox, DatePicker, NativeSelect,
  CommandPalette, ConfirmDialog, ContextMenu, DataTable, Drawer, EmptyState, Field, IconButton, Input, Kbd, Menu, Meter, Modal, NavLink, NavList,
  OTPInput, Pagination, Panel, Popover, Progress, Radio, RadioGroup, Rating, SearchInput, SegmentedControl, Select, Skeleton, Slider, Spinner,
  StatTile, Stepper, Switch, Tabs, Textarea, Toggle, Tooltip, Tree, useToast,
} from "@zuccadev-labs/zuix-zui";
import { Grid, Pane, SplitPane, TabStrip } from "@zuccadev-labs/zuix-zout";

interface Entry { name: string; group: string; description: string; examples: { title: string; code: string }[] }
const all: Entry[] = [...(zui.components as Entry[]), ...(zout.components as Entry[])];
const GROUPS = ["actions", "forms", "data", "feedback", "content", "overlay", "navigation", "carousel", "layout"];
const LABEL: Record<string, string> = { actions: "Acciones", forms: "Formularios", data: "Datos", feedback: "Estado", content: "Contenido", overlay: "Superposición", navigation: "Navegación", carousel: "Carousel", layout: "Layouts (zout)" };

const users = [
  { id: 1, name: "Ana Ruiz", role: "Owner", seats: 3 },
  { id: 2, name: "Leo Park", role: "Editor", seats: 1 },
  { id: 3, name: "Mia Chen", role: "Viewer", seats: 2 },
];

function Demos(): Record<string, ReactNode> {
  const { toast } = useToast();
  const [view, setView] = useState("list");
  const [on, setOn] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(2);
  const [palette, setPalette] = useState(false);
  const [tab, setTab] = useState("a");
  const [mine, setMine] = useState(true);
  return {
    Button: (<><Button variant="primary" icon="plus">New project</Button><Button>Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger" icon="trash">Delete</Button><Button loading>Saving</Button><Button size="sm">Small</Button><Button disabled>Disabled</Button></>),
    IconButton: (<><IconButton icon="gear" label="Settings" /><IconButton icon="bell" label="Notifications" /><IconButton icon="x-mark" label="Close" /></>),
    SegmentedControl: <SegmentedControl label="View" value={view} onValueChange={setView} items={[{ value: "list", label: "List", icon: "list-bullet" }, { value: "grid", label: "Grid", icon: "squares-2x2" }]} />,
    Toggle: <Toggle icon="star" label="Favourite" defaultPressed />,
    Input: <Field label="Project name" hint="Shown in the sidebar." required><Input placeholder="My project" /></Field>,
    Textarea: <Textarea placeholder="Describe the change" rows={3} aria-label="Description" />,
    Select: <Select aria-label="Region" placeholder="Choose a region" defaultValue="" options={[{ value: "eu", label: "Europe" }, { value: "us", label: "United States" }]} />,
    NativeSelect: <NativeSelect aria-label="Region" placeholder="Choose a region" defaultValue="" options={[{ value: "eu", label: "Europe" }, { value: "us", label: "United States" }]} />,
    Combobox: <Combobox aria-label="Country" placeholder="Search a country" clearable options={[{ value: "ar", label: "Argentina" }, { value: "br", label: "Brazil" }, { value: "cl", label: "Chile" }, { value: "mx", label: "Mexico" }, { value: "es", label: "Spain" }, { value: "uy", label: "Uruguay" }]} />,
    Calendar: <Calendar locale="en-US" defaultValue="2026-11-13" min="2026-11-05" max="2026-12-20" />,
    DatePicker: <DatePicker aria-label="Due date" locale="en-US" defaultValue="2026-11-13" />,
    Checkbox: <Checkbox defaultChecked description="We will email you once a week.">Send me the summary</Checkbox>,
    RadioGroup: (<RadioGroup aria-label="Plan" defaultValue="team"><Radio value="solo">Solo</Radio><Radio value="team" description="Up to 10 members.">Team</Radio><Radio value="org" disabled>Organization</Radio></RadioGroup>),
    Switch: <Switch checked={on} onCheckedChange={setOn}>Automatic updates</Switch>,
    Slider: <Slider aria-label="Volume" defaultValue={[60]} max={100} step={5} />,
    SearchInput: <SearchInput value={query} onValueChange={setQuery} placeholder="Search projects" />,
    OTPInput: <OTPInput length={6} />,
    Badge: (<><Badge tone="success" dot>Active</Badge><Badge tone="warning">Pending</Badge><Badge tone="danger">Failed</Badge><Badge tone="info">Info</Badge><Badge tone="accent" variant="solid" icon="star">Pro</Badge></>),
    Chip: <Chip selected={mine} onClick={() => setMine(!mine)} icon="user" count={12}>Assigned to me</Chip>,
    Avatar: (<><Avatar name="Ana Ruiz" status="online" statusLabel="Online" /><AvatarGroup max={3} aria-label="Members"><Avatar name="Ana Ruiz" /><Avatar name="Leo Park" /><Avatar name="Mia Chen" /><Avatar name="Sam Diaz" /></AvatarGroup></>),
    StatTile: (<Grid min={180} gap={3}><StatTile label="Requests" value="18,240" hint="last 24 h" delta="+12%" deltaTone="success" icon="chart-bar" /><StatTile label="Errors" value="0.4%" delta="-0.1%" deltaTone="success" icon="exclamation-triangle" /></Grid>),
    Meter: <Meter label="Disk usage" showLabel value={412} max={512} valueLabel="412 GB of 512 GB" warningAt={384} dangerAt={480} />,
    Progress: <Progress label="Upload progress" value={64} max={100} showValue />,
    Rating: <Rating value={4.3} showValue caption="(128 reviews)" />,
    Kbd: (<><Kbd>Ctrl</Kbd><Kbd>K</Kbd></>),
    DataTable: (<DataTable caption="Users" captionHidden rows={users} rowKey={(u) => u.id} defaultSort={{ key: "name", direction: "asc" }} columns={[{ key: "name", header: "Name", accessor: (u) => u.name, sortable: true }, { key: "role", header: "Role", accessor: (u) => u.role }, { key: "seats", header: "Seats", accessor: (u) => u.seats, sortable: true, align: "end", mono: true }]} />),
    Alert: (<><Alert tone="success" title="Changes saved">Your profile is up to date.</Alert><Alert tone="warning" title="Storage almost full">Free up space to keep syncing.</Alert></>),
    Spinner: <Spinner />,
    Skeleton: <Skeleton lines={3} />,
    EmptyState: <EmptyState icon="folder-plus" title="No projects yet" description="Create your first project to start organising work." action={<Button variant="primary" icon="plus">New project</Button>} />,
    Card: (<Card><CardHeader title="Billing" subtitle="Next invoice on 1 December" action={<Badge tone="success">Active</Badge>} /><p>Team plan, 8 seats.</p><CardFooter><Button variant="ghost">Cancel plan</Button><Button variant="primary">Manage</Button></CardFooter></Card>),
    Panel: <Panel title="Traffic" description="Last 7 days" actions={<Button size="sm" icon="arrow-down-tray">Export</Button>}><StatTile variant="soft" label="Visits" value="48,120" /></Panel>,
    Callout: <Callout tone="info" title="Tip">Press <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> to open the command palette.</Callout>,
    CodeBlock: <CodeBlock title="install.sh" language="bash" code={"pnpm add @zuccadev-labs/zuix\npnpm dev"} />,
    Modal: <Modal trigger={<Button>Edit profile</Button>} title="Edit profile" description="Changes are saved to your account." footer={<Button variant="primary">Save</Button>}><Field label="Name"><Input defaultValue="Ana Ruiz" /></Field></Modal>,
    ConfirmDialog: <ConfirmDialog trigger={<Button variant="danger">Delete project</Button>} intent="danger" title="Delete project?" description="This cannot be undone." confirmLabel="Delete" onConfirm={() => toast({ title: "Project deleted", intent: "danger" })} />,
    Drawer: <Drawer trigger={<Button icon="funnel">Filters</Button>} title="Filters" side="right"><Checkbox defaultChecked>Only mine</Checkbox></Drawer>,
    Popover: <Popover trigger={<Button>Usage</Button>} label="Usage details" width={280}><p>1,204 requests this month.</p></Popover>,
    Tooltip: <Tooltip content="Copy link"><IconButton icon="link" label="Copy link" /></Tooltip>,
    Menu: <Menu label="Project actions" trigger={<Button iconRight="chevron-down">Actions</Button>} items={[{ type: "label", label: "Project" }, { id: "rename", label: "Rename", icon: "pencil", shortcut: "F2", onSelect: () => {} }, { id: "duplicate", label: "Duplicate", icon: "copy", onSelect: () => {} }, { type: "separator" }, { id: "delete", label: "Delete", icon: "trash", danger: true, onSelect: () => {} }]} />,
    ContextMenu: <ContextMenu label="File actions" items={[{ id: "open", label: "Open", onSelect: () => {} }, { id: "move", label: "Move to", items: [{ id: "archive", label: "Archive", onSelect: () => {} }] }, { type: "separator" }, { id: "delete", label: "Delete", danger: true, shortcut: "Del", onSelect: () => {} }]}><Card>Right-click this area</Card></ContextMenu>,
    CommandPalette: (<><Button icon="command-line" onClick={() => setPalette(true)}>Open palette</Button><CommandPalette open={palette} onOpenChange={setPalette} groups={[{ heading: "Navigation", commands: [{ id: "home", label: "Go to home", shortcut: "G H", onSelect: () => {} }, { id: "settings", label: "Open settings", hint: "/settings", onSelect: () => {} }] }, { heading: "Actions", commands: [{ id: "new", label: "New project", keywords: ["create"], onSelect: () => {} }] }]} /></>),
    Toast: <Button onClick={() => toast({ title: "Changes saved", description: "Your profile is up to date.", intent: "success" })}>Show toast</Button>,
    Tabs: <Tabs label="Account sections" items={[{ value: "overview", label: "Overview", content: <p>Overview content</p> }, { value: "activity", label: "Activity", content: <p>Activity content</p> }, { value: "settings", label: "Settings", icon: "cog", content: <p>Settings content</p> }]} />,
    Breadcrumb: <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Projects", href: "/components" }, { label: "Website redesign" }]} />,
    Pagination: <Pagination page={page} pageCount={20} onPageChange={setPage} />,
    Stepper: <Stepper current={1} steps={[{ label: "Account", description: "Email and password" }, { label: "Profile" }, { label: "Confirm" }]} />,
    Accordion: <Accordion defaultValue={["billing"]} items={[{ value: "billing", title: "How does billing work?", content: <p>You are charged monthly.</p> }, { value: "cancel", title: "Can I cancel anytime?", content: <p>Yes, from your account settings.</p> }]} />,
    Tree: <Tree label="Project files" defaultExpanded={["src"]} nodes={[{ id: "src", label: "src", icon: "folder", children: [{ id: "src/index.ts", label: "index.ts", icon: "document" }, { id: "src/app.tsx", label: "app.tsx", icon: "document" }] }, { id: "readme", label: "README.md", icon: "document" }]} />,
    NavList: <NavList label="Main" heading="Workspace"><NavLink href="#" icon="home" active>Home</NavLink><NavLink href="#" icon="folder" trailing="12">Projects</NavLink><NavLink href="#" icon="cog">Settings</NavLink></NavList>,
    TabStrip: <TabStrip tabs={[{ id: "a", title: "main.ts" }, { id: "b", title: "README.md" }]} activeId={tab} onSelect={setTab} onClose={() => {}} onAdd={() => {}} />,
    SplitPane: <div className="zd-split-demo"><SplitPane defaultSizes={[0.6, 0.4]}><Pane header="Editor" focused>Left</Pane><Pane header="Preview" focused={false}>Right</Pane></SplitPane></div>,
  };
}

interface HtmlEntry { behavior: string; examples: { title: string; html: string; script?: string }[] }
const contract: Record<string, HtmlEntry> = { ...(zuiHtml.components as Record<string, HtmlEntry>), ...(zoutHtml.components as Record<string, HtmlEntry>) };
const BEHAVIOR: Record<string, string> = { none: "Solo CSS", dom: "CSS + zui/dom", react: "Solo React por ahora" };

// Código del ejemplo: binding de React o contrato HTML para cualquier otro framework.
function Code({ name, react }: { name: string; react: string }) {
  const [view, setView] = useState("react");
  const entry = contract[name];
  const html = entry?.examples[0];
  if (!html) return <CodeBlock language="tsx" code={react} />;
  return (
    <>
      <div className="zd-demo__switch">
        <SegmentedControl size="sm" label="Code" value={view} onValueChange={setView} items={[{ value: "react", label: "React" }, { value: "html", label: "HTML" }]} />
        <Badge tone={entry.behavior === "react" ? "warning" : "neutral"}>{BEHAVIOR[entry.behavior] ?? entry.behavior}</Badge>
      </div>
      {view === "react" ? <CodeBlock language="tsx" code={react} /> : <CodeBlock language="html" code={html.script ? `${html.html}\n\n<script type="module">\n${html.script}\n</script>` : html.html} />}
    </>
  );
}

const COLUMN = new Set(["Calendar", "Combobox", "Input", "Textarea", "RadioGroup", "Slider", "StatTile", "Meter", "Progress", "DataTable", "Alert", "Skeleton", "EmptyState", "Card", "Panel", "Callout", "CodeBlock", "Tabs", "Stepper", "Accordion", "Tree", "NavList", "SplitPane", "ContextMenu"]);

export default function Components() {
  const demos = Demos();
  return (
    <Layout title="Componentes" description="Catálogo de zui y zout">
      <main className="zd-page z-root">
        <div className="zd-wrap">
          <header>
            <h1>Componentes</h1>
            <p className="zd-sub">{zui.count} componentes de zui y {zout.count} layouts de zout. Las demos son los componentes reales. Cada ejemplo se puede ver como React o como HTML: el mismo marcado y las mismas clases sirven en cualquier framework.</p>
          </header>
          {GROUPS.map((g) => {
            const items = all.filter((c) => c.group === g);
            if (!items.length) return null;
            return (
              <section key={g} id={g}>
                <h2 className="zd-h2">{LABEL[g]} <Badge tone="neutral">{items.length}</Badge></h2>
                <Grid min={360} gap={4}>
                  {items.map((c) => (
                    <article key={c.name} className="zd-demo z-liquid">
                      <div className="zd-demo__head"><h3 className="zd-demo__name">{c.name}</h3><span className="zd-demo__group">{c.group}</span></div>
                      <p className="zd-area__text">{c.description}</p>
                      {demos[c.name] ? <div className={COLUMN.has(c.name) ? "zd-demo__stage zd-demo__stage--col" : "zd-demo__stage"}>{demos[c.name]}</div> : null}
                      <Code name={c.name} react={c.examples[0]?.code ?? ""} />
                    </article>
                  ))}
                </Grid>
              </section>
            );
          })}
        </div>
      </main>
    </Layout>
  );
}
