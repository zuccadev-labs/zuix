"use client";
// Estado que un `CheckboxGroup` comparte con sus `Checkbox` (por `value`).
import { createContext } from "react";

export interface CheckboxGroupState {
  value: ReadonlyArray<string>;
  toggle: (value: string, checked: boolean) => void;
  reset: () => void;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  variant?: "default" | "card";
}

export const CheckboxGroupContext = createContext<CheckboxGroupState | null>(null);
