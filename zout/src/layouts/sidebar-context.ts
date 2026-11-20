"use client";
// Contexto de Sidebar: plegada a iconos o no, y profundidad del item (los subitems no llevan tooltip ni flyout).
import { createContext, useContext } from "react";

export interface SidebarState {
  collapsed: boolean;
  depth: number;
}

export const SidebarContext = createContext<SidebarState>({ collapsed: false, depth: 0 });
export const useSidebar = () => useContext(SidebarContext);
