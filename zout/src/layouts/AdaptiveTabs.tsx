"use client";
import { useState, type ReactNode } from "react";
import type { IconName } from "@zuccadev-labs/zuix-zicon/core";
import { NativeSelect, Tabs } from "@zuccadev-labs/zuix-zui";
import { cx } from "../cx";
import type { AdaptiveMap } from "../adaptive";
import type { MeasureMode } from "../adaptive-runtime";
import { AdaptiveSwitch } from "./AdaptiveSwitch";
import { BottomNavigation } from "./BottomNavigation";

export interface AdaptiveTabItem {
  value: string;
  /** Texto de la pestaña, de la opción del select y del destino de la barra inferior. */
  label: string;
  /** Necesario para la variante `bottom-nav`. */
  icon?: IconName;
  badge?: ReactNode;
  disabled?: boolean;
  content: ReactNode;
}

export interface AdaptiveTabsProps {
  items: AdaptiveTabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Nombre accesible de la navegación (lista de pestañas, select o barra). */
  label: string;
  /**
   * Variante por clase: `tabs`, `select` o `bottom-nav` (también `bottom-navigation`). Por defecto, `select` en compacto y `tabs` desde medio.
   */
  adaptive?: AdaptiveMap;
  /** Aspecto de las pestañas. */
  tabsVariant?: "segmented" | "pill" | "underline";
  measure?: MeasureMode;
  className?: string;
}

const DEFAULT_ADAPTIVE: AdaptiveMap = { compact: { variant: "select" }, medium: { variant: "tabs" } };

/**
 * Pestañas que cambian de forma con la clase de tamaño: pestañas donde caben, un `<select>` nativo o una barra inferior
 * en compacto. La selección es una sola y se conserva al cambiar de variante.
 */
export function AdaptiveTabs({
  items,
  value: valueProp,
  defaultValue,
  onValueChange,
  label,
  adaptive = DEFAULT_ADAPTIVE,
  tabsVariant,
  measure,
  className,
}: AdaptiveTabsProps) {
  const [inner, setInner] = useState(defaultValue ?? items.find((i) => !i.disabled)?.value ?? "");
  const value = valueProp ?? inner;
  const select = (next: string) => {
    if (valueProp === undefined) setInner(next);
    onValueChange?.(next);
  };
  const current = items.find((i) => i.value === value);
  const panel = (
    <div className="z-adaptive-tabs__panel" role="region" aria-label={current?.label ?? label}>
      {current?.content}
    </div>
  );
  const bottomNav = (
    <>
      {panel}
      <BottomNavigation
        position="static"
        variant="bar"
        label={label}
        value={value}
        onValueChange={select}
        items={items.filter((i) => !i.disabled).map((i) => ({ value: i.value, label: i.label, icon: i.icon ?? "squares-2x2" }))}
      />
    </>
  );
  return (
    <AdaptiveSwitch
      className={cx("z-adaptive-tabs", className)}
      adaptive={adaptive}
      fallback="tabs"
      measure={measure}
      variants={{
        tabs: (
          <Tabs
            label={label}
            variant={tabsVariant}
            value={value}
            onValueChange={select}
            items={items.map(({ value: v, label: l, icon, badge, disabled, content }) => ({
              value: v,
              label: l,
              icon,
              badge,
              disabled,
              content,
            }))}
          />
        ),
        select: (
          <>
            <NativeSelect
              className="z-adaptive-tabs__select"
              aria-label={label}
              value={value}
              onChange={(event) => select(event.currentTarget.value)}
              options={items.map((i) => ({ value: i.value, label: i.label, disabled: i.disabled }))}
            />
            {panel}
          </>
        ),
        "bottom-nav": bottomNav,
        // Nombre que usa el documento del editor visual.
        "bottom-navigation": bottomNav,
      }}
    />
  );
}
