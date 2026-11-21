"use client";
import { createContext } from "react";

/** Dentro de un Navbar: el NavigationMenu no repite el landmark y sigue la orientación del Navbar. */
export const NavbarContext = createContext<{ embedded: boolean } | null>(null);
