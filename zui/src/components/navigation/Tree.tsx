"use client";
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
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
  /** Id seleccionado (controlado). */
  selected?: string | null;
  defaultSelected?: string | null;
  onSelect?: (id: string, node: TreeNode) => void;
  className?: string;
}

interface Row {
  node: TreeNode;
  level: number;
  parent: string | null;
}

export function Tree({ nodes, label, expanded, defaultExpanded, onExpandedChange, selected, defaultSelected = null, onSelect, className }: TreeProps) {
  const [ownExpanded, setOwnExpanded] = useState<string[]>(defaultExpanded ?? []);
  const [ownSelected, setOwnSelected] = useState<string | null>(defaultSelected);
  const [focused, setFocused] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLLIElement>());

  const open = useMemo(() => new Set(expanded ?? ownExpanded), [expanded, ownExpanded]);
  const current = selected === undefined ? ownSelected : selected;

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
  const tabStop = rows.find((r) => r.node.id === focused)?.node.id ?? rows.find((r) => r.node.id === current)?.node.id ?? rows[0]?.node.id;

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
  const select = (node: TreeNode) => {
    if (node.disabled) return;
    if (selected === undefined) setOwnSelected(node.id);
    onSelect?.(node.id, node);
  };
  const activate = (node: TreeNode) => {
    if (node.disabled) return;
    if (node.children?.length) setOpen(node.id, !open.has(node.id));
    select(node);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const at = rows.findIndex((r) => r.node.id === tabStop);
    const row = rows[at];
    if (!row) return;
    const hasChildren = Boolean(row.node.children?.length);
    const isOpen = open.has(row.node.id);
    let handled = true;
    // En RTL la flecha que apunta hacia el final de la línea (izquierda) expande.
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const key = rtl && event.key === "ArrowLeft" ? "ArrowRight" : rtl && event.key === "ArrowRight" ? "ArrowLeft" : event.key;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    switch (key) {
      case "ArrowDown":
        focus(rows[at + 1]?.node.id);
        break;
      case "ArrowUp":
        focus(rows[at - 1]?.node.id);
        break;
      case "Home":
        focus(rows[0]?.node.id);
        break;
      case "End":
        focus(rows[rows.length - 1]?.node.id);
        break;
      case "ArrowRight":
        if (hasChildren && !isOpen) setOpen(row.node.id, true);
        else if (hasChildren) focus(rows[at + 1]?.node.id);
        break;
      case "ArrowLeft":
        if (hasChildren && isOpen) setOpen(row.node.id, false);
        else focus(row.parent);
        break;
      case "Enter":
      case " ":
        activate(row.node);
        break;
      default: {
        // Letra: salta al siguiente nodo visible cuyo nombre empieza por ella (APG treeview; igual que el modo DOM).
        handled = false;
        if (event.key.length !== 1) break;
        const letter = event.key.toLowerCase();
        const name = (id: string) => (refs.current.get(id)?.querySelector(":scope > .z-tree__row .z-tree__label")?.textContent ?? "").trim().toLowerCase();
        const next = [...rows.slice(at + 1), ...rows.slice(0, at)].find((r) => name(r.node.id).startsWith(letter));
        if (next) {
          focus(next.node.id);
          handled = true;
        }
      }
    }
    if (handled) event.preventDefault();
  };

  const render = (list: TreeNode[], level: number): ReactNode =>
    list.map((node, i) => {
      const hasChildren = Boolean(node.children?.length);
      const isOpen = hasChildren && open.has(node.id);
      const indent = { "--z-tree-level": level - 1 } as CSSProperties;
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
          aria-selected={current === node.id}
          aria-disabled={node.disabled || undefined}
          aria-level={level}
          aria-setsize={list.length}
          aria-posinset={i + 1}
          tabIndex={node.id === tabStop ? 0 : -1}
          onFocus={(event) => {
            if (event.target === event.currentTarget) setFocused(node.id);
          }}
        >
          <div
            className="z-tree__row"
            style={indent}
            onClick={() => {
              focus(node.id);
              activate(node);
            }}
          >
            <span className="z-tree__toggle" data-state={isOpen ? "open" : "closed"} aria-hidden="true">
              {hasChildren ? <Icon name="chevron-right" size={12} /> : null}
            </span>
            {node.icon ? (
              <span className="z-tree__icon">
                <Icon name={node.icon} size={14} />
              </span>
            ) : null}
            <span className="z-tree__label">{node.label}</span>
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
    <ul role="tree" aria-label={label} className={cx("z-tree", className)} onKeyDown={onKeyDown}>
      {render(nodes, 1)}
    </ul>
  );
}
