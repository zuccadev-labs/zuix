// Demos de React de la página de cada componente: los componentes reales con varios estados a la vez.
// Un componente sin demo aquí se ve igual con los ejemplos de su manifiesto (contrato HTML en vivo).
import { type ReactNode, useRef, useState } from "react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import {
  Accordion,
  ActionBar,
  Alert,
  Avatar,
  AvatarGroup,
  Badge,
  Breadcrumb,
  Button,
  Calendar,
  Callout,
  Card,
  CardFooter,
  CardHeader,
  Checkbox,
  Chip,
  CodeBlock,
  ColorPicker,
  ColorPickerTrigger,
  Combobox,
  CopyButton,
  DatePicker,
  NativeSelect,
  CommandPalette,
  ConfirmDialog,
  ContextMenu,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  Input,
  Kbd,
  Menu,
  Meter,
  Modal,
  NavLink,
  NavList,
  OTPInput,
  Pagination,
  Panel,
  Popover,
  Progress,
  Radio,
  RadioGroup,
  Rating,
  SearchInput,
  SegmentedControl,
  Select,
  Skeleton,
  Slider,
  Spinner,
  StatTile,
  Stepper,
  Swap,
  Switch,
  Tabs,
  Textarea,
  Toggle,
  Toggletip,
  Tooltip,
  Tour,
  Tree,
  HoverCard,
  useToast,
} from "@zuccadev-labs/zuix-zui";
import { Grid, Pane, SplitPane, TabStrip } from "@zuccadev-labs/zuix-zout";

const users = [
  { id: 1, name: "Ana Ruiz", role: "Owner", seats: 3 },
  { id: 2, name: "Leo Park", role: "Editor", seats: 1 },
  { id: 3, name: "Mia Chen", role: "Viewer", seats: 2 },
];

export function useDemos(): Record<string, ReactNode> {
  const { toast, promise } = useToast();
  const [picked, setPicked] = useState<string[]>(["a"]);
  const [touring, setTouring] = useState(false);
  const [snap, setSnap] = useState(1);
  const dnsField = useRef<HTMLInputElement | null>(null);
  // Los enlaces de las demos son <a> normales: llevan el baseUrl del sitio a mano.
  const home = useBaseUrl("/");
  const here = useBaseUrl("/components");
  const [view, setView] = useState("list");
  const [on, setOn] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(2);
  const [palette, setPalette] = useState(false);
  const [tab, setTab] = useState("a");
  const [mine, setMine] = useState(true);
  return {
    HoverCard: (
      <p>
        Reviewed by{" "}
        <HoverCard arrow trigger={<a href={home}>@ana</a>}>
          <span className="zd-demo-card">
            <Avatar name="Ana Ruiz" size="md" />
            <strong>Ana Ruiz</strong>
            <span>Design systems · Madrid</span>
          </span>
        </HoverCard>{" "}
        yesterday.
      </p>
    ),
    Toggletip: (
      <span className="zd-demo-inline">
        Shipping
        <Toggletip label="More about shipping">Free on orders over $50. Orders placed before 2pm ship the same day.</Toggletip>
      </span>
    ),
    ActionBar: (
      <>
        {["a", "b", "c"].map((file) => (
          <Checkbox
            key={file}
            checked={picked.includes(file)}
            onCheckedChange={(on) => setPicked((list) => (on === true ? [...list, file] : list.filter((f) => f !== file)))}
          >
            {`File ${file.toUpperCase()}`}
          </Checkbox>
        ))}
        <ActionBar open={picked.length > 0} position="inline" count={`${picked.length} selected`} onClose={() => setPicked([])}>
          <IconButton icon="arrow-down-tray" label="Download" size="sm" />
          <IconButton icon="trash" label="Delete" size="sm" variant="danger" />
        </ActionBar>
      </>
    ),
    Tour: (
      <>
        <Button id="zd-tour-target" icon="sparkles" onClick={() => setTouring(true)}>
          Take the tour
        </Button>
        <Tour
          open={touring}
          onOpenChange={setTouring}
          steps={[
            { target: "#zd-tour-target", title: "Start here", content: "Every step points at the control it explains." },
            { title: "You are ready", content: "Escape or Skip close the tour at any step." },
          ]}
        />
      </>
    ),
    Button: (
      <>
        <Button variant="primary" icon="plus">
          New project
        </Button>
        <Button>Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger" icon="trash">
          Delete
        </Button>
        <Button loading>Saving</Button>
        <Button size="sm">Small</Button>
        <Button disabled>Disabled</Button>
      </>
    ),
    IconButton: (
      <>
        <IconButton icon="plus" label="New project" variant="primary" />
        <IconButton icon="gear" label="Settings" />
        <IconButton icon="bell" label="Notifications" variant="outline" />
        <IconButton icon="x-mark" label="Close" variant="ghost" />
        <IconButton icon="star" iconVariant="solid" label="Remove from favourites" active />
        <IconButton icon="trash" label="Delete" variant="danger" />
        <IconButton icon="arrow-path" label="Refreshing" loading />
        <IconButton icon="pencil" label="Edit (small)" size="sm" />
        <IconButton icon="pencil" label="Edit (large)" size="lg" />
      </>
    ),
    SegmentedControl: (
      <SegmentedControl
        label="View"
        value={view}
        onValueChange={setView}
        items={[
          { value: "list", label: "List", icon: "list-bullet" },
          { value: "grid", label: "Grid", icon: "squares-2x2" },
        ]}
      />
    ),
    Toggle: (
      <>
        <Toggle icon="star" label="Favourite" defaultPressed />
        <Toggle icon="bookmark" label="Bookmark" />
        <Toggle icon="bold" label="Bold" variant="ghost" defaultPressed />
        <Toggle icon="speaker-x-mark" defaultPressed>
          Mute
        </Toggle>
        <Toggle icon="eye" size="sm" label="Show hidden (small)" />
        <Toggle icon="eye" size="lg" label="Show hidden (large)" />
        <Toggle icon="lock-closed" label="Locked" disabled />
      </>
    ),
    CopyButton: (
      <>
        <CopyButton value="zx_live_4f9c2a" label="Copy API key" />
        <CopyButton value="zx_live_4f9c2a" label="Copy API key (small)" size="sm" variant="ghost" />
        <CopyButton value="pnpm add @zuccadev-labs/zuix" variant="outline">
          Copy command
        </CopyButton>
        <CopyButton value="https://example.com/i/8d2k" variant="primary">
          Copy invite link
        </CopyButton>
      </>
    ),
    Swap: (
      <>
        <Toggle label="Dark mode">
          <Swap effect="rotate" off={<Icon name="sun" />} on={<Icon name="moon" />} />
        </Toggle>
        <Toggle label="Menu" variant="ghost">
          <Swap effect="scale" off={<Icon name="bars-3" />} on={<Icon name="x-mark" />} />
        </Toggle>
        <Toggle label="Favourite" variant="ghost">
          <Swap effect="flip" off={<Icon name="heart" />} on={<Icon name="heart" variant="solid" />} />
        </Toggle>
        <Toggle label="Play">
          <Swap effect="fade" off={<Icon name="play" />} on={<Icon name="pause" />} />
        </Toggle>
      </>
    ),
    Input: (
      <Field label="Project name" hint="Shown in the sidebar." required>
        <Input placeholder="My project" />
      </Field>
    ),
    Textarea: <Textarea placeholder="Describe the change" rows={3} aria-label="Description" />,
    Select: (
      <Select
        aria-label="Region"
        placeholder="Choose a region"
        defaultValue=""
        options={[
          { value: "eu", label: "Europe" },
          { value: "us", label: "United States" },
        ]}
      />
    ),
    NativeSelect: (
      <NativeSelect
        aria-label="Region"
        placeholder="Choose a region"
        defaultValue=""
        options={[
          { value: "eu", label: "Europe" },
          { value: "us", label: "United States" },
        ]}
      />
    ),
    Combobox: (
      <Combobox
        aria-label="Country"
        placeholder="Search a country"
        clearable
        options={[
          { value: "ar", label: "Argentina" },
          { value: "br", label: "Brazil" },
          { value: "cl", label: "Chile" },
          { value: "mx", label: "Mexico" },
          { value: "es", label: "Spain" },
          { value: "uy", label: "Uruguay" },
        ]}
      />
    ),
    Calendar: <Calendar locale="en-US" defaultValue="2026-11-13" min="2026-11-05" max="2026-12-20" />,
    DatePicker: <DatePicker aria-label="Due date" locale="en-US" defaultValue="2026-11-13" />,
    Checkbox: (
      <Checkbox defaultChecked description="We will email you once a week.">
        Send me the summary
      </Checkbox>
    ),
    RadioGroup: (
      <RadioGroup aria-label="Plan" defaultValue="team">
        <Radio value="solo">Solo</Radio>
        <Radio value="team" description="Up to 10 members.">
          Team
        </Radio>
        <Radio value="org" disabled>
          Organization
        </Radio>
      </RadioGroup>
    ),
    Switch: (
      <Switch checked={on} onCheckedChange={setOn}>
        Automatic updates
      </Switch>
    ),
    Slider: <Slider aria-label="Volume" defaultValue={[60]} max={100} step={5} />,
    SearchInput: <SearchInput value={query} onValueChange={setQuery} placeholder="Search projects" />,
    OTPInput: <OTPInput length={6} />,
    Badge: (
      <>
        <Badge tone="success" dot>
          Active
        </Badge>
        <Badge tone="warning">Pending</Badge>
        <Badge tone="danger">Failed</Badge>
        <Badge tone="info">Info</Badge>
        <Badge tone="accent" variant="solid" icon="star">
          Pro
        </Badge>
      </>
    ),
    Chip: (
      <Chip selected={mine} onClick={() => setMine(!mine)} icon="user" count={12}>
        Assigned to me
      </Chip>
    ),
    Avatar: (
      <>
        <Avatar name="Ana Ruiz" status="online" statusLabel="Online" />
        <AvatarGroup max={3} aria-label="Members">
          <Avatar name="Ana Ruiz" />
          <Avatar name="Leo Park" />
          <Avatar name="Mia Chen" />
          <Avatar name="Sam Diaz" />
        </AvatarGroup>
      </>
    ),
    StatTile: (
      <Grid min={180} gap={3}>
        <StatTile label="Requests" value="18,240" hint="last 24 h" delta="+12%" deltaTone="success" icon="chart-bar" />
        <StatTile label="Errors" value="0.4%" delta="-0.1%" deltaTone="success" icon="exclamation-triangle" />
      </Grid>
    ),
    Meter: <Meter label="Disk usage" showLabel value={412} max={512} valueLabel="412 GB of 512 GB" warningAt={384} dangerAt={480} />,
    Progress: <Progress label="Upload progress" value={64} max={100} showValue />,
    Rating: <Rating value={4.3} showValue caption="(128 reviews)" />,
    Kbd: (
      <>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </>
    ),
    DataTable: (
      <DataTable
        caption="Users"
        captionHidden
        rows={users}
        rowKey={(u) => u.id}
        defaultSort={{ key: "name", direction: "asc" }}
        columns={[
          { key: "name", header: "Name", accessor: (u) => u.name, sortable: true },
          { key: "role", header: "Role", accessor: (u) => u.role },
          { key: "seats", header: "Seats", accessor: (u) => u.seats, sortable: true, align: "end", mono: true },
        ]}
      />
    ),
    Alert: (
      <>
        <Alert tone="success" title="Changes saved">
          Your profile is up to date.
        </Alert>
        <Alert tone="warning" title="Storage almost full">
          Free up space to keep syncing.
        </Alert>
      </>
    ),
    Spinner: <Spinner />,
    Skeleton: <Skeleton lines={3} />,
    EmptyState: (
      <EmptyState
        icon="folder-plus"
        title="No projects yet"
        description="Create your first project to start organising work."
        action={
          <Button variant="primary" icon="plus">
            New project
          </Button>
        }
      />
    ),
    Card: (
      <Card>
        <CardHeader title="Billing" subtitle="Next invoice on 1 December" action={<Badge tone="success">Active</Badge>} />
        <p>Team plan, 8 seats.</p>
        <CardFooter>
          <Button variant="ghost">Cancel plan</Button>
          <Button variant="primary">Manage</Button>
        </CardFooter>
      </Card>
    ),
    Panel: (
      <Panel
        title="Traffic"
        description="Last 7 days"
        actions={
          <Button size="sm" icon="arrow-down-tray">
            Export
          </Button>
        }
      >
        <StatTile variant="soft" label="Visits" value="48,120" />
      </Panel>
    ),
    Callout: (
      <Callout tone="info" title="Tip">
        Press <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> to open the command palette.
      </Callout>
    ),
    CodeBlock: <CodeBlock title="install.sh" language="bash" code={"pnpm add @zuccadev-labs/zuix\npnpm dev"} />,
    Modal: (
      <Modal
        trigger={<Button>Edit profile</Button>}
        title="Edit profile"
        description="Changes are saved to your account."
        footer={<Button variant="primary">Save</Button>}
      >
        <Field label="Name">
          <Input defaultValue="Ana Ruiz" />
        </Field>
      </Modal>
    ),
    ConfirmDialog: (
      <ConfirmDialog
        trigger={<Button variant="danger">Delete project</Button>}
        intent="danger"
        title="Delete project?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => toast({ title: "Project deleted", intent: "danger" })}
      />
    ),
    Drawer: (
      <>
        <Drawer trigger={<Button icon="funnel">Filters</Button>} title="Filters" side="right">
          <Checkbox defaultChecked>Only mine</Checkbox>
        </Drawer>
        <Drawer
          side="bottom"
          title="Comments"
          snapPoints={[0.4, 0.85]}
          snapPoint={snap}
          onSnapPointChange={setSnap}
          trigger={<Button>Bottom sheet with snap points</Button>}
        >
          <p>Drag the handle or use the arrow keys on it.</p>
        </Drawer>
      </>
    ),
    Popover: (
      <>
        <Popover trigger={<Button>Usage</Button>} label="Usage details" width={280}>
          <p>1,204 requests this month.</p>
        </Popover>
        <Input ref={dnsField} aria-label="Domain" defaultValue="zuix.dev" />
        <Popover
          label="DNS help"
          anchor={dnsField}
          arrow
          showClose
          align="start"
          trigger={<IconButton icon="question-mark-circle" label="DNS help" />}
        >
          Point an A record to 76.76.21.21.
        </Popover>
      </>
    ),
    Tooltip: (
      <Tooltip content="Copy link">
        <IconButton icon="link" label="Copy link" />
      </Tooltip>
    ),
    Menu: (
      <Menu
        label="Project actions"
        trigger={<Button iconRight="chevron-down">Actions</Button>}
        items={[
          { type: "label", label: "Project" },
          { id: "rename", label: "Rename", icon: "pencil", shortcut: "F2", onSelect: () => {} },
          { id: "duplicate", label: "Duplicate", icon: "copy", onSelect: () => {} },
          { type: "separator" },
          { id: "delete", label: "Delete", icon: "trash", danger: true, onSelect: () => {} },
        ]}
      />
    ),
    ContextMenu: (
      <ContextMenu
        label="File actions"
        items={[
          { id: "open", label: "Open", onSelect: () => {} },
          { id: "move", label: "Move to", items: [{ id: "archive", label: "Archive", onSelect: () => {} }] },
          { type: "separator" },
          { id: "delete", label: "Delete", danger: true, shortcut: "Del", onSelect: () => {} },
        ]}
      >
        <Card>Right-click this area</Card>
      </ContextMenu>
    ),
    CommandPalette: (
      <>
        <Button icon="command-line" onClick={() => setPalette(true)}>
          Open palette
        </Button>
        <CommandPalette
          open={palette}
          onOpenChange={setPalette}
          groups={[
            {
              heading: "Navigation",
              commands: [
                { id: "home", label: "Go to home", shortcut: "G H", onSelect: () => {} },
                { id: "settings", label: "Open settings", hint: "/settings", onSelect: () => {} },
              ],
            },
            { heading: "Actions", commands: [{ id: "new", label: "New project", keywords: ["create"], onSelect: () => {} }] },
          ]}
        />
      </>
    ),
    Toast: (
      <>
        <Button onClick={() => toast({ title: "Changes saved", description: "Your profile is up to date.", intent: "success" })}>
          Show toast
        </Button>
        <Button
          onClick={() =>
            void promise(new Promise((resolve) => setTimeout(() => resolve("0.3.0"), 1500)), {
              loading: "Deploying…",
              success: (version) => ({ title: "Deployed", description: `Version ${String(version)} is live.` }),
              error: "Deploy failed",
            })
          }
        >
          Deploy (promise)
        </Button>
      </>
    ),
    ColorPicker: (
      <ColorPicker
        defaultValue="#3b82f6"
        swatches={["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b", "#0f172a"]}
      />
    ),
    ColorPickerTrigger: (
      <ColorPickerTrigger
        id="demo-accent"
        defaultValue="#8b5cf6"
        label="Accent color"
        swatches={["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"]}
      />
    ),
    Tabs: (
      <Tabs
        label="Account sections"
        items={[
          { value: "overview", label: "Overview", content: <p>Overview content</p> },
          { value: "activity", label: "Activity", content: <p>Activity content</p> },
          { value: "settings", label: "Settings", icon: "cog", content: <p>Settings content</p> },
        ]}
      />
    ),
    Breadcrumb: <Breadcrumb items={[{ label: "Home", href: home }, { label: "Projects", href: here }, { label: "Website redesign" }]} />,
    Pagination: <Pagination page={page} pageCount={20} onPageChange={setPage} />,
    Stepper: (
      <Stepper current={1} steps={[{ label: "Account", description: "Email and password" }, { label: "Profile" }, { label: "Confirm" }]} />
    ),
    Accordion: (
      <Accordion
        defaultValue={["billing"]}
        items={[
          { value: "billing", title: "How does billing work?", content: <p>You are charged monthly.</p> },
          { value: "cancel", title: "Can I cancel anytime?", content: <p>Yes, from your account settings.</p> },
        ]}
      />
    ),
    Tree: (
      <Tree
        label="Project files"
        defaultExpanded={["src"]}
        nodes={[
          {
            id: "src",
            label: "src",
            icon: "folder",
            children: [
              { id: "src/index.ts", label: "index.ts", icon: "document" },
              { id: "src/app.tsx", label: "app.tsx", icon: "document" },
            ],
          },
          { id: "readme", label: "README.md", icon: "document" },
        ]}
      />
    ),
    NavList: (
      <NavList label="Main" heading="Workspace">
        <NavLink href="#" icon="home" active>
          Home
        </NavLink>
        <NavLink href="#" icon="folder" trailing="12">
          Projects
        </NavLink>
        <NavLink href="#" icon="cog">
          Settings
        </NavLink>
      </NavList>
    ),
    TabStrip: (
      <TabStrip
        tabs={[
          { id: "a", title: "main.ts" },
          { id: "b", title: "README.md" },
        ]}
        activeId={tab}
        onSelect={setTab}
        onClose={() => {}}
        onAdd={() => {}}
      />
    ),
    SplitPane: (
      <div className="zd-split-demo">
        <SplitPane defaultSizes={[0.6, 0.4]}>
          <Pane header="Editor" focused>
            Left
          </Pane>
          <Pane header="Preview" focused={false}>
            Right
          </Pane>
        </SplitPane>
      </div>
    ),
  };
}

/** Demos que se leen mejor apiladas en columna que en fila. */
export const COLUMN = new Set([
  "Banner",
  "Collapsible",
  "Command",
  "Calendar",
  "Combobox",
  "Input",
  "Textarea",
  "RadioGroup",
  "Slider",
  "StatTile",
  "Meter",
  "Progress",
  "DataTable",
  "Alert",
  "Skeleton",
  "EmptyState",
  "Card",
  "Panel",
  "Callout",
  "CodeBlock",
  "Tabs",
  "Stepper",
  "Accordion",
  "Tree",
  "NavList",
  "SplitPane",
  "ContextMenu",
]);
