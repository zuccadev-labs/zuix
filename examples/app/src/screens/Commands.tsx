import { useRef, useState } from "react";
import { Grid, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  ActionBar,
  Banner,
  Button,
  Card,
  CardHeader,
  Avatar,
  Collapsible,
  Command,
  Drawer,
  HoverCard,
  Kbd,
  IconButton,
  Input,
  Popover,
  Toggletip,
  Link,
  Menu,
  Menubar,
  ToggleGroup,
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
  useToast,
  type MenuEntry,
} from "@zuccadev-labs/zuix-zui";

/** Oleada 4 en React: barras, menús con estado, capas ligeras y avisos de aplicación. Cada pieza deja su valor a la vista. */
export function Commands() {
  const { promise } = useToast();
  // Promesa que la prueba resuelve o rechaza a mano (window.__deploy).
  const deploy = () =>
    promise(
      new Promise<string>((resolve, reject) => {
        (window as unknown as { __deploy?: unknown }).__deploy = { resolve, reject };
      }),
      {
        loading: "Deploying…",
        success: (version) => ({ title: "Deployed", description: `Version ${version} is live.` }),
        error: "Deploy failed",
      },
    ).catch(() => undefined);
  const [last, setLast] = useState("none");
  const [format, setFormat] = useState<string[]>(["bold"]);
  const [minimap, setMinimap] = useState(true);
  const [wrap, setWrap] = useState(false);
  const [density, setDensity] = useState("comfortable");
  const [details, setDetails] = useState(false);
  const [banner, setBanner] = useState(true);
  const [statusBar, setStatusBar] = useState(false);
  const [snap, setSnap] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const toggleFile = (name: string) => setSelected((list) => (list.includes(name) ? list.filter((n) => n !== name) : [...list, name]));
  const domain = useRef<HTMLInputElement | null>(null);

  const view: MenuEntry[] = [
    { type: "checkbox", id: "minimap", label: "Minimap", checked: minimap, onCheckedChange: setMinimap },
    { type: "checkbox", id: "wrap", label: "Word wrap", shortcut: "Alt Z", checked: wrap, onCheckedChange: setWrap },
    { type: "separator" },
    {
      type: "radio-group",
      id: "density",
      label: "Density",
      value: density,
      onValueChange: setDensity,
      items: [
        { value: "compact", label: "Compact" },
        { value: "comfortable", label: "Comfortable" },
        { value: "spacious", label: "Spacious", disabled: true },
      ],
    },
    { type: "separator" },
    { id: "docs", label: "Keyboard shortcuts", icon: "command-line", href: "#shortcuts" },
  ];

  return (
    <Page
      header={
        <PageHeader eyebrow="Components" title="Commands" description="Toolbars, stateful menus, light layers and application notices." />
      }
    >
      {banner ? (
        <Banner
          data-testid="c-banner"
          tone="accent"
          badge="New"
          title="Workspaces are here."
          action={<Link href="#changelog">See what changed</Link>}
          onDismiss={() => setBanner(false)}
        >
          Group projects and share layouts with your team.
        </Banner>
      ) : (
        <p className="app-muted" data-testid="c-banner-gone">
          Notice dismissed.
        </p>
      )}
      <p className="app-muted">
        Last action: <output data-testid="c-last">{last}</output>
      </p>

      <PageSection title="Menubar">
        <Card className="app-demo">
          <CardHeader title="Application menus" subtitle="One tab stop; arrows move between menus" />
          <Menubar
            label="Application"
            menus={[
              {
                id: "file",
                label: "File",
                items: [
                  { id: "new", label: "New file", icon: "document-plus", shortcut: "Ctrl N", onSelect: () => setLast("file:new") },
                  { id: "open", label: "Open…", icon: "folder-open", shortcut: "Ctrl O", onSelect: () => setLast("file:open") },
                  {
                    id: "recent",
                    label: "Open recent",
                    icon: "clock",
                    items: [
                      { id: "readme", label: "atlas/README.md", onSelect: () => setLast("file:readme") },
                      { id: "tokens", label: "borealis/tokens.json", onSelect: () => setLast("file:tokens") },
                    ],
                  },
                  { type: "separator" },
                  { id: "save", label: "Save", icon: "arrow-down-tray", shortcut: "Ctrl S", onSelect: () => setLast("file:save") },
                ],
              },
              {
                id: "edit",
                label: "Edit",
                items: [
                  { id: "undo", label: "Undo", icon: "arrow-uturn-up-left", shortcut: "Ctrl Z", onSelect: () => setLast("edit:undo") },
                  { id: "redo", label: "Redo", icon: "arrow-uturn-up-right", shortcut: "Ctrl Y", onSelect: () => setLast("edit:redo") },
                ],
              },
              {
                id: "view",
                label: "View",
                items: [{ type: "checkbox", id: "status", label: "Status bar", checked: statusBar, onCheckedChange: setStatusBar }],
              },
              { id: "help", label: "Help", disabled: true, items: [] },
            ]}
          />
          <p className="app-muted">
            Status bar: <output data-testid="c-statusbar">{String(statusBar)}</output>
          </p>
        </Card>
      </PageSection>

      <PageSection title="Sheets">
        <Card className="app-demo">
          <CardHeader title="Drawer" subtitle="Snap points and drag to close" />
          <Stack gap={8}>
            <Drawer
              side="bottom"
              title="Comments"
              snapPoints={[0.4, 0.85]}
              snapPoint={snap}
              onSnapPointChange={setSnap}
              trigger={<Button data-testid="c-sheet">Comments</Button>}
            >
              <p>Drag the handle or use the arrow keys on it.</p>
            </Drawer>
            <Drawer side="top" size="sm" title="Search" dragToClose trigger={<Button data-testid="c-top">Search from top</Button>}>
              <Input aria-label="Search" placeholder="Search…" />
            </Drawer>
            <p className="app-muted">
              Snap: <output data-testid="c-snap">{snap}</output>
            </p>
          </Stack>
        </Card>
      </PageSection>

      <PageSection title="Selection">
        <Card className="app-demo">
          <CardHeader title="ActionBar" subtitle="Floats while something is selected" />
          <Stack gap={6}>
            {["report.pdf", "tokens.json", "logo.svg"].map((name) => (
              <label key={name} className="app-inline">
                <input type="checkbox" checked={selected.includes(name)} onChange={() => toggleFile(name)} data-testid={`c-file-${name}`} />
                {name}
              </label>
            ))}
          </Stack>
          <ActionBar open={selected.length > 0} count={`${selected.length} selected`} onClose={() => setSelected([])}>
            <IconButton icon="arrow-down-tray" label="Download" size="sm" onClick={() => setLast(`download:${selected.length}`)} />
            <IconButton icon="share" label="Share" size="sm" />
            <IconButton icon="trash" label="Delete" size="sm" variant="danger" />
          </ActionBar>
        </Card>
      </PageSection>

      <PageSection title="Command">
        <Card className="app-demo">
          <CardHeader title="Inline command" subtitle="The palette, embedded" />
          <div data-testid="c-command">
            <Command
              id="c-command"
              label="Project commands"
              groups={[
                {
                  heading: "Project",
                  commands: [
                    { id: "rename", label: "Rename project", icon: "pencil", shortcut: "F2", onSelect: () => setLast("command:rename") },
                    { id: "duplicate", label: "Duplicate", icon: "document-duplicate", onSelect: () => setLast("command:duplicate") },
                  ],
                },
                {
                  heading: "Go to",
                  commands: [
                    { id: "settings", label: "Settings", icon: "gear", hint: "Project", onSelect: () => setLast("command:settings") },
                    { id: "members", label: "Members", icon: "users", onSelect: () => setLast("command:members") },
                  ],
                },
              ]}
              footer={
                <>
                  <span>
                    <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move
                  </span>
                  <span>
                    <Kbd>Enter</Kbd> to run
                  </span>
                </>
              }
            />
          </div>
        </Card>
      </PageSection>

      <PageSection title="Light layers">
        <Grid min={260}>
          <Card className="app-demo">
            <CardHeader title="HoverCard" subtitle="Preview on hover or focus" />
            <p>
              Reviewed by{" "}
              <HoverCard
                arrow
                trigger={
                  <a href="#ana" data-testid="c-hover-link">
                    @ana
                  </a>
                }
              >
                <Stack gap={4}>
                  <Avatar name="Ana Ruiz" size="md" />
                  <strong>Ana Ruiz</strong>
                  <span className="app-muted">Design systems · Madrid</span>
                  <a href="#ana-projects" data-testid="c-hover-projects">
                    12 projects
                  </a>
                </Stack>
              </HoverCard>{" "}
              yesterday.{" "}
              <button type="button" data-testid="c-after-hover">
                After
              </button>
            </p>
          </Card>
          <Card className="app-demo">
            <CardHeader title="Toggletip" subtitle="Help you ask for" />
            <span className="app-inline" data-testid="c-toggletip">
              Shipping
              <Toggletip label="More about shipping">
                Free on orders over $50. <a href="#shipping">Shipping policy</a>.
              </Toggletip>
            </span>
          </Card>
          <Card className="app-demo">
            <CardHeader title="Popover" subtitle="Arrow, close and another anchor" />
            <Button size="sm" onClick={deploy} data-testid="c-deploy">
              Deploy
            </Button>
            <Stack gap={8}>
              <Input ref={domain} aria-label="Domain" defaultValue="zuix.dev" data-testid="c-domain" />
              <Popover
                label="DNS help"
                anchor={domain}
                arrow
                showClose
                align="start"
                trigger={<IconButton icon="question-mark-circle" label="DNS help" data-testid="c-dns" />}
              >
                <p>
                  Point an A record to <code>76.76.21.21</code>.
                </p>
              </Popover>
            </Stack>
          </Card>
        </Grid>
      </PageSection>

      <PageSection title="Toolbar">
        <Grid min={320}>
          <Card className="app-demo">
            <CardHeader title="Editor toolbar" subtitle="One tab stop, arrows inside" />
            <Toolbar label="Text formatting" controls="c-editor" data-testid="c-toolbar">
              <ToggleGroup
                type="multiple"
                label="Style"
                variant="ghost"
                size="sm"
                value={format}
                onValueChange={setFormat}
                items={[
                  { value: "bold", icon: "bold", ariaLabel: "Bold" },
                  { value: "italic", icon: "italic", ariaLabel: "Italic" },
                  { value: "underline", icon: "underline", ariaLabel: "Underline" },
                ]}
              />
              <ToolbarSeparator />
              <ToolbarGroup label="Insert">
                <IconButton icon="link" label="Insert link" size="sm" onClick={() => setLast("toolbar:link")} />
                <IconButton icon="photo" label="Insert image" size="sm" onClick={() => setLast("toolbar:image")} />
                <IconButton
                  icon="code-bracket"
                  label="Insert code"
                  size="sm"
                  aria-disabled="true"
                  onClick={() => setLast("toolbar:code")}
                />
              </ToolbarGroup>
              <ToolbarSeparator />
              <Menu
                label="View options"
                items={view}
                trigger={
                  <Button size="sm" variant="ghost" iconRight="chevron-down" data-testid="c-view">
                    View
                  </Button>
                }
              />
            </Toolbar>
            <p id="c-editor" className="app-muted">
              Format: <output data-testid="c-format">{format.join(",")}</output> · minimap{" "}
              <output data-testid="c-minimap">{String(minimap)}</output> · wrap <output data-testid="c-wrap">{String(wrap)}</output> ·
              density <output data-testid="c-density">{density}</output>
            </p>
          </Card>
          <Card className="app-demo">
            <CardHeader title="Collapsible" subtitle="Disclosure and partial collapse" />
            <Stack gap={8}>
              <Collapsible id="c-advanced" title="Advanced settings" icon="adjustments-horizontal" open={details} onOpenChange={setDetails}>
                <p>Retries, timeouts and the proxy used for outgoing requests.</p>
              </Collapsible>
              <Collapsible id="c-notes" title="Show full description" peek={44}>
                <p>
                  The release adds a workspace layout with resizable panes, a floating inspector and grouped tabs.{" "}
                  <a href="#notes">Read the notes</a>.
                </p>
              </Collapsible>
              <p className="app-muted">
                Advanced open: <output data-testid="c-details">{String(details)}</output>
              </p>
            </Stack>
          </Card>
        </Grid>
      </PageSection>
    </Page>
  );
}
