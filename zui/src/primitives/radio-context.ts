"use client";
// Estado que un `RadioGroup` comparte con sus `Radio`.
import { createContext } from "react";

export interface RadioGroupState {
  value: string;
  select: (value: string) => void;
  reset: () => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  /** Valor de la opción que recibe el foco con Tab: la elegida o, si no hay, la primera habilitada. */
  tabStop: string | null;
}

export const RadioGroupContext = createContext<RadioGroupState | null>(null);
