"use client";
// Contexto del panel del Shell que contiene a un componente: con la variante `rail` (ajustes por clase del panel), la
// Sidebar de dentro se pliega a iconos sin que la aplicación lo pida.
import { createContext, useContext } from "react";

export const ShellPanelContext = createContext<{ rail: boolean }>({ rail: false });
export const useShellPanel = () => useContext(ShellPanelContext);
