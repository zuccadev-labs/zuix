"use client";
// Menú propio (patrón APG «menu»): capas `popover="manual"`, foco itinerante con foco real en cada entrada,
// búsqueda por letra, submenús de varios niveles con zona de gracia del puntero y cierre por Escape (un nivel),
// Tab, pulsación fuera o elección. Lo usan Menu (anclado a un disparador) y ContextMenu (anclado a un punto).
// Mismo marcado y mismas teclas que `.z-menu[popover]` en @zuccadev-labs/zuix-zui/dom.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { isRtl, logicalKey } from "../core/dir";
import { focusQuiet } from "../core/focus";
import { createMenuAim, type MenuAim } from "../core/menu-aim";
import { submenuAnchor, topInset, type Box, type Placement } from "../core/place";
import { move } from "../core/roving";
import { createTypeahead, isPrintable, type Typeahead } from "../core/typeahead";
import { cx } from "../cx";
import type { MenuEntry, MenuItemEntry } from "../components/overlay/internal";
import { useIsoLayoutEffect, useLayer, usePresence } from "./hooks";
import { Popup, Portal, rectOf } from "./popup";

const OPEN_MS = 100;
const CLOSE_MS = 200;

const itemsOf = (menu: Element) => [...menu.querySelectorAll<HTMLElement>(":scope > .z-menu__item")].filter((item) => item.getAttribute("aria-disabled") !== "true");
const labelOf = (item: HTMLElement) => (item.querySelector(".z-menu__text") ?? item).textContent ?? "";

/** Resalta una entrada y le da el foco; las demás del mismo menú dejan de estar resaltadas. */
function highlight(menu: Element, item: HTMLElement | undefined): void {
  for (const other of menu.querySelectorAll(":scope > [data-highlighted]")) if (other !== item) other.removeAttribute("data-highlighted");
  if (!item) return;
  item.setAttribute("data-highlighted", "");
  focusQuiet(item);
}

interface Tree {
  /** Submenús abiertos: id de la entrada que abre cada nivel. */
  path: string[];
  setPath: (path: string[]) => void;
  /** El último nivel se abrió con el teclado: su primera entrada recibe el foco. */
  focusSub: RefObject<boolean>;
  menus: RefObject<Set<HTMLElement>>;
  aim: MenuAim;
  search: Typeahead;
  timer: RefObject<ReturnType<typeof setTimeout> | undefined>;
  size: "md" | "lg";
  open: boolean;
  /** Abierto con el teclado: la primera entrada recibe el foco. Con el puntero lo recibe el menú, sin resaltar nada. */
  focusFirst: boolean;
  close: (refocus: boolean) => void;
  anchor: RefObject<Element | null>;
}

function ItemBody({ entry, sub }: { entry: MenuItemEntry; sub?: boolean }) {
  return (
    <>
      <span className="z-menu__icon">{entry.icon ? <Icon name={entry.icon} size={14} /> : null}</span>
      <span className="z-menu__text">{entry.label}</span>
      {entry.shortcut ? <kbd className="z-menu__shortcut">{entry.shortcut}</kbd> : null}
      {sub ? (
        <span className="z-menu__chevron">
          <Icon name="chevron-right" size={14} />
        </span>
      ) : null}
    </>
  );
}

interface LevelProps {
  tree: Tree;
  items: MenuEntry[];
  depth: number;
  id: string;
  anchorRect: () => Box | null;
  placement: Placement;
  gap: number;
  label?: string;
  labelledBy?: string;
  className?: string;
  /** Entrada del menú padre que abre este nivel. */
  parentItem?: RefObject<HTMLElement | null>;
}

function Level({ tree, items, depth, id, anchorRect, placement, gap, label, labelledBy, className, parentItem }: LevelProps) {
  const node = useRef<HTMLDivElement | null>(null);
  const triggers = useRef(new Map<string, HTMLElement>());
  const openId = tree.path[depth];

  useIsoLayoutEffect(() => {
    const menu = node.current;
    if (!menu) return;
    tree.menus.current.add(menu);
    // Abierto con el teclado, el foco va a la primera entrada (APG); con el puntero, al propio menú: nada queda
    // resaltado hasta que el puntero o una flecha elijan entrada. Un submenú sigue la misma regla.
    if (depth === 0 ? tree.focusFirst : tree.focusSub.current) highlight(menu, itemsOf(menu)[0]);
    else if (depth === 0) focusQuiet(menu);
    tree.focusSub.current = false;
    return () => {
      tree.menus.current.delete(menu);
    };
  }, []);

  const closeSub = () => {
    if (tree.path.length > depth) tree.setPath(tree.path.slice(0, depth));
  };
  const openSub = (entry: MenuItemEntry, focusFirst: boolean) => {
    clearTimeout(tree.timer.current);
    if (openId === entry.id) {
      // Ya abierto (por el puntero): el teclado solo lleva el foco a su primera entrada.
      const sub = focusFirst ? document.getElementById(`${id}-${entry.id}`) : null;
      if (sub) highlight(sub, itemsOf(sub)[0]);
      return;
    }
    tree.focusSub.current = focusFirst;
    tree.setPath([...tree.path.slice(0, depth), entry.id]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const menu = node.current;
    // Los eventos de un submenú suben por el árbol de React aunque esté en otro punto del DOM: solo cuenta lo propio.
    if (!menu || !(event.target instanceof Node) || !menu.contains(event.target) || !tree.open) return;
    const list = itemsOf(menu);
    const current = list.find((item) => item === document.activeElement) ?? null;
    const key = logicalKey(event.key, menu);
    const next = move(list, current, event.key, true);
    if (next) {
      event.preventDefault();
      // El foco pasa a otra entrada: el submenú que dejó abierto la anterior se cierra.
      clearTimeout(tree.timer.current);
      closeSub();
      highlight(menu, next);
    } else if (event.key === "Tab") {
      // El foco vuelve al disparador y el tabulador sigue desde él.
      tree.close(true);
    } else if (key === "ArrowRight" && current?.getAttribute("aria-haspopup") === "menu") {
      event.preventDefault();
      current.click();
    } else if (key === "ArrowLeft" && depth > 0) {
      // Cierra solo este submenú; el foco vuelve a la entrada que lo abrió.
      event.preventDefault();
      tree.setPath(tree.path.slice(0, depth - 1));
      const parent = parentItem?.current;
      if (parent?.parentElement) highlight(parent.parentElement, parent);
    } else if (isPrintable(event) && (event.key !== " " || tree.search.pending())) {
      const hit = list[tree.search(list.map(labelOf), event.key, current ? list.indexOf(current) : -1)];
      event.preventDefault();
      if (hit) {
        closeSub();
        highlight(menu, hit);
      }
    }
  };

  // Puntero sobre una entrada: la resalta y, con un pequeño retardo, abre su submenú o cierra el de otra entrada.
  // Mientras el puntero va camino del submenú abierto (zona de gracia), las entradas que cruza no cuentan.
  const onItemPointer = (entry: MenuItemEntry, event: PointerEvent<HTMLElement>) => {
    const menu = node.current;
    if (!menu || event.pointerType !== "mouse" || entry.disabled || !tree.open) return;
    if (openId && openId !== entry.id && tree.aim.blocks({ x: event.clientX, y: event.clientY })) return;
    if (document.activeElement !== event.currentTarget) highlight(menu, event.currentTarget);
    if (entry.items?.length) {
      if (openId !== entry.id) {
        clearTimeout(tree.timer.current);
        tree.timer.current = setTimeout(() => openSub(entry, false), OPEN_MS);
      }
    } else if (openId) {
      clearTimeout(tree.timer.current);
      tree.timer.current = setTimeout(closeSub, CLOSE_MS);
    }
  };
  const onItemLeave = (entry: MenuItemEntry, event: PointerEvent<HTMLElement>) => {
    if (openId !== entry.id) {
      if (entry.items?.length) clearTimeout(tree.timer.current);
      return;
    }
    const sub = document.getElementById(`${id}-${entry.id}`);
    if (sub) tree.aim.start({ x: event.clientX, y: event.clientY }, sub.getBoundingClientRect(), sub.dataset.side === "left" ? "left" : "right");
  };

  return (
    <>
      <Popup
        ref={node}
        id={id}
        open={tree.open}
        anchorRect={anchorRect}
        placement={placement}
        gap={gap}
        role="menu"
        tabIndex={-1}
        aria-label={label}
        aria-labelledby={label ? undefined : labelledBy}
        aria-orientation="vertical"
        className={cx("z-liquid z-menu", className)}
        data-size={tree.size}
        onKeyDown={onKeyDown}
      >
        {items.map((entry, index) => {
          // biome-ignore lint/suspicious/noArrayIndexKey: separadores y títulos no tienen identidad propia.
          if (entry.type === "separator") return <div key={`sep-${index}`} role="separator" className="z-menu__separator" />;
          if (entry.type === "label") {
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: separadores y títulos no tienen identidad propia.
              <div key={`label-${index}`} className="z-menu__label">
                {entry.label}
              </div>
            );
          }
          const sub = Boolean(entry.items?.length);
          const expanded = sub && openId === entry.id;
          return (
            <button
              key={entry.id}
              ref={(el) => {
                if (el) triggers.current.set(entry.id, el);
                else triggers.current.delete(entry.id);
              }}
              type="button"
              role="menuitem"
              id={`${id}-item-${entry.id}`}
              className="z-menu__item"
              tabIndex={-1}
              aria-disabled={entry.disabled || undefined}
              data-disabled={entry.disabled ? "" : undefined}
              data-danger={entry.danger || undefined}
              aria-haspopup={sub ? "menu" : undefined}
              aria-expanded={sub ? expanded : undefined}
              aria-controls={expanded ? `${id}-${entry.id}` : undefined}
              data-state={sub ? (expanded ? "open" : "closed") : undefined}
              onPointerMove={(event) => onItemPointer(entry, event)}
              onPointerLeave={(event) => onItemLeave(entry, event)}
              onClick={(event) => {
                if (entry.disabled || !tree.open) return;
                // Una entrada con submenú no se elige: lo abre. Activada con teclado (detail 0), enfoca su primera entrada.
                if (sub) return openSub(entry, event.detail === 0);
                entry.onSelect?.();
                if (!entry.keepOpen) tree.close(true);
              }}
            >
              <ItemBody entry={entry} sub={sub} />
            </button>
          );
        })}
      </Popup>
      {items.map((entry) => {
        if (entry.type === "separator" || entry.type === "label" || !entry.items?.length || openId !== entry.id || !tree.open) return null;
        const trigger = { current: triggers.current.get(entry.id) ?? null };
        return (
          <Portal key={entry.id} anchor={tree.anchor}>
            <Level
              tree={tree}
              items={entry.items}
              depth={depth + 1}
              id={`${id}-${entry.id}`}
              // Pegado al borde del menú padre, con la primera entrada a la altura de la que lo abre. En RTL, a la izquierda.
              anchorRect={() => {
                const menu = node.current;
                const item = triggers.current.get(entry.id);
                const child = document.getElementById(`${id}-${entry.id}`);
                return menu && item ? submenuAnchor(menu.getBoundingClientRect(), item.getBoundingClientRect(), child ? topInset(child) : 0) : null;
              }}
              placement={node.current && isRtl(node.current) ? "left-start" : "right-start"}
              gap={4}
              labelledBy={`${id}-item-${entry.id}`}
              parentItem={trigger}
            />
          </Portal>
        );
      })}
    </>
  );
}

export interface MenuSurfaceProps {
  open: boolean;
  /** Cierre pedido por el menú (elección, Escape, Tab, pulsación o foco fuera). */
  onClose: () => void;
  items: MenuEntry[];
  size: "md" | "lg";
  /** Disparador (Menu) o zona (ContextMenu): decide dónde se monta el menú. */
  anchor: RefObject<HTMLElement | null>;
  /** Punto de la ventana al que se ancla (ContextMenu). Sin él, se ancla a `anchor`. */
  point?: { x: number; y: number } | null;
  /** Abierto con el teclado: el foco va a la primera entrada. */
  focusFirst?: boolean;
  /** Pulsar el ancla no cuenta como pulsación fuera (el disparador alterna el menú con su propio clic). */
  anchorIsTrigger?: boolean;
  placement: Placement;
  gap?: number;
  label?: string;
  labelledBy?: string;
  className?: string;
  id?: string;
}

export function MenuSurface({ open, onClose, items, size, anchor, point, anchorIsTrigger, focusFirst = false, placement, gap = 4, label, labelledBy, className, id: idProp }: MenuSurfaceProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const [path, setPath] = useState<string[]>([]);
  const menus = useRef(new Set<HTMLElement>());
  const focusSub = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [aim] = useState(() => createMenuAim());
  const [search] = useState(() => createTypeahead(600));
  // Elemento con el foco antes de abrir: lo recupera al cerrar un menú sin disparador (contextual).
  const previous = useRef<HTMLElement | null>(null);
  const root = useRef<HTMLElement | null>(null);
  const present = usePresence(open, root);
  const inside = (target: Node) => [...menus.current].some((menu) => menu.contains(target));

  useEffect(() => {
    if (!open) return;
    return () => {
      clearTimeout(timer.current);
      aim.clear();
      setPath([]);
    };
  }, [open, aim]);

  const close = (refocus: boolean) => {
    const had = inside(document.activeElement ?? document.body);
    onClose();
    if (refocus && had) focusQuiet(anchorIsTrigger ? anchor.current : previous.current);
  };

  useLayer(open, {
    contains: (target) => inside(target) || (Boolean(anchorIsTrigger) && (anchor.current?.contains(target) ?? false)),
    // Escape cierra un nivel (APG): el submenú de arriba o, si no hay, el menú. El foco vuelve a quien lo abrió.
    onEscape: () => {
      if (!path.length) return close(true);
      const parentId = path.length > 1 ? `${id}-${path.slice(0, -1).join("-")}` : id;
      const item = document.getElementById(`${parentId}-item-${path[path.length - 1]}`);
      setPath(path.slice(0, -1));
      if (item?.parentElement) highlight(item.parentElement, item);
    },
    onPointerOutside: () => close(false),
    onFocusOutside: () => close(false),
  });

  if (!present) return null;
  const tree: Tree = { path: open ? path : [], setPath, focusSub, menus, aim, search, timer, size, open, focusFirst, close, anchor };
  return (
    <Portal anchor={anchor}>
      <RootLevel key={point ? `${point.x},${point.y}` : "anchor"} tree={tree} root={root} previous={previous} items={items} id={id} anchorRect={() => (point ? { left: point.x, top: point.y, width: 0, height: 0 } : rectOf(anchor.current))} placement={placement} gap={gap} label={label} labelledBy={labelledBy} className={className} />
    </Portal>
  );
}

/** Nivel raíz: recuerda el foco previo antes de que el menú lo tome y expone su elemento para la animación de salida. */
function RootLevel({ root, previous, ...level }: Omit<LevelProps, "depth"> & { root: RefObject<HTMLElement | null>; previous: RefObject<HTMLElement | null> }) {
  const [ready, setReady] = useState(false);
  useIsoLayoutEffect(() => {
    previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setReady(true);
  }, [previous]);
  useIsoLayoutEffect(() => {
    root.current = document.getElementById(level.id);
  });
  return ready ? <Level {...level} depth={0} /> : null;
}
