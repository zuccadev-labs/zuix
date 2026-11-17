// Pantalla de auditoría (?screen=audit): un ejemplar de cada componente interactivo de zui con `data-testid`
// estables. La recorre tests/browser/cases-audit-react.mjs. No forma parte de la navegación de la aplicación.
import { useMemo, useState } from "react";
import {
  Button, Calendar, Combobox, CommandPalette, ConfirmDialog, ContextMenu, DatePicker, Drawer, Menu, Modal, Popover, SearchInput, Select, ToastProvider, Tooltip, useToast,
  type PaletteGroup,
} from "@zuccadev-labs/zuix-zui";
import { Cell, OPTIONS, Out, StaticSections } from "./sections";

type MenuItems = Parameters<typeof Menu>[0]["items"];

/** Menú con tres niveles de submenú, un elemento persistente y uno deshabilitado. */
function useMenu(scope: string) {
  const [last, setLast] = useState("none");
  const [pinned, setPinned] = useState(false);
  const pick = (id: string) => () => setLast(`${scope}:${id}`);
  const items: MenuItems = [
    { id: "new", label: "New file", icon: "plus", shortcut: "Ctrl N", onSelect: pick("new") },
    { id: "pin", label: pinned ? "Unpin" : "Pin", keepOpen: true, onSelect: () => setPinned((value) => !value) },
    { id: "locked", label: "Locked", disabled: true, onSelect: pick("locked") },
    {
      id: "share",
      label: "Share",
      items: [
        { id: "email", label: "Email", onSelect: pick("email") },
        {
          id: "team",
          label: "Team",
          items: [
            { id: "design", label: "Design", onSelect: pick("design") },
            {
              id: "eng",
              label: "Engineering",
              items: [
                { id: "frontend", label: "Frontend", onSelect: pick("frontend") },
                { id: "backend", label: "Backend", onSelect: pick("backend") },
              ],
            },
          ],
        },
      ],
    },
    { type: "separator" },
    { id: "delete", label: "Delete", danger: true, onSelect: pick("delete") },
  ];
  return { items, last, pinned };
}

/** Los controles con popup propio, para montarlos dentro de un Popover y de un Drawer. */
function Composite({ scope }: { scope: string }) {
  const menu = useMenu(scope);
  const [role, setRole] = useState("");
  const [person, setPerson] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>("2026-03-10");
  const [due, setDue] = useState<string | null>(null);
  const id = (name: string) => `${scope}-${name}`;
  return (
    <div className="audit__cell" data-testid={id("content")}>
      <div className="audit__row">
        <Menu trigger={<Button size="sm" data-testid={id("menu")}>Actions</Button>} items={menu.items} label="Actions" />
        <Out id={id("menu-value")}>{menu.last}</Out>
      </div>
      <ContextMenu items={menu.items} label="Zone actions">
        <div className="audit__zone" data-testid={id("zone")}>Right-click zone</div>
      </ContextMenu>
      <div data-testid={id("select")}>
        <Select options={OPTIONS} value={role} onValueChange={setRole} placeholder="Choose" aria-label="Letter" />
      </div>
      <Out id={id("select-value")}>{role || "none"}</Out>
      <div data-testid={id("combobox")}>
        <Combobox options={OPTIONS} value={person} onValueChange={setPerson} aria-label="Search letter" />
      </div>
      <Out id={id("combobox-value")}>{person ?? "none"}</Out>
      <div data-testid={id("datepicker")}>
        <DatePicker value={due} onValueChange={setDue} locale="en-US" weekStartsOn={1} aria-label="Due" />
      </div>
      <Out id={id("datepicker-value")}>{due ?? "none"}</Out>
      <div data-testid={id("calendar")}>
        <Calendar value={day} onValueChange={setDay} defaultMonth="2026-03" locale="en-US" weekStartsOn={1} />
      </div>
      <Out id={id("calendar-value")}>{day ?? "none"}</Out>
    </div>
  );
}

function Toasts() {
  const { toast, dismiss, dismissAll } = useToast();
  const [count, setCount] = useState(0);
  const [lastId, setLastId] = useState("");
  return (
    <Cell title="Toast" id="a-toast-cell">
      <div className="audit__row">
        <Button
          size="sm"
          data-testid="a-toast-add"
          onClick={() => {
            setCount((n) => n + 1);
            setLastId(toast({ title: `Notice ${count + 1}`, description: "Stays until dismissed", duration: 60000, intent: count % 2 ? "danger" : "success" }));
          }}
        >
          Add toast
        </Button>
        <Button size="sm" data-testid="a-toast-dismiss" onClick={() => dismiss(lastId)}>Dismiss last</Button>
        <Button size="sm" data-testid="a-toast-dismiss-all" onClick={dismissAll}>Dismiss all</Button>
      </div>
      <Out id="a-toast-last">{lastId || "none"}</Out>
    </Cell>
  );
}

/** Un campo que usa Escape para limpiarse, dentro de un Modal: la primera pulsación limpia, la segunda cierra. */
function ModalSearch() {
  return (
    <Cell title="SearchInput in Modal" id="a-ms-cell">
      <Modal trigger={<Button size="sm" data-testid="a-ms-open">Open search modal</Button>} title="Find a project">
        <SearchInput defaultValue="draft" aria-label="Project search" data-testid="a-ms-input" />
      </Modal>
    </Cell>
  );
}

const CORNERS = ["tl", "tr", "bl", "br"] as const;
const EDGES = [
  { at: "top", side: "top" },
  { at: "right", side: "right" },
  { at: "bottom", side: "bottom" },
  { at: "left", side: "left" },
] as const;

function OverlaySection() {
  const menu = useMenu("page");
  const [edges, setEdges] = useState(false);
  const [confirm, setConfirm] = useState("none");
  const [cancels, setCancels] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [ran, setRan] = useState("none");
  const [short, setShort] = useState(false);
  const [strict, setStrict] = useState(false);

  const groups = useMemo<PaletteGroup[]>(() => {
    const run = (id: string) => () => setRan(id);
    const files: PaletteGroup = {
      heading: "Files",
      commands: [
        { id: "open", label: "Open file", keywords: ["browse"], onSelect: run("open") },
        { id: "save", label: "Save file", onSelect: run("save") },
        { id: "locked", label: "Locked command", disabled: true, onSelect: run("locked") },
      ],
    };
    if (short) return [files];
    return [
      files,
      {
        heading: "View",
        commands: [
          { id: "zoom", label: "Zoom in", onSelect: run("zoom") },
          { id: "shrink", label: "Shrink the list", onSelect: () => setShort(true) },
          { id: "theme", label: "Toggle theme", onSelect: run("theme") },
        ],
      },
    ];
  }, [short]);
  // Filtro propio: solo el prefijo exacto de la etiqueta, sin puntuación difusa.
  const prefix = (list: PaletteGroup[], query: string) =>
    list.map((group) => ({ ...group, commands: group.commands.filter((command) => command.label.toLowerCase().startsWith(query.trim().toLowerCase())) })).filter((group) => group.commands.length > 0);

  return (
    <>
      <Cell title="Menu with nested submenus" id="a-menu-cell">
        <div className="audit__row">
          <Menu trigger={<Button data-testid="a-menu">Open menu</Button>} items={menu.items} label="File actions" align="start" />
          <Out id="a-menu-value">{menu.last}</Out>
          <Out id="a-menu-pinned">{menu.pinned ? "pinned" : "unpinned"}</Out>
        </div>
      </Cell>
      <Cell title="Composition" id="a-compose-cell">
        <div className="audit__row">
          <Popover trigger={<Button data-testid="a-compose-popover">Controls in a popover</Button>} label="Controls" width={320} align="start">
            <Composite scope="pop" />
          </Popover>
          <Drawer trigger={<Button data-testid="a-compose-drawer">Controls in a drawer</Button>} title="Controls">
            <Composite scope="drawer" />
          </Drawer>
        </div>
      </Cell>
      <Cell title="ConfirmDialog and Tooltip" id="a-confirm-cell">
        <div className="audit__row">
          <ConfirmDialog
            trigger={<Button variant="danger" data-testid="a-confirm">Delete</Button>}
            title="Delete the file?"
            description="This cannot be undone."
            intent="danger"
            onConfirm={() => setConfirm("confirmed")}
            onCancel={() => setCancels((n) => n + 1)}
          />
          <Tooltip content="Hover me and then the bubble">
            <Button data-testid="a-tip">Tooltip</Button>
          </Tooltip>
        </div>
        <Out id="a-confirm-value">{confirm}</Out>
        <Out id="a-confirm-cancels">{cancels}</Out>
      </Cell>
      <Cell title="CommandPalette" id="a-palette-cell">
        <div className="audit__row">
          <Button data-testid="a-palette" onClick={() => { setShort(false); setPaletteOpen(true); }}>Open palette</Button>
          <Button size="sm" data-testid="a-palette-strict" onClick={() => setStrict((value) => !value)}>Prefix filter: {strict ? "on" : "off"}</Button>
        </div>
        <Out id="a-palette-ran">{ran}</Out>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} groups={groups} closeOnSelect={false} filter={strict ? prefix : undefined} label="Audit commands" />
      </Cell>
      <Toasts />
        <ModalSearch />
      <Cell title="Viewport edges" id="a-edges-cell">
        <Button data-testid="a-edges" onClick={() => setEdges((value) => !value)}>Toggle edge triggers</Button>
        {edges
          ? CORNERS.map((at) => (
              <span key={at} className="audit__edge" data-at={at}>
                <Popover trigger={<Button size="sm" data-testid={`a-pop-${at}`}>P</Button>} label={`Popover ${at}`} width={260} side={at.startsWith("t") ? "top" : "bottom"} align={at.endsWith("l") ? "end" : "start"}>
                  <p className="app-text" data-testid={`a-pop-${at}-body`}>Popover content that has to stay inside the window at the {at} corner.</p>
                </Popover>
              </span>
            ))
          : null}
        {edges
          ? EDGES.map(({ at, side }) => (
              <span key={at} className="audit__edge" data-at={at}>
                <Tooltip content={`A long tooltip text anchored at the ${at} edge`} side={side} delay={0}>
                  <Button size="sm" data-testid={`a-tip-${at}`}>T</Button>
                </Tooltip>
              </span>
            ))
          : null}
      </Cell>
    </>
  );
}

export function Audit() {
  return (
    <ToastProvider limit={3} position="top-center" regionLabel="Audit notice">
      <main className="z-root z-canvas audit" data-testid="screen-audit">
        <h1 className="audit__title">Component audit</h1>
        <h2 className="audit__group">Overlays</h2>
        <div className="audit__grid"><OverlaySection /></div>
        <StaticSections />
      </main>
    </ToastProvider>
  );
}
