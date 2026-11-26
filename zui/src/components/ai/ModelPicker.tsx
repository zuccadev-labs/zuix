"use client";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { useControllable } from "../../primitives/hooks";
import { cx } from "../../cx";
import { Menu } from "../overlay/Menu";
import type { MenuEntry } from "../overlay/internal";

export interface ModelPickerModel {
  id: string;
  label: string;
  icon?: IconName;
  /** Marca del modelo (la aporta la aplicación); decorativa. */
  media?: ReactNode;
  /** Etiqueta corta («Beta», «Soon»). */
  badge?: string;
  disabled?: boolean;
}

export interface ModelPickerToggle {
  id: string;
  label: string;
  icon?: IconName;
  checked: boolean;
}

export interface ModelPickerLabels {
  /** Nombre del botón para lectores: «Model: {model}». */
  trigger: string;
  options: string;
  models: string;
  more: string;
}

const LABELS: ModelPickerLabels = { trigger: "Model: {model}", options: "Options", models: "Models", more: "More models" };

export interface ModelPickerProps {
  models: readonly ModelPickerModel[];
  /** Modelos de un submenú («More models»). */
  more?: readonly ModelPickerModel[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Interruptores encima de la lista (Auto, varios modelos). */
  options?: readonly ModelPickerToggle[];
  /** Interruptores al pie, tras un separador (chat temporal). */
  toggles?: readonly ModelPickerToggle[];
  /** Encender o apagar un interruptor de `options` o `toggles`. */
  onToggle?: (detail: { id: string; checked: boolean }) => void;
  size?: "sm" | "md";
  labels?: Partial<ModelPickerLabels>;
  className?: string;
}

/**
 * Selector de modelo como menú (patrón APG «menu button»): interruptores de opciones, modelos con su marca y etiqueta
 * (Beta, Soon), la marca del elegido al final, submenú «More models» y un interruptor al pie. Rectangular, no píldora.
 */
export function ModelPicker({
  models,
  more,
  value: valueProp,
  defaultValue,
  onValueChange,
  options,
  toggles,
  onToggle,
  size = "sm",
  labels: labelsProp,
  className,
}: ModelPickerProps) {
  const labels = { ...LABELS, ...labelsProp };
  const [value, setValue] = useControllable(valueProp, defaultValue ?? models[0]?.id ?? "", onValueChange);
  const all = [...models, ...(more ?? [])];
  const current = all.find((m) => m.id === value) ?? models[0];
  const radio = (list: readonly ModelPickerModel[], id: string, label: string): MenuEntry => ({
    type: "radio-group",
    id,
    label,
    value,
    indicator: "end",
    onValueChange: setValue,
    items: list.map((m) => ({ value: m.id, label: m.label, icon: m.icon, media: m.media, badge: m.badge, disabled: m.disabled })),
  });
  const toggle = (t: ModelPickerToggle): MenuEntry => ({
    type: "checkbox",
    id: t.id,
    label: t.label,
    icon: t.icon,
    checked: t.checked,
    appearance: "switch",
    onCheckedChange: (checked) => onToggle?.({ id: t.id, checked }),
  });
  const items: MenuEntry[] = [
    ...(options?.length ? [{ type: "label" as const, label: labels.options }, ...options.map(toggle), { type: "separator" as const }] : []),
    radio(models, "models", labels.models),
    ...(more?.length ? [{ id: "more", label: labels.more, items: [radio(more, "more-models", labels.more)] }] : []),
    ...(toggles?.length ? [{ type: "separator" as const }, ...toggles.map(toggle)] : []),
  ];
  return (
    <Menu
      size="lg"
      align="start"
      side="bottom"
      items={items}
      className="z-model-picker__menu"
      trigger={
        <button
          type="button"
          className={cx("z-btn z-btn--ghost z-model-picker", className)}
          data-size={size}
          aria-label={labels.trigger.replace("{model}", current?.label ?? "")}
        >
          {current?.media ? (
            <span className="z-model-picker__media" aria-hidden="true">
              {current.media}
            </span>
          ) : current?.icon ? (
            <Icon name={current.icon} size={16} />
          ) : null}
          <span className="z-model-picker__label">{current?.label}</span>
          {current?.badge ? <span className="z-model-picker__badge">{current.badge}</span> : null}
          <Icon name="chevron-up-down" size={14} />
        </button>
      }
    />
  );
}
