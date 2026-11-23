"use client";
import type { Ref } from "react";
import {
  type TransferItem,
  type TransferListLabels,
  type TransferListProps as CoreProps,
  transferListWidget,
} from "../../core/transfer-widget";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export type { TransferItem, TransferListLabels };

export interface TransferListProps extends CoreProps {
  /** Valores elegidos tras mover. */
  onValueChange?: (value: string[]) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Lista de transferencia: disponibles y elegidos, con casillas, búsqueda opcional y botones para mover lo marcado o
 * todo lo visible. Cada lista es un listbox de selección múltiple navegable con el teclado; Intro o doble clic mueven.
 */
export const TransferList = withRef(function TransferList({ onValueChange, id, className, ref, ...props }: TransferListProps) {
  return useWidget(transferListWidget, props, {
    id,
    className,
    ref,
    handlers: { change: onValueChange ? (detail: { value: string[] }) => onValueChange(detail.value) : undefined },
  });
});
