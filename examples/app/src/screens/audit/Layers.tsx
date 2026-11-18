// Pantalla de capas (?screen=layers): las capas de zui apiladas unas dentro de otras y gobernadas desde fuera.
// La recorre tests/browser/cases-layers.mjs: orden de cierre, fugas tras cientos de aperturas, cambios de `open` en
// mitad de una transición y desmontaje con la capa abierta. No forma parte de la navegación de la aplicación.
import { useEffect, useState } from "react";
import {
  Button,
  CommandPalette,
  ConfirmDialog,
  DatePicker,
  Drawer,
  Menu,
  Modal,
  Popover,
  Select,
  ToastProvider,
  Tooltip,
  useToast,
} from "@zuccadev-labs/zuix-zui";

type MenuItems = Parameters<typeof Menu>[0]["items"];

const OPTIONS = [
  { value: "alpha", label: "Alpha" },
  { value: "beta", label: "Beta" },
  { value: "gamma", label: "Gamma" },
];
const ITEMS: MenuItems = [
  { id: "one", label: "One", onSelect: () => {} },
  { id: "two", label: "Two", onSelect: () => {} },
  { id: "more", label: "More", items: [{ id: "sub", label: "Sub one", onSelect: () => {} }] },
];

/** Capas que la prueba abre y cierra por nombre. */
export type LayerKind = "modal" | "drawer" | "confirm" | "palette" | "popover" | "popover-modal" | "menu" | "select" | "date" | "tooltip";

declare global {
  interface Window {
    /** Mandos de la pantalla de capas para las pruebas de navegador. */
    zLayers?: { open: (kind: LayerKind | null) => void; mount: (mounted: boolean) => void; toast: () => void };
  }
}

/** Drawer > Modal > Popover > Menu, y un segundo Modal apilado sobre el primero. */
function Nested() {
  const [log, setLog] = useState<string[]>([]);
  const note = (name: string) => (open: boolean) => setLog((list) => [...list, `${name}:${open ? "open" : "closed"}`]);
  return (
    <section>
      <Drawer trigger={<Button data-testid="l-drawer">Open drawer</Button>} title="Drawer" onOpenChange={note("drawer")}>
        <Modal trigger={<Button data-testid="l-modal">Open modal</Button>} title="First modal" onOpenChange={note("modal")}>
          <Popover label="Details" trigger={<Button data-testid="l-popover">Open popover</Button>} onOpenChange={note("popover")}>
            <Menu label="Actions" trigger={<Button data-testid="l-menu">Open menu</Button>} items={ITEMS} onOpenChange={note("menu")} />
            <Select aria-label="Scope" options={OPTIONS} />
          </Popover>
          <Modal trigger={<Button data-testid="l-modal-2">Open second modal</Button>} title="Second modal" onOpenChange={note("second")}>
            <Button data-testid="l-modal-2-inside">Inside</Button>
          </Modal>
        </Modal>
      </Drawer>
      <output data-testid="l-log">{log.join(" ")}</output>
    </section>
  );
}

/** Una capa de cada tipo, controlada: `window.zLayers.open(kind)` abre una y cierra las demás. */
function Controlled() {
  const [kind, setKind] = useState<LayerKind | null>(null);
  const [mounted, setMounted] = useState(true);
  const { toast } = useToast();
  useEffect(() => {
    window.zLayers = { open: setKind, mount: setMounted, toast: () => toast({ title: "Saved" }) };
    return () => {
      window.zLayers = undefined;
    };
  }, [toast]);
  if (!mounted) return <p data-testid="l-unmounted">Unmounted</p>;
  const on = (name: LayerKind) => kind === name;
  const set = (name: LayerKind) => (open: boolean) => setKind(open ? name : null);
  return (
    <section data-testid="l-controlled">
      <Modal open={on("modal")} onOpenChange={set("modal")} title="Modal">
        <Button>Inside</Button>
      </Modal>
      <Drawer open={on("drawer")} onOpenChange={set("drawer")} title="Drawer">
        Drawer
      </Drawer>
      <ConfirmDialog open={on("confirm")} onOpenChange={set("confirm")} title="Delete project?" />
      <CommandPalette
        open={on("palette")}
        onOpenChange={set("palette")}
        groups={[{ heading: "Go to", commands: [{ id: "home", label: "Home", onSelect: () => {} }] }]}
      />
      <Popover label="Details" open={on("popover")} onOpenChange={set("popover")} trigger={<Button>Popover</Button>}>
        Popover
      </Popover>
      <Popover label="Rename" modal open={on("popover-modal")} onOpenChange={set("popover-modal")} trigger={<Button>Modal popover</Button>}>
        <Button>Inside</Button>
      </Popover>
      <Menu label="Actions" open={on("menu")} onOpenChange={set("menu")} trigger={<Button>Menu</Button>} items={ITEMS} />
      <Select aria-label="Scope" open={on("select")} onOpenChange={set("select")} options={OPTIONS} />
      <DatePicker aria-label="Due date" open={on("date")} onOpenChange={set("date")} />
      <Tooltip content="Hint" open={on("tooltip")} onOpenChange={set("tooltip")}>
        <Button>Tooltip</Button>
      </Tooltip>
    </section>
  );
}

export function Layers() {
  return (
    <ToastProvider>
      <main data-testid="screen-layers" className="z-root z-canvas layers">
        <Nested />
        <Controlled />
      </main>
    </ToastProvider>
  );
}
