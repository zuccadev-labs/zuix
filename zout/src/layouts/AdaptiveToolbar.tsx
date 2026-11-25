"use client";
import { useRef } from "react";
import type { IconName } from "@zuccadev-labs/zuix-zicon/core";
import { Button, IconButton, Menu, Toolbar } from "@zuccadev-labs/zuix-zui";
import { cx } from "../cx";
import { SIZE_CLASS_NAMES, resolveAdaptive, splitOverflow, type AdaptiveMap, type SizeClass } from "../adaptive";
import type { MeasureMode } from "../adaptive-runtime";
import { useMeasuredSizeClass } from "./size-class";

export interface AdaptiveToolbarAction {
  id: string;
  label: string;
  icon: IconName;
  onSelect?: () => void;
  disabled?: boolean;
  /** Muestra el texto junto al icono en la barra. */
  showLabel?: boolean;
  /** Ajustes por clase: `variant: "menu"` la pasa al menú de desbordamiento; `hidden`, a ninguno. */
  adaptive?: AdaptiveMap;
}

export interface AdaptiveToolbarProps {
  actions: AdaptiveToolbarAction[];
  /** Nombre accesible de la barra. */
  label: string;
  /** Nombre del botón del menú de desbordamiento. Por defecto, "More actions". */
  moreLabel?: string;
  variant?: "glass" | "plain";
  size?: "sm" | "md";
  measure?: MeasureMode;
  className?: string;
}

/** Clases en que una acción cumple `test`, separadas por espacios. */
function classesWhere(action: AdaptiveToolbarAction, test: (variant: string | undefined, hidden: boolean) => boolean): string | undefined {
  const list = SIZE_CLASS_NAMES.filter((cls) => {
    const s = resolveAdaptive(action.adaptive, cls);
    return test(s.variant, s.hidden === true);
  });
  return list.length ? list.join(" ") : undefined;
}

/**
 * Barra de herramientas que pasa acciones a un menú «más» según la clase de tamaño (ajuste `variant: "menu"` de cada
 * acción). Es su propio contenedor de consulta. Antes de medir, la hoja oculta lo que va al menú en la clase activa;
 * medida, la barra solo contiene lo que se ve y el menú, el resto, en el orden de las acciones.
 */
export function AdaptiveToolbar({
  actions,
  label,
  moreLabel = "More actions",
  variant = "glass",
  size = "md",
  measure,
  className,
}: AdaptiveToolbarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useMeasuredSizeClass(ref, measure);
  const cls: SizeClass | null = state?.sizeClass ?? null;
  const split = cls ? splitOverflow(actions, cls) : { bar: actions, menu: [] as AdaptiveToolbarAction[] };
  const moreIn = SIZE_CLASS_NAMES.filter((c) => splitOverflow(actions, c).menu.length > 0);
  const showMore = cls ? split.menu.length > 0 : moreIn.length > 0;
  return (
    <div
      ref={ref}
      className={cx("z-adaptive-toolbar", className)}
      data-measure={measure === "window" ? "window" : undefined}
      data-measured={cls ? "" : undefined}
    >
      <Toolbar label={label} variant={variant} size={size}>
        {split.bar.map((action) => {
          const off = cls ? undefined : classesWhere(action, (v, hidden) => hidden || v === "menu");
          return action.showLabel ? (
            <Button
              key={action.id}
              icon={action.icon}
              size={size}
              variant="ghost"
              disabled={action.disabled}
              onClick={action.onSelect}
              data-menu-in={off}
            >
              {action.label}
            </Button>
          ) : (
            <IconButton
              key={action.id}
              icon={action.icon}
              label={action.label}
              size={size}
              disabled={action.disabled}
              onClick={action.onSelect}
              data-menu-in={off}
            />
          );
        })}
        {showMore ? (
          <Menu
            trigger={
              <IconButton
                className="z-adaptive-toolbar__more"
                icon="ellipsis-horizontal"
                label={moreLabel}
                size={size}
                data-more-in={cls ? undefined : moreIn.join(" ")}
              />
            }
            items={split.menu.map((action) => ({
              id: action.id,
              label: action.label,
              icon: action.icon,
              disabled: action.disabled,
              onSelect: action.onSelect,
            }))}
          />
        ) : null}
      </Toolbar>
    </div>
  );
}
