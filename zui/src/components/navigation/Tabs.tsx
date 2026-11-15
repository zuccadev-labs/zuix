"use client";
import type { ReactNode } from "react";
import { Tabs as RadixTabs } from "radix-ui";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

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

export function Tabs({ items, value, defaultValue, onValueChange, variant = "segmented", size = "md", orientation = "horizontal", label, className, children }: TabsProps) {
  const initial = value === undefined ? (defaultValue ?? items[0]?.value) : undefined;
  return (
    <RadixTabs.Root className={cx("z-tabs", className)} value={value} defaultValue={initial} onValueChange={onValueChange} orientation={orientation}>
      <RadixTabs.List className="z-tabs__list" data-variant={variant} data-size={size} aria-label={label}>
        {items.map((item) => (
          <RadixTabs.Trigger key={item.value} value={item.value} disabled={item.disabled} className="z-tabs__tab">
            {item.icon ? <Icon name={item.icon} size={size === "sm" ? 14 : 16} /> : null}
            <span className="z-tabs__label">{item.label}</span>
            {item.badge}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) =>
        item.content === undefined ? null : (
          <RadixTabs.Content key={item.value} value={item.value} className="z-tabs__panel">
            {item.content}
          </RadixTabs.Content>
        ),
      )}
      {children}
    </RadixTabs.Root>
  );
}

export interface TabPanelProps {
  value: string;
  /** Mantiene el panel montado aunque esté oculto. */
  keepMounted?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Panel asociado a una pestaña; se usa como hijo de `Tabs`. */
export function TabPanel({ value, keepMounted, className, children }: TabPanelProps) {
  return (
    <RadixTabs.Content value={value} forceMount={keepMounted || undefined} className={cx("z-tabs__panel", className)}>
      {children}
    </RadixTabs.Content>
  );
}
