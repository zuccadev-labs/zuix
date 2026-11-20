"use client";
// Contexto de Toolbar: dentro de una barra, los controles compuestos (ToggleGroup) dejan el foco itinerante a la barra.
import { createContext, useContext } from "react";

/** Orientación de la barra que envuelve al componente, o null fuera de una barra. */
export const ToolbarContext = createContext<"horizontal" | "vertical" | null>(null);
export const useInToolbar = () => useContext(ToolbarContext) !== null;
