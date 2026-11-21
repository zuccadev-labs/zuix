// Estado del cromo compartido por la barra superior y el artículo: el cajón de navegación (móvil) y la
// paleta de búsqueda. Lo abre la barra, la barra de migas del móvil o el atajo ⌘K / Ctrl K.
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

interface Chrome {
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}
const ChromeContext = createContext<Chrome>({ navOpen: false, setNavOpen: () => {}, searchOpen: false, setSearchOpen: () => {} });

export function ChromeProvider({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const value = useMemo(() => ({ navOpen, setNavOpen, searchOpen, setSearchOpen }), [navOpen, searchOpen]);
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

export const useChrome = () => useContext(ChromeContext);
