"use client";
import { createContext, useContext, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { logicalKey } from "../../core/dir";
import { trackScrollEdges } from "../../core/edges";
import { move } from "../../core/roving";
import { cx } from "../../cx";
import { useControllable } from "../../primitives/hooks";

export interface TabItem {
  value: string;
  label: ReactNode;
  icon?: IconName;
  /** Contador o insignia tras la etiqueta. */
  badge?: ReactNode;
  disabled?: boolean;
  /** Panel de la pestaña; alternativa a usar `TabPanel` como hijo. */
  content?: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: "segmented" | "pill" | "underline";
  size?: "sm" | "md";
  orientation?: "horizontal" | "vertical";
  /** Nombre accesible de la lista de pestañas. */
  label?: string;
  className?: string;
  /** Paneles `TabPanel` adicionales. */
  children?: ReactNode;
}

const TabsContext = createContext<{ value: string | undefined; baseId: string } | null>(null);
// Un id no admite espacios: el valor de la pestaña se usa tal cual salvo ellos.
const part = (baseId: string, kind: "tab" | "panel", value: string) => `${baseId}-${kind}-${value.replace(/\s+/g, "_")}`;

/** Pestañas (patrón APG «tabs» con activación automática): las flechas mueven el foco y activan la pestaña. */
export function Tabs({
  items,
  value: valueProp,
  defaultValue,
  onValueChange,
  variant = "segmented",
  size = "md",
  orientation = "horizontal",
  label,
  className,
  children,
}: TabsProps) {
  const baseId = useId();
  const [value, setValue] = useControllable<string | undefined>(
    valueProp,
    defaultValue ?? items[0]?.value,
    onValueChange as (value: string | undefined) => void,
  );
  // Parada de tabulación: la pestaña activa o, si no hay, la primera habilitada.
  const tabStop = (items.find((item) => item.value === value && !item.disabled) ?? items.find((item) => !item.disabled))?.value;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = event.target instanceof Element ? event.target.closest<HTMLButtonElement>(".z-tabs__tab") : null;
    if (!from || from.parentElement !== event.currentTarget) return;
    const list = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(":scope > .z-tabs__tab")].filter((tab) => !tab.disabled);
    const vertical = orientation === "vertical";
    // En RTL la flecha izquierda avanza: la dirección se lee del DOM.
    const next = move(list, from, vertical ? event.key : logicalKey(event.key, from), vertical);
    if (!next) return;
    event.preventDefault();
    next.focus();
    if (next.dataset.value !== undefined) setValue(next.dataset.value);
  };

  // Tira horizontal que desplaza: el borde con pestañas ocultas se difumina (data-scroll-edges, ver la hoja).
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => (listRef.current && orientation !== "vertical" ? trackScrollEdges(listRef.current) : undefined), [orientation]);

  return (
    <div className={cx("z-tabs", className)} data-orientation={orientation}>
      <div
        ref={listRef}
        role="tablist"
        className="z-tabs__list"
        data-variant={variant}
        data-size={size}
        data-orientation={orientation}
        aria-orientation={orientation}
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={part(baseId, "tab", item.value)}
              className="z-tabs__tab"
              data-value={item.value}
              data-state={active ? "active" : "inactive"}
              data-orientation={orientation}
              data-disabled={item.disabled ? "" : undefined}
              aria-selected={active}
              aria-controls={part(baseId, "panel", item.value)}
              tabIndex={item.value === tabStop ? 0 : -1}
              disabled={item.disabled}
              onClick={() => setValue(item.value)}
            >
              {item.icon ? <Icon name={item.icon} size={size === "sm" ? 14 : 16} /> : null}
              <span className="z-tabs__label">{item.label}</span>
              {item.badge}
            </button>
          );
        })}
      </div>
      <TabsContext.Provider value={{ value, baseId }}>
        {items.map((item) =>
          item.content === undefined ? null : (
            <TabPanel key={item.value} value={item.value}>
              {item.content}
            </TabPanel>
          ),
        )}
        {children}
      </TabsContext.Provider>
    </div>
  );
}

export interface TabPanelProps {
  value: string;
  /** Mantiene el contenido montado aunque el panel esté oculto. */
  keepMounted?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Panel asociado a una pestaña; se usa como hijo de `Tabs`. */
export function TabPanel({ value, keepMounted, className, children }: TabPanelProps) {
  const tabs = useContext(TabsContext);
  if (!tabs) throw new Error("<TabPanel> must be used inside <Tabs>");
  const active = tabs.value === value;
  return (
    <div
      role="tabpanel"
      id={part(tabs.baseId, "panel", value)}
      aria-labelledby={part(tabs.baseId, "tab", value)}
      className={cx("z-tabs__panel", className)}
      data-value={value}
      data-state={active ? "active" : "inactive"}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: patrón APG «tabs»: el panel entra en el orden de tabulación.
      tabIndex={0}
      hidden={!active}
    >
      {active || keepMounted ? children : null}
    </div>
  );
}
