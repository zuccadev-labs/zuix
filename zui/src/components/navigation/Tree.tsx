"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { announce } from "../../core/announcer";
import {
  TREE_DRAG_LABELS,
  checkStates,
  dropSlots,
  moveNode,
  rangeIds,
  toggleCheck,
  validDrop,
  type CheckState,
  type DropPosition,
  type TreeDrop,
  type TreeDragLabels,
} from "../../core/tree";
import { bindTreeDrag } from "../../core/tree-drag";
import { wantsVirtual } from "../../core/virtual";
import { fill } from "../../core/vnode";
import { cx } from "../../cx";
import { useIsoLayoutEffect, useLatest } from "../../primitives/hooks";
import { useVirtual } from "../../primitives/virtual";

export type { DropPosition, TreeDrop, TreeDragLabels };
export { TREE_DRAG_LABELS };

export interface TreeNode {
  id: string;
  label: ReactNode;
  icon?: IconName;
  disabled?: boolean;
  children?: TreeNode[];
  /** Rama cuyos hijos aún no están: al expandirla se piden con `loadChildren`. */
  hasChildren?: boolean;
}

export interface TreeProps {
  nodes: TreeNode[];
  /** Nombre accesible del árbol. */
  label: string;
  /** Ids expandidos (controlado). */
  expanded?: string[];
  defaultExpanded?: string[];
  onExpandedChange?: (ids: string[]) => void;
  /** Id seleccionado (controlado, selección simple). */
  selected?: string | null;
  defaultSelected?: string | null;
  /** Nodo activado (clic, Intro; Espacio en selección simple). */
  onSelect?: (id: string, node: TreeNode) => void;
  /** `multiple`: Ctrl/Cmd y Mayús con el puntero, Espacio, Mayús+flechas y Ctrl+A con el teclado. */
  selectionMode?: "single" | "multiple";
  /** Ids seleccionados (controlado, selección múltiple). */
  selectedIds?: string[];
  defaultSelectedIds?: string[];
  onSelectedChange?: (ids: string[]) => void;
  /** Casilla por nodo con estado mixto en cascada (aria-checked). */
  checkable?: boolean;
  /** Ids marcados (controlado). Las ramas se deducen de sus hijos. */
  checked?: string[];
  defaultChecked?: string[];
  onCheckedChange?: (ids: string[]) => void;
  /** F2 o doble clic sobre la etiqueta: campo para renombrar (Intro confirma, Escape cancela). */
  renamable?: boolean;
  onRename?: (id: string, label: string, node: TreeNode) => void;
  /** Nombre accesible del campo de renombrar. */
  renameLabel?: string;
  /**
   * Carga diferida: hijos de una rama con `hasChildren` al expandirla por primera vez. El árbol guarda lo cargado;
   * mientras llega, el nodo lleva aria-busy.
   */
  loadChildren?: (node: TreeNode) => Promise<TreeNode[]>;
  /** Texto si la carga de una rama falla (se anuncia y la rama se vuelve a cerrar). */
  loadErrorLabel?: string;
  /**
   * Mover nodos: arrastrar con el puntero, o con el teclado Ctrl/⌘+X para cogerlo, ↑/↓ para elegir el sitio, Intro
   * (o Ctrl/⌘+V) para soltarlo y Escape para cancelar. El árbol no cambia `nodes`: lo hace la aplicación con lo que
   * recibe `onMove`.
   */
  draggable?: boolean;
  /**
   * Un nodo movido: `drop` dice cuál y adónde; `nodes` es el árbol ya movido (con las ramas de carga diferida que
   * el árbol guarda), listo para `setNodes(nodes)`.
   */
  onMove?: (drop: TreeDrop, nodes: TreeNode[]) => void;
  /** ¿Se puede soltar ahí? Además de lo que el árbol ya impide (dentro de sí mismo). */
  canDrop?: (drop: TreeDrop) => boolean;
  dragLabels?: Partial<TreeDragLabels>;
  /**
   * Ventana virtual: con muchas filas visibles, el árbol desplaza dentro de su alto (`--z-tree-height`, 480 px), pinta
   * solo lo que se ve y deja las filas en plano con aria-level, aria-setsize y aria-posinset. `true` siempre, `false`
   * nunca, un número es el umbral; por defecto, a partir de 200 filas visibles.
   */
  virtualize?: boolean | number;
  className?: string;
}

interface Row {
  node: TreeNode;
  level: number;
  parent: string | null;
  /** Posición entre sus hermanos y cuántos son (para los lectores en plano). */
  pos: number;
  size: number;
}

const textOf = (node: TreeNode, el: Element | null | undefined) =>
  (
    el?.querySelector(":scope > .z-tree__row .z-tree__label")?.textContent ?? (typeof node.label === "string" ? node.label : node.id)
  ).trim();

export function Tree({
  nodes: given,
  label,
  expanded,
  defaultExpanded,
  onExpandedChange,
  selected,
  defaultSelected = null,
  onSelect,
  selectionMode = "single",
  selectedIds,
  defaultSelectedIds,
  onSelectedChange,
  checkable,
  checked,
  defaultChecked,
  onCheckedChange,
  renamable,
  onRename,
  renameLabel = "Rename",
  loadChildren,
  loadErrorLabel = "Couldn't load this folder",
  draggable,
  onMove,
  canDrop,
  dragLabels,
  virtualize,
  className,
}: TreeProps) {
  const multiple = selectionMode === "multiple";
  const labels = { ...TREE_DRAG_LABELS, ...dragLabels };
  const [ownExpanded, setOwnExpanded] = useState<string[]>(defaultExpanded ?? []);
  const [ownSelected, setOwnSelected] = useState<string | null>(defaultSelected);
  const [ownSelectedIds, setOwnSelectedIds] = useState<string[]>(defaultSelectedIds ?? []);
  const [ownChecked, setOwnChecked] = useState<string[]>(defaultChecked ?? []);
  const [focused, setFocused] = useState<string | null>(null);
  const [renaming, setRenamingState] = useState<string | null>(null);
  // Carga diferida: hijos que llegaron y ramas que se están pidiendo.
  const [loaded, setLoaded] = useState<ReadonlyMap<string, TreeNode[]>>(() => new Map());
  const [loading, setLoading] = useState<ReadonlySet<string>>(() => new Set());
  // Arrastre con teclado: el nodo cogido y el destino elegido.
  const [grab, setGrab] = useState<{ id: string; at: number } | null>(null);
  const renamingRef = useRef<string | null>(null);
  const setRenaming = (id: string | null) => {
    renamingRef.current = id;
    setRenamingState(id);
  };
  const anchor = useRef<string | null>(null);
  const refs = useRef(new Map<string, HTMLLIElement>());
  const treeRef = useRef<HTMLUListElement | null>(null);
  const pendingFocus = useRef<string | null>(null);

  // Árbol efectivo: los nodos de la aplicación con los hijos cargados de forma diferida.
  const nodes = useMemo(() => {
    if (!loaded.size) return given;
    const merge = (list: TreeNode[]): TreeNode[] =>
      list.map((node) => {
        const kids = node.children ?? loaded.get(node.id);
        return kids ? { ...node, children: merge(kids) } : node;
      });
    return merge(given);
  }, [given, loaded]);

  const open = useMemo(() => new Set(expanded ?? ownExpanded), [expanded, ownExpanded]);
  const current = selected === undefined ? ownSelected : selected;
  const picked = useMemo(() => new Set(selectedIds ?? ownSelectedIds), [selectedIds, ownSelectedIds]);
  const checkedIds = checked ?? ownChecked;
  const states = useMemo(
    () => (checkable ? checkStates(nodes, checkedIds) : new Map<string, CheckState>()),
    [checkable, nodes, checkedIds],
  );
  const isSelected = (id: string) => (multiple ? picked.has(id) : current === id);
  const branch = (node: TreeNode) => Boolean(node.children?.length) || (Boolean(node.hasChildren) && !node.children);

  // Filas visibles en orden, para moverse con el teclado (y para la ventana virtual).
  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (list: TreeNode[], level: number, parent: string | null) => {
      list.forEach((node, i) => {
        out.push({ node, level, parent, pos: i + 1, size: list.length });
        if (node.children?.length && open.has(node.id)) walk(node.children, level + 1, node.id);
      });
    };
    walk(nodes, 1, null);
    return out;
  }, [nodes, open]);
  const rowIndex = useMemo(() => new Map(rows.map((r, i) => [r.node.id, i])), [rows]);

  // Foco itinerante: el enfocado, si sigue visible; si no, el seleccionado o el primero.
  const tabStop = rows.find((r) => r.node.id === focused)?.node.id ?? rows.find((r) => isSelected(r.node.id))?.node.id ?? rows[0]?.node.id;

  // Ventana virtual: en plano, con la parada de Tab y el nodo que se edita siempre en el documento.
  const virtual = wantsVirtual(virtualize, rows.length, 200);
  const keep = [tabStop, renaming, grab?.id].map((id) => (id ? (rowIndex.get(id) ?? -1) : -1)).filter((i) => i >= 0);
  const win = useVirtual({
    enabled: virtual,
    count: rows.length,
    // Fila de 32 px más el hueco de 1 px entre filas.
    size: 33,
    keep,
    scroller: treeRef,
  });
  useIsoLayoutEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const el = refs.current.get(id);
    if (!el) return;
    pendingFocus.current = null;
    el.focus();
  });

  const setOpen = (id: string, next: boolean) => {
    const ids = new Set(open);
    if (next) ids.add(id);
    else ids.delete(id);
    const list = [...ids];
    if (expanded === undefined) setOwnExpanded(list);
    onExpandedChange?.(list);
  };
  const expand = (node: TreeNode, next: boolean) => {
    setOpen(node.id, next);
    if (!next || !loadChildren || node.children || !node.hasChildren || loading.has(node.id)) return;
    setLoading((s) => new Set(s).add(node.id));
    loadChildren(node).then(
      (kids) => {
        setLoaded((m) => new Map(m).set(node.id, kids));
        setLoading((s) => {
          const n = new Set(s);
          n.delete(node.id);
          return n;
        });
      },
      () => {
        setLoading((s) => {
          const n = new Set(s);
          n.delete(node.id);
          return n;
        });
        setOpen(node.id, false);
        announce(loadErrorLabel, { source: treeRef.current ?? undefined });
      },
    );
  };
  const focus = (id: string | undefined | null) => {
    if (!id) return;
    setFocused(id);
    const el = refs.current.get(id);
    if (el) {
      el.focus();
      return;
    }
    // Fuera de la ventana virtual: se desplaza a la fila y el foco llega tras pintarla.
    pendingFocus.current = id;
    win.scrollToIndex(rowIndex.get(id) ?? 0);
  };
  const setPicked = (ids: string[]) => {
    if (selectedIds === undefined) setOwnSelectedIds(ids);
    onSelectedChange?.(ids);
  };
  const enabledIds = (ids: string[]) => ids.filter((id) => !rows[rowIndex.get(id) ?? -1]?.node.disabled);
  const select = (node: TreeNode) => {
    if (node.disabled) return;
    if (multiple) {
      anchor.current = node.id;
      setPicked([node.id]);
    } else if (selected === undefined) setOwnSelected(node.id);
    onSelect?.(node.id, node);
  };
  const togglePicked = (node: TreeNode) => {
    if (node.disabled) return;
    anchor.current = node.id;
    setPicked(picked.has(node.id) ? [...picked].filter((id) => id !== node.id) : [...picked, node.id]);
  };
  const extendTo = (node: TreeNode) => {
    const visible = rows.map((r) => r.node.id);
    const from = anchor.current && visible.includes(anchor.current) ? anchor.current : node.id;
    anchor.current = from;
    setPicked(enabledIds(rangeIds(visible, from, node.id)));
  };
  const toggleChecked = (node: TreeNode) => {
    if (node.disabled) return;
    const next = toggleCheck(nodes, checkedIds, node.id);
    if (checked === undefined) setOwnChecked(next);
    onCheckedChange?.(next);
  };
  const activate = (node: TreeNode) => {
    if (node.disabled) return;
    if (branch(node)) expand(node, !open.has(node.id));
    select(node);
  };
  const commitRename = (node: TreeNode, value: string, keep: boolean) => {
    // Intro y la pérdida de foco al quitar el campo no confirman dos veces.
    if (renamingRef.current !== node.id) return;
    setRenaming(null);
    const next = value.trim();
    if (keep && next) onRename?.(node.id, next, node);
    // El foco vuelve al nodo tras quitar el campo.
    requestAnimationFrame(() => refs.current.get(node.id)?.focus());
  };

  /* ---------- Mover nodos ---------- */
  const allowed = (drop: TreeDrop) => validDrop(nodes, drop) && (canDrop?.(drop) ?? true);
  const nameOf = (id: string) => {
    const row = rows[rowIndex.get(id) ?? -1];
    return row ? textOf(row.node, refs.current.get(id)) : id;
  };
  // Destinos del arrastre con teclado: se calculan al pintar mientras hay un nodo cogido (pocos y baratos).
  const slots = grab
    ? dropSlots(
        rows.map((r) => ({ id: r.node.id, level: r.level, last: r.pos === r.size, disabled: r.node.disabled })),
        nodes,
        grab.id,
      ).filter(allowed)
    : [];
  const slot = grab ? slots[grab.at] : undefined;
  const slotText = (drop: TreeDrop) => fill(labels[drop.position], { name: nameOf(drop.target) });
  const drop = (d: TreeDrop) => {
    onMove?.(d, moveNode(nodes, d));
    announce(fill(labels.dropped, { name: nameOf(d.id) }), { source: treeRef.current ?? undefined });
    pendingFocus.current = d.id;
  };
  const onMoveRef = useLatest({ allowed, drop, nameOf, labels });
  useEffect(() => {
    const tree = treeRef.current;
    if (!draggable || !tree) return;
    return bindTreeDrag(tree, {
      canDrop: (d) => onMoveRef.current.allowed(d),
      onDrop: (d) => onMoveRef.current.drop(d),
      onStart: (id) => announce(fill(onMoveRef.current.labels.grabbed, { name: onMoveRef.current.nameOf(id) }), { source: tree }),
      onCancel: () => announce(onMoveRef.current.labels.cancelled, { source: tree }),
    });
  }, [draggable, onMoveRef]);

  const onGrabKey = (event: KeyboardEvent<HTMLUListElement>): boolean => {
    if (!grab) return false;
    const mod = event.ctrlKey || event.metaKey;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const at = Math.max(0, Math.min(slots.length - 1, grab.at + (event.key === "ArrowDown" ? 1 : -1)));
      setGrab({ ...grab, at });
      const next = slots[at];
      if (next) announce(slotText(next), { source: event.currentTarget });
    } else if (event.key === "Enter" || (mod && event.key.toLowerCase() === "v")) {
      if (slot) drop(slot);
      setGrab(null);
    } else if (event.key === "Escape") {
      setGrab(null);
      announce(labels.cancelled, { source: event.currentTarget });
    } else if (event.key !== "Tab") return true;
    else {
      setGrab(null);
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    // El campo de renombrar atiende sus propias teclas.
    if ((event.target as HTMLElement).tagName === "INPUT") return;
    if (onGrabKey(event)) return;
    const at = rowIndex.get(tabStop ?? "") ?? -1;
    const row = rows[at];
    if (!row) return;
    const hasChildren = branch(row.node);
    const isOpen = open.has(row.node.id);
    let handled = true;
    // En RTL la flecha que apunta hacia el final de la línea (izquierda) expande.
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const key = rtl && event.key === "ArrowLeft" ? "ArrowRight" : rtl && event.key === "ArrowRight" ? "ArrowLeft" : event.key;
    const mod = event.ctrlKey || event.metaKey;
    if (multiple && mod && !event.altKey && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setPicked(enabledIds(rows.map((r) => r.node.id)));
      return;
    }
    // Coger el nodo para moverlo con el teclado.
    if (draggable && mod && !event.altKey && event.key.toLowerCase() === "x" && !row.node.disabled) {
      event.preventDefault();
      const list = rows.map((r) => ({ id: r.node.id, level: r.level, last: r.pos === r.size, disabled: r.node.disabled }));
      const options = dropSlots(list, nodes, row.node.id).filter(allowed);
      // Empieza en «delante de» la fila siguiente a la suya (o en el primero que haya).
      const nextRow = rows.slice(at + 1).find((r) => options.some((o) => o.target === r.node.id));
      const start = Math.max(
        0,
        options.findIndex((o) => o.target === nextRow?.node.id),
      );
      setGrab({ id: row.node.id, at: start });
      announce(fill(labels.grabbed, { name: nameOf(row.node.id) }), { source: event.currentTarget });
      return;
    }
    if (event.altKey || mod) return;
    const move = (target: Row | undefined) => {
      if (!target) return;
      // Sin Mayús, el nodo al que se llega es el ancla del próximo rango; con Mayús, el rango va del ancla a él.
      if (multiple && event.shiftKey) anchor.current ??= row.node.id;
      focus(target.node.id);
      if (multiple && event.shiftKey) extendTo(target.node);
      else anchor.current = target.node.id;
    };
    const page = Math.max(1, Math.floor((treeRef.current?.clientHeight ?? 320) / 32) - 1);
    switch (key) {
      case "ArrowDown":
        move(rows[at + 1]);
        break;
      case "ArrowUp":
        move(rows[at - 1]);
        break;
      case "PageDown":
        move(rows[Math.min(rows.length - 1, at + page)]);
        break;
      case "PageUp":
        move(rows[Math.max(0, at - page)]);
        break;
      case "Home":
        move(rows[0]);
        break;
      case "End":
        move(rows[rows.length - 1]);
        break;
      case "ArrowRight":
        if (hasChildren && !isOpen) expand(row.node, true);
        else if (hasChildren) focus(rows[at + 1]?.node.id);
        break;
      case "ArrowLeft":
        if (hasChildren && isOpen) expand(row.node, false);
        else focus(row.parent);
        break;
      case "F2":
        if (renamable && !row.node.disabled) setRenaming(row.node.id);
        else handled = false;
        break;
      case "Enter":
        activate(row.node);
        break;
      case " ":
        // Espacio: marca la casilla; en selección múltiple alterna la selección; si no, activa.
        if (checkable) toggleChecked(row.node);
        else if (multiple) togglePicked(row.node);
        else activate(row.node);
        break;
      default: {
        // Letra: salta al siguiente nodo visible cuyo nombre empieza por ella (APG treeview; igual que el modo DOM).
        handled = false;
        if (event.key.length !== 1) break;
        const letter = event.key.toLowerCase();
        const name = (r: Row) => textOf(r.node, refs.current.get(r.node.id)).toLowerCase();
        const next = [...rows.slice(at + 1), ...rows.slice(0, at)].find((r) => name(r).startsWith(letter));
        if (next) {
          focus(next.node.id);
          handled = true;
        }
      }
    }
    if (handled) event.preventDefault();
  };

  const onRowClick = (event: MouseEvent<HTMLDivElement>, node: TreeNode) => {
    focus(node.id);
    if ((event.target as HTMLElement).closest(".z-tree__check")) {
      toggleChecked(node);
      return;
    }
    if (multiple && (event.ctrlKey || event.metaKey)) togglePicked(node);
    else if (multiple && event.shiftKey) extendTo(node);
    else activate(node);
  };

  const item = (row: Row, children: ReactNode) => {
    const { node, level } = row;
    const hasChildren = branch(node);
    const isOpen = hasChildren && open.has(node.id);
    const indent = { "--z-tree-level": level - 1 } as CSSProperties;
    const check = states.get(node.id) ?? "false";
    const editing = renaming === node.id;
    const busy = loading.has(node.id);
    const labelEl = refs.current.get(node.id)?.querySelector(":scope > .z-tree__row .z-tree__label");
    const dropHere = slot && slot.target === node.id ? slot.position : undefined;
    return (
      <li
        key={node.id}
        ref={(el) => {
          if (el) refs.current.set(node.id, el);
          else refs.current.delete(node.id);
        }}
        role="treeitem"
        className="z-tree__item"
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-selected={isSelected(node.id)}
        aria-checked={checkable ? check : undefined}
        aria-disabled={node.disabled || undefined}
        aria-busy={busy || undefined}
        aria-level={level}
        aria-setsize={row.size}
        aria-posinset={row.pos}
        tabIndex={node.id === tabStop ? 0 : -1}
        data-value={node.id}
        data-grabbed={grab?.id === node.id ? "" : undefined}
        onFocus={(event) => {
          if (event.target === event.currentTarget) setFocused(node.id);
        }}
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: la fila es la zona de puntero del treeitem que la contiene, que es quien tiene el rol y el foco. */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: el teclado lo atiende el árbol (flechas, Intro y Espacio sobre el treeitem enfocado). */}
        <div
          className="z-tree__row"
          style={indent}
          data-drop={dropHere}
          onClick={(event) => {
            if (!editing) onRowClick(event, node);
          }}
          onDoubleClick={(event) => {
            if (renamable && !node.disabled && (event.target as HTMLElement).closest(".z-tree__label")) setRenaming(node.id);
          }}
        >
          <span className="z-tree__toggle" data-state={isOpen ? "open" : "closed"} data-loading={busy || undefined} aria-hidden="true">
            {busy ? <span className="z-tree__spinner" /> : hasChildren ? <Icon name="chevron-right" size={12} /> : null}
          </span>
          {checkable ? (
            <span
              className="z-check__box z-tree__check"
              data-state={check === "true" ? "checked" : check === "mixed" ? "indeterminate" : "unchecked"}
              aria-hidden="true"
            >
              <span className="z-check__mark" />
            </span>
          ) : null}
          {node.icon ? (
            <span className="z-tree__icon">
              <Icon name={node.icon} size={14} />
            </span>
          ) : null}
          {editing ? (
            <input
              className="z-tree__rename"
              aria-label={renameLabel}
              defaultValue={labelEl?.textContent ?? (typeof node.label === "string" ? node.label : "")}
              // biome-ignore lint/a11y/noAutofocus: el campo aparece por F2 o doble clic: el foco tiene que ir a él.
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitRename(node, event.currentTarget.value, true);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  commitRename(node, "", false);
                }
                event.stopPropagation();
              }}
              onBlur={(event) => commitRename(node, event.currentTarget.value, true)}
            />
          ) : (
            <span className="z-tree__label">{node.label}</span>
          )}
        </div>
        {children}
      </li>
    );
  };

  // Anidado (por defecto): cada rama con su grupo. En plano (ventana virtual): solo las filas de la ventana.
  const nested = (list: TreeNode[], level: number, parent: string | null): ReactNode =>
    list.map((node, i) => {
      const isOpen = branch(node) && open.has(node.id);
      return item(
        { node, level, parent, pos: i + 1, size: list.length },
        isOpen && node.children ? (
          <ul role="group" className="z-tree__group">
            {nested(node.children, level + 1, node.id)}
          </ul>
        ) : null,
      );
    });

  return (
    <ul
      ref={treeRef}
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: patrón APG «tree view»: la lista conserva su estructura y role="tree" le da la semántica y el teclado.
      role="tree"
      aria-label={label}
      aria-multiselectable={multiple || undefined}
      className={cx("z-tree", className)}
      data-checkable={checkable || undefined}
      data-renamable={renamable || undefined}
      data-draggable={draggable || undefined}
      data-grabbing={grab ? "" : undefined}
      data-virtual={win.virtual || undefined}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        // El arrastre con teclado termina si el foco sale del árbol.
        if (grab && !event.currentTarget.contains(event.relatedTarget as Node | null)) setGrab(null);
      }}
    >
      {win.virtual ? (
        <>
          {win.before > 0 ? (
            <li className="z-virtual-spacer" aria-hidden="true" style={{ "--z-virtual-space": `${win.before}px` } as CSSProperties} />
          ) : null}
          {win.indices.map((i) => (rows[i] ? item(rows[i]!, null) : null))}
          {win.after > 0 ? (
            <li className="z-virtual-spacer" aria-hidden="true" style={{ "--z-virtual-space": `${win.after}px` } as CSSProperties} />
          ) : null}
        </>
      ) : (
        nested(nodes, 1, null)
      )}
    </ul>
  );
}
