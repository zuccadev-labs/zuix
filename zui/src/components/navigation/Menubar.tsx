"use client";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { logicalKey } from "../../core/dir";
import { menubarIndex, menubarKey } from "../../core/menubar";
import { cx } from "../../cx";
import { MenuSurface } from "../../primitives/menu";
import type { MenuEntry } from "../overlay/internal";

export interface MenubarMenu {
  id: string;
  /** Título visible en la barra («File», «Edit»). */
  label: string;
  items: MenuEntry[];
  disabled?: boolean;
}

export interface MenubarProps {
  menus: MenubarMenu[];
  /** Nombre accesible de la barra («Application»). */
  label: string;
  /** `glass`: barra de cromo propia. `plain`: sin fondo, dentro de una TitleBar o una Toolbar. */
  variant?: "glass" | "plain";
  size?: "sm" | "md";
  className?: string;
}

/**
 * Barra de menús de aplicación (patrón APG «menubar»): una sola parada de tabulación; las flechas laterales recorren
 * los títulos (en RTL la izquierda avanza) y, con un menú abierto, pasan al vecino; Flecha abajo, Intro o Espacio
 * abren y enfocan la primera entrada, Flecha arriba la última. Con un menú abierto, pasar el puntero por otro título
 * lo abre. Cada menú es el Menu de la suite: submenús, casillas, radios, búsqueda por letra y Escape.
 */
export function Menubar({ menus, label, variant = "glass", size = "sm", className }: MenubarProps) {
  const id = useId();
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const [openId, setOpenId] = useState<string | null>(null);
  const [focus, setFocus] = useState<"first" | "last">("first");
  // Parada de tabulación: el último título usado (o el primero habilitado).
  const usable = menus.filter((menu) => !menu.disabled);
  const [stop, setStop] = useState<string | null>(null);
  const tabStop = (usable.find((menu) => menu.id === stop) ?? usable[0])?.id;

  const focusTrigger = (menuId: string) => {
    setStop(menuId);
    triggers.current.get(menuId)?.focus();
  };
  const open = (menuId: string, at: "first" | "last" = "first") => {
    setFocus(at);
    setStop(menuId);
    setOpenId(menuId);
  };
  /** Título vecino; con un menú abierto, abre el suyo. */
  const step = (from: string, to: "prev" | "next" | "first" | "last", reopen: boolean) => {
    const index = menubarIndex(
      to,
      usable.findIndex((menu) => menu.id === from),
      usable.length,
    );
    const target = usable[index];
    if (!target) return;
    if (reopen) open(target.id);
    else focusTrigger(target.id);
  };

  const onTriggerKey = (menu: MenubarMenu, event: KeyboardEvent<HTMLButtonElement>) => {
    const action = menubarKey(logicalKey(event.key, event.currentTarget), { at: "trigger" });
    if (!action) return;
    event.preventDefault();
    if (action.type === "open") open(menu.id, action.focus);
    else step(menu.id, action.to, openId !== null);
  };

  return (
    <div
      role="menubar"
      aria-label={label}
      aria-orientation="horizontal"
      className={cx("z-menubar", variant === "glass" && "z-liquid", className)}
      data-variant={variant}
      data-size={size}
      data-open={openId !== null || undefined}
    >
      {menus.map((menu) => {
        const expanded = openId === menu.id;
        const menuId = `${id}-${menu.id}`;
        return (
          <MenubarEntry
            key={menu.id}
            menu={menu}
            menuId={menuId}
            expanded={expanded}
            tabStop={menu.id === tabStop}
            size={size}
            focus={focus}
            register={(el) => {
              if (el) triggers.current.set(menu.id, el);
              else triggers.current.delete(menu.id);
            }}
            onToggle={() => (expanded ? setOpenId(null) : open(menu.id))}
            onHover={() => {
              // Con otro menú abierto, el puntero cambia de menú; sin ninguno, no hace nada.
              if (openId !== null && openId !== menu.id && !menu.disabled) open(menu.id);
            }}
            onKeyDown={(event) => onTriggerKey(menu, event)}
            onClose={() => setOpenId((current) => (current === menu.id ? null : current))}
            onStep={(to) => step(menu.id, to, true)}
          />
        );
      })}
    </div>
  );
}

interface MenubarEntryProps {
  menu: MenubarMenu;
  menuId: string;
  expanded: boolean;
  tabStop: boolean;
  size: "sm" | "md";
  focus: "first" | "last";
  register: (el: HTMLButtonElement | null) => void;
  onToggle: () => void;
  onHover: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onClose: () => void;
  onStep: (to: "prev" | "next") => void;
}

function MenubarEntry({
  menu,
  menuId,
  expanded,
  tabStop,
  size,
  focus,
  register,
  onToggle,
  onHover,
  onKeyDown,
  onClose,
  onStep,
}: MenubarEntryProps) {
  const trigger = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        ref={(el) => {
          trigger.current = el;
          register(el);
        }}
        type="button"
        role="menuitem"
        id={`${menuId}-trigger`}
        className="z-menubar__trigger"
        aria-haspopup="menu"
        aria-expanded={expanded}
        aria-controls={expanded ? menuId : undefined}
        aria-disabled={menu.disabled || undefined}
        data-state={expanded ? "open" : "closed"}
        tabIndex={tabStop ? 0 : -1}
        onClick={() => {
          if (!menu.disabled) onToggle();
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") onHover();
        }}
        onKeyDown={(event) => {
          if (menu.disabled && event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End")
            return;
          onKeyDown(event);
        }}
      >
        {menu.label}
      </button>
      <MenuSurface
        id={menuId}
        open={expanded}
        onClose={onClose}
        items={menu.items}
        size={size === "md" ? "lg" : "md"}
        anchor={trigger}
        anchorIsTrigger
        placement="bottom-start"
        labelledBy={`${menuId}-trigger`}
        initialFocus={focus}
        onMenubarStep={onStep}
      />
    </>
  );
}
