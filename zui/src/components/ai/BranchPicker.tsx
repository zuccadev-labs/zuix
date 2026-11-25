"use client";
import type { Ref } from "react";
import { branchPickerWidget, type BranchPickerProps as CoreProps } from "../../core/ai-widgets";
import { useWidget } from "../agenda/vtree";
import { withRef } from "../../react-compat";

export interface BranchPickerProps extends CoreProps {
  onChange?: (detail: { index: number }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/** «‹ 2 / 3 ›»: versiones de un mensaje editado o regenerado (el árbol lo lleva core/branches). */
export const BranchPicker = withRef(function BranchPicker({ onChange, id, className, ref, ...props }: BranchPickerProps) {
  return useWidget(branchPickerWidget, props, { id, className, ref, handlers: { change: onChange } });
});
