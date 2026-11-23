// Capas: cada una con su disparador a la vista; se abre al pulsarlo, como en una aplicación.
import {
  ActionBar,
  Button,
  Card,
  Checkbox,
  CommandPalette,
  ConfirmDialog,
  ContextMenu,
  Drawer,
  Field,
  IconButton,
  Input,
  Kbd,
  Menu,
  Modal,
  Popover,
  Radio,
  RadioGroup,
  SearchInput,
  Tooltip,
  useToast,
} from "@zuccadev-labs/zuix-zui";
import { useEffect, useRef, useState } from "react";
import { type ExampleDemos, wait } from "./shared";

const FILES = ["Q3 report.pdf", "Roadmap.key", "Logo.svg"];

export const overlay: Record<string, ExampleDemos> = {
  ActionBar: {
    "Flotante sobre la página": () => {
      const [selected, setSelected] = useState<string[]>([]);
      return (
        <div className="zd-demo-stack">
          {FILES.map((file) => (
            <Checkbox
              key={file}
              checked={selected.includes(file)}
              onCheckedChange={(on) => setSelected((list) => (on === true ? [...list, file] : list.filter((f) => f !== file)))}
            >
              {file}
            </Checkbox>
          ))}
          <ActionBar open={selected.length > 0} count={`${selected.length} files`} onClose={() => setSelected([])}>
            <IconButton icon="arrow-down-tray" label="Download" size="sm" />
            <IconButton icon="share" label="Share" size="sm" />
            <IconButton icon="trash" label="Delete" size="sm" variant="danger" onClick={() => setSelected([])} />
          </ActionBar>
        </div>
      );
    },
  },
  CommandPalette: {
    "Abrir con Ctrl/Cmd K": () => {
      const [open, setOpen] = useState(false);
      const { toast } = useToast();
      useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "k" && !e.defaultPrevented) {
            // El buscador del sitio también usa ⌘K: la paleta solo lo toma con el foco dentro de la demo.
            if (!(e.target instanceof Element && e.target.closest(".zd-palette-demo"))) return;
            e.preventDefault();
            setOpen((v) => !v);
          }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }, []);
      const run = (title: string) => () => toast({ title });
      return (
        <div className="zd-palette-demo">
          <Button icon="command-line" onClick={() => setOpen(true)}>
            Open palette
          </Button>
          <span className="zd-demo-hint">
            or press <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> with the button focused
          </span>
          <CommandPalette
            open={open}
            onOpenChange={setOpen}
            groups={[
              {
                heading: "Navigation",
                commands: [
                  { id: "home", label: "Go to home", shortcut: "G H", onSelect: run("Going home") },
                  { id: "settings", label: "Open settings", hint: "/settings", onSelect: run("Opening settings") },
                ],
              },
              {
                heading: "Actions",
                commands: [{ id: "new", label: "New project", keywords: ["create"], onSelect: run("Project created") }],
              },
            ]}
          />
        </div>
      );
    },
  },
  ConfirmDialog: {
    "Borrado destructivo": () => {
      const { toast } = useToast();
      return (
        <ConfirmDialog
          trigger={<Button variant="danger">Delete project</Button>}
          intent="danger"
          title="Delete project?"
          description="This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => toast({ title: "Project deleted", intent: "danger" })}
        />
      );
    },
  },
  ContextMenu: {
    "Sobre una tarjeta": () => {
      const { toast } = useToast();
      const say = (title: string) => () => toast({ title });
      return (
        <ContextMenu
          label="File actions"
          items={[
            { id: "open", label: "Open", onSelect: say("Opened Q3 report.pdf") },
            {
              id: "move",
              label: "Move to",
              items: [
                { id: "archive", label: "Archive", onSelect: say("Moved to Archive") },
                { id: "inbox", label: "Inbox", onSelect: say("Moved to Inbox") },
              ],
            },
            { type: "separator" },
            { id: "delete", label: "Delete", danger: true, shortcut: "Del", onSelect: say("Deleted Q3 report.pdf") },
          ]}
        >
          <Card>Right-click this area (or press Shift F10)</Card>
        </ContextMenu>
      );
    },
  },
  Drawer: {
    "Filtros a la derecha": () => (
      <Drawer trigger={<Button icon="funnel">Filters</Button>} title="Filters" side="right">
        <div className="zd-demo-stack">
          <Checkbox defaultChecked>Only mine</Checkbox>
          <Checkbox>Include archived</Checkbox>
          <RadioGroup aria-label="Sort by" defaultValue="recent">
            <Radio value="recent">Most recent</Radio>
            <Radio value="name">Name</Radio>
          </RadioGroup>
        </div>
      </Drawer>
    ),
    "Hoja inferior controlada": () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Show details</Button>
          <Drawer open={open} onOpenChange={setOpen} side="bottom" title="Details">
            <p>Order #4821 · shipped yesterday · arrives Friday.</p>
          </Drawer>
        </>
      );
    },
    "Arriba, arrastrar para cerrar": () => (
      <Drawer side="top" size="sm" title="Search" dragToClose trigger={<Button icon="magnifying-glass">Search</Button>}>
        <SearchInput aria-label="Search" placeholder="Search projects" />
      </Drawer>
    ),
  },
  Menu: {
    "Acciones de una fila": () => {
      const { toast } = useToast();
      const say = (title: string) => () => toast({ title });
      return (
        <Menu
          label="Project actions"
          trigger={<Button iconRight="chevron-down">Actions</Button>}
          items={[
            { type: "label", label: "Project" },
            { id: "rename", label: "Rename", icon: "pencil", shortcut: "F2", onSelect: say("Rename") },
            { id: "duplicate", label: "Duplicate", icon: "copy", onSelect: say("Duplicated") },
            { type: "separator" },
            { id: "delete", label: "Delete", icon: "trash", danger: true, onSelect: say("Deleted") },
          ]}
        />
      );
    },
  },
  Modal: {
    "Con disparador y pie": () => (
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
    "Controlado, tamaño grande": () => {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button icon="sparkles" onClick={() => setOpen(true)}>
            What's new
          </Button>
          <Modal open={open} onOpenChange={setOpen} size="lg" title="Release notes">
            <p>Version 2.4 brings a new command palette, faster search and keyboard shortcuts for every list.</p>
          </Modal>
        </>
      );
    },
  },
  Popover: {
    "Panel de detalles": () => (
      <Popover trigger={<Button>Usage</Button>} label="Usage details" width={280}>
        <p>1,204 requests this month.</p>
      </Popover>
    ),
    "Con flecha y cierre": () => (
      <Popover label="Storage" arrow showClose side="top" align="center" trigger={<Button icon="circle-stack">Storage</Button>}>
        <p>412 GB of 512 GB used.</p>
      </Popover>
    ),
    "Ancla distinta del disparador": () => {
      const field = useRef<HTMLInputElement | null>(null);
      return (
        <span className="zd-demo-inline">
          <Input ref={field} aria-label="Domain" defaultValue="zuix.dev" />
          <Popover
            label="DNS help"
            anchor={field}
            arrow
            side="bottom"
            align="start"
            trigger={<IconButton icon="question-mark-circle" label="DNS help" />}
          >
            Point an A record to 76.76.21.21.
          </Popover>
        </span>
      );
    },
  },
  Toast: {
    "Proveedor y uso": () => {
      const { toast } = useToast();
      return (
        <Button onClick={() => toast({ title: "Changes saved", description: "Your profile is up to date.", intent: "success" })}>
          Save
        </Button>
      );
    },
    "Error con acción": () => {
      const { toast, promise } = useToast();
      const upload = () =>
        void promise(wait(1200), { loading: "Uploading cover.png…", success: { title: "Uploaded", intent: "success" }, error: "Failed" });
      return (
        <Button
          icon="arrow-up-tray"
          onClick={() => toast({ title: "Upload failed", intent: "danger", action: { label: "Retry", onClick: upload } })}
        >
          Upload cover.png
        </Button>
      );
    },
  },
  Tooltip: {
    "Sobre un botón de icono": () => (
      <span className="zd-demo-inline">
        <Tooltip content="Copy link">
          <IconButton icon="link" label="Copy link" />
        </Tooltip>
        <Tooltip content="Download">
          <IconButton icon="arrow-down-tray" label="Download" />
        </Tooltip>
        <Tooltip content="Share">
          <IconButton icon="share" label="Share" />
        </Tooltip>
      </span>
    ),
  },
};
