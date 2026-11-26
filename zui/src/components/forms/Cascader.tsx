"use client";
import type { Ref } from "react";
import { cascaderWidget, type CascaderLabels, type CascaderOption, type CascaderProps as CoreProps } from "../../core/cascader-widget";
import type { ShowStrategy } from "../../core/tree-select";
import { useWidget } from "../agenda/vtree";
import { useFieldControl, useFieldLabel } from "./Field";
import { withRef } from "../../react-compat";

export type { CascaderLabels, CascaderOption, ShowStrategy };

type Base = Omit<CoreProps, "controlId" | "describedBy" | "labelledBy" | "ariaLabel" | "value" | "defaultValue" | "multiple">;

interface CascaderCommon extends Base {
  /** Hijos cargados de una ruta (`loadChildren`). */
  onLoad?: (detail: { path: string[]; options: CascaderOption[] }) => void;
  /** Una carga de `loadChildren` falló: la opción queda como hoja. */
  onLoadError?: (detail: { path: string[]; error: unknown }) => void;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export interface CascaderSingleProps extends CascaderCommon {
  multiple?: false;
  /** Ruta elegida (`["es", "madrid", "alcala"]`); vacía o null sin selección. */
  value?: ReadonlyArray<string> | null;
  defaultValue?: ReadonlyArray<string> | null;
  /** Ruta nueva, sus etiquetas y la opción final. */
  onValueChange?: (value: string[], detail: { labels: string[]; option: CascaderOption | null }) => void;
}

export interface CascaderMultipleProps extends CascaderCommon {
  /** Casillas con estado mixto en cascada; el valor es una lista de rutas. */
  multiple: true;
  value?: ReadonlyArray<ReadonlyArray<string>>;
  defaultValue?: ReadonlyArray<ReadonlyArray<string>>;
  onValueChange?: (value: string[][], detail: { labels: string[][] }) => void;
}

export type CascaderProps = CascaderSingleProps | CascaderMultipleProps;

/**
 * Selección jerárquica por columnas (país › región › ciudad), con carga diferida de hijos, búsqueda por la ruta
 * completa, `changeOnSelect` y selección múltiple con casillas. Patrón combobox: el foco se queda en el campo.
 */
export const Cascader = withRef(function Cascader({
  onValueChange,
  onLoad,
  onLoadError,
  id,
  invalid,
  required,
  "aria-label": ariaLabel,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  className,
  ref,
  ...props
}: CascaderProps) {
  const field = useFieldControl({ id, invalid, required, "aria-describedby": describedBy });
  const fieldLabel = useFieldLabel();
  return useWidget(
    cascaderWidget,
    {
      ...props,
      invalid: field.invalid,
      required: field.required,
      controlId: field.id,
      describedBy: field["aria-describedby"],
      labelledBy: labelledBy ?? (ariaLabel ? undefined : fieldLabel),
      ariaLabel,
    },
    {
      className,
      ref,
      handlers: {
        change: onValueChange
          ? (detail: { value: never; labels: never; option?: CascaderOption | null }) =>
              (onValueChange as (value: unknown, detail: unknown) => void)(
                detail.value,
                props.multiple ? { labels: detail.labels } : { labels: detail.labels, option: detail.option ?? null },
              )
          : undefined,
        load: onLoad,
        loaderror: onLoadError,
      },
    },
  );
});
