"use client";
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { checkStates, rangeIds, toggleCheck, type CheckState } from "../../core/tree";
import { cx } from "../../cx";

export interface TreeNode {
  id: string;
  label: ReactNode;
  icon?: IconName;
  disabled?: boolean;
  children?: TreeNode[];
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
  className?: string;
}

interface Row {
  node: TreeNode;
  level: number;
  parent: string | null;
}

export function Tree({
  nodes,
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
  className,
}: TreeProps) {
  const multiple = selectionMode === "multiple";
  const [ownExpanded, setOwnExpanded] = useState<string[]>(defaultExpanded ?? []);
  const [ownSelected, setOwnSelected] = useState<string | null>(defaultSelected);
  const [ownSelectedIds, setOwnSelectedIds] = useState<string[]>(defaultSelectedIds ?? []);
  const [ownChecked, setOwnChecked] = useState<string[]>(defaultChecked ?? []);
  const [focused, setFocused] = useState<string | null>(null);
  const [renaming, setRenamingState] = useState<string | null>(null);
  const renamingRef = useRef<string | null>(null);
  const setRenaming = (id: string | null) => {
    renamingRef.current = id;
    setRenamingState(id);
  };
  const anchor = useRef<string | null>(null);
  const refs = useRef(new Map<string, HTMLLIElement>());

  const open = useMemo(() => new Set(expanded ?? ownExpanded), [expanded, ownExpanded]);
  const current = selected === undefined ? ownSelected : selected;
  const picked = useMemo(() => new Set(selectedIds ?? ownSelectedIds), [selectedIds, ownSelectedIds]);
  const checkedIds = checked ?? ownChecked;
  const states = useMemo(
    () => (checkable ? checkStates(nodes, checkedIds) : new Map<string, CheckState>()),
    [checkable, nodes, checkedIds],
  );
  const isSelected = (id: string) => (multiple ? picked.has(id) : current === id);

  // Filas visibles en orden, para moverse con el teclado.
  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (list: TreeNode[], level: number, parent: string | null) => {
      for (const node of list) {
        out.push({ node, level, parent });
        if (node.children?.length && open.has(node.id)) walk(node.children, level + 1, node.id);
      }
    };
    walk(nodes, 1, null);
    return out;
  }, [nodes, open]);

  // Foco itinerante: el enfocado, si sigue visible; si no, el seleccionado o el primero.
  const tabStop = rows.find((r) => r.node.id === focused)?.node.id ?? rows.find((r) => isSelected(r.node.id))?.node.id ?? rows[0]?.node.id;

  const setOpen = (id: string, next: boolean) => {
    const ids = new Set(open);
    if (next) ids.add(id);
    else ids.delete(id);
    const list = [...ids];
    if (expanded === undefined) setOwnExpanded(list);
    onExpandedChange?.(list);
  };
  const focus = (id: string | undefined | null) => {
    if (!id) return;
    setFocused(id);
    refs.current.get(id)?.focus();
  };
  const setPicked = (ids: string[]) => {
    if (selectedIds === undefined) setOwnSelectedIds(ids);
    onSelectedChange?.(ids);
  };
  const enabledIds = (ids: string[]) => ids.filter((id) => !rows.find((r) => r.node.id === id)?.node.disabled);
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
    if (node.children?.length) setOpen(node.id, !open.has(node.id));
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

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    // El campo de renombrar atiende sus propias teclas.
    if ((event.target as HTMLElement).tagName === "INPUT") return;
    const at = rows.findIndex((r) => r.node.id === tabStop);
    const row = rows[at];
    if (!row) return;
    const hasChildren = Boolean(row.node.children?.length);
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
    if (event.altKey || mod) return;
    const move = (target: Row | undefined) => {
      if (!target) return;
      // Sin Mayús, el nodo al que se llega es el ancla del próximo rango; con Mayús, el rango va del ancla a él.
      if (multiple && event.shiftKey) anchor.current ??= row.node.id;
      focus(target.node.id);
      if (multiple && event.shiftKey) extendTo(target.node);
      else anchor.current = target.node.id;
    };
    switch (key) {
      case "ArrowDown":
        move(rows[at + 1]);
        break;
      case "ArrowUp":
        move(rows[at - 1]);
        break;
      case "Home":
        move(rows[0]);
        break;
      case "End":
        move(rows[rows.length - 1]);
        break;
      case "ArrowRight":
        if (hasChildren && !isOpen) setOpen(row.node.id, true);
        else if (hasChildren) focus(rows[at + 1]?.node.id);
        break;
      case "ArrowLeft":
        if (hasChildren && isOpen) setOpen(row.node.id, false);
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
        const name = (id: string) =>
          (refs.current.get(id)?.querySelector(":scope > .z-tree__row .z-tree__label")?.textContent ?? "").trim().toLowerCase();
        const next = [...rows.slice(at + 1), ...rows.slice(0, at)].find((r) => name(r.node.id).startsWith(letter));
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

  const render = (list: TreeNode[], level: number): ReactNode =>
    list.map((node, i) => {
      const hasChildren = Boolean(node.children?.length);
      const isOpen = hasChildren && open.has(node.id);
      const indent = { "--z-tree-level": level - 1 } as CSSProperties;
      const check = states.get(node.id) ?? "false";
      const editing = renaming === node.id;
      const labelEl = refs.current.get(node.id)?.querySelector(":scope > .z-tree__row .z-tree__label");
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
          aria-level={level}
          aria-setsize={list.length}
          aria-posinset={i + 1}
          tabIndex={node.id === tabStop ? 0 : -1}
          data-value={node.id}
          onFocus={(event) => {
            if (event.target === event.currentTarget) setFocused(node.id);
          }}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: la fila es la zona de puntero del treeitem que la contiene, que es quien tiene el rol y el foco. */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: el teclado lo atiende el árbol (flechas, Intro y Espacio sobre el treeitem enfocado). */}
          <div
            className="z-tree__row"
            style={indent}
            onClick={(event) => {
              if (!editing) onRowClick(event, node);
            }}
            onDoubleClick={(event) => {
              if (renamable && !node.disabled && (event.target as HTMLElement).closest(".z-tree__label")) setRenaming(node.id);
            }}
          >
            <span className="z-tree__toggle" data-state={isOpen ? "open" : "closed"} aria-hidden="true">
              {hasChildren ? <Icon name="chevron-right" size={12} /> : null}
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
          {isOpen && node.children ? (
            <ul role="group" className="z-tree__group">
              {render(node.children, level + 1)}
            </ul>
          ) : null}
        </li>
      );
    });

  return (
    <ul
      // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: patrón APG «tree view»: la lista conserva su estructura y role="tree" le da la semántica y el teclado.
      role="tree"
      aria-label={label}
      aria-multiselectable={multiple || undefined}
      className={cx("z-tree", className)}
      data-checkable={checkable || undefined}
      data-renamable={renamable || undefined}
      onKeyDown={onKeyDown}
    >
      {render(nodes, 1)}
    </ul>
  );
}
