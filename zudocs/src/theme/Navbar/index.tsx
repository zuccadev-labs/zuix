// Barra superior flotante: dos barras de cristal. Izquierda: marca y secciones. Derecha: búsqueda (⌘K),
// repositorio, tema y llamada a la acción. En pantallas estrechas las secciones pasan al cajón de navegación.
import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";
import { useColorMode } from "@docusaurus/theme-common";
import useBaseUrl from "@docusaurus/useBaseUrl";
import useIsBrowser from "@docusaurus/useIsBrowser";
import ThemedImage from "@theme/ThemedImage";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { Drawer } from "@zuccadev-labs/zuix-zui";
import { useEffect } from "react";
import { useChrome } from "../../components/Chrome";
import { SearchPalette } from "../../components/SearchPalette";
import { clean, SiteNav } from "../../components/SiteNav";
import { useZudocs } from "../../site";

function NavLink({ to, children }: { to: string; children: string }) {
  const href = clean(useBaseUrl(to));
  const path = clean(useLocation().pathname);
  const active = path === href || path.startsWith(`${href}/`);
  return (
    // `navbar__link--active`: el buscador local lo lee como primera miga de cada resultado.
    <Link className={active ? "zd-nav__link navbar__link--active" : "zd-nav__link"} to={to} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}

function ThemeToggle() {
  const { colorMode, setColorMode } = useColorMode();
  // Antes de hidratar, el tema guardado no se conoce en React: el nombre se escribe al montar y el icono lo
  // elige el CSS por el atributo data-theme, que el script inicial ya ha puesto.
  const ready = useIsBrowser();
  const next = colorMode === "dark" ? "light" : "dark";
  const label = !ready ? "Cambiar de tema" : next === "light" ? "Cambiar a tema claro" : "Cambiar a tema oscuro";
  return (
    <button
      type="button"
      className="z-btn z-btn--ghost zd-icon-btn zd-theme-toggle"
      data-size="sm"
      aria-label={label}
      title={label}
      onClick={() => setColorMode(next)}
    >
      <Icon name="moon" size={16} className="zd-theme-toggle__dark" />
      <Icon name="sun" size={16} className="zd-theme-toggle__light" />
    </button>
  );
}

export default function Navbar() {
  const site = useZudocs();
  const { navOpen, setNavOpen, searchOpen, setSearchOpen } = useChrome();
  const logo = useBaseUrl(site.logo?.src ?? "");
  const logoDark = useBaseUrl(site.logo?.srcDark ?? site.logo?.src ?? "");
  const location = useLocation();
  const firstArea = site.docs.areas[0]?.id;
  const cta = site.cta ?? (firstArea ? { label: "Empezar", to: `/docs/${firstArea}` } : undefined);
  const searchEnabled = site.search?.enabled !== false;

  // Cada navegación cierra el cajón y la paleta.
  // biome-ignore lint/correctness/useExhaustiveDependencies: se reacciona al cambio de ruta
  useEffect(() => {
    setNavOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  // ⌘K / Ctrl K abre la búsqueda desde cualquier sitio; «/» también, si no se está escribiendo.
  useEffect(() => {
    if (!searchEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable='true']");
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setSearchOpen(true);
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [searchEnabled, setSearchOpen]);

  return (
    <header className="zd-nav">
      <div className="zd-container zd-nav__inner">
        <nav className="zd-nav__bar zd-glass" aria-label="Principal">
          <Link className="zd-nav__brand" to="/">
            {site.logo ? (
              <ThemedImage className="zd-nav__logo" sources={{ light: logo, dark: logoDark }} alt="" width={26} height={26} />
            ) : null}
            <span>{site.name}</span>
          </Link>
          <span className="zd-nav__links">
            {firstArea ? <NavLink to={`/docs/${firstArea}`}>Docs</NavLink> : null}
            {(site.navbar ?? [])
              .filter((n) => n.to)
              .map((n) => (
                <NavLink key={n.label} to={n.to as string}>
                  {n.label}
                </NavLink>
              ))}
            {(site.navbar ?? [])
              .filter((n) => n.href)
              .map((n) => (
                <Link key={n.label} className="zd-nav__link" href={n.href}>
                  {n.label}
                </Link>
              ))}
          </span>
        </nav>
        <div className="zd-nav__bar zd-nav__tools zd-glass">
          {searchEnabled ? (
            <button
              type="button"
              className="zd-search-button"
              aria-haspopup="dialog"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen(true)}
            >
              <Icon name="magnifying-glass" size={16} />
              <span className="zd-search-button__label">Buscar en la documentación</span>
              <span className="zd-kbd" aria-hidden="true">
                ⌘K
              </span>
            </button>
          ) : null}
          {site.repository ? (
            <>
              <span className="zd-nav__sep" aria-hidden="true" />
              <a className="zd-nav__link zd-nav__repo" href={site.repository} rel="noopener" aria-label="Repositorio en GitHub">
                <Icon name="code-bracket" size={16} />
                <span className="zd-nav__repo-label">GitHub</span>
              </a>
            </>
          ) : null}
          <ThemeToggle />
          {cta ? (
            <Link className="z-btn z-btn--primary zd-nav__cta" data-size="sm" to={cta.to}>
              {cta.label}
            </Link>
          ) : null}
          <button
            type="button"
            className="z-btn z-btn--ghost zd-icon-btn zd-nav__menu"
            data-size="sm"
            aria-label="Abrir la navegación"
            aria-haspopup="dialog"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <Icon name="bars-3" size={18} />
          </button>
        </div>
      </div>
      <Drawer
        open={navOpen}
        onOpenChange={setNavOpen}
        side="left"
        size="sm"
        title={site.name}
        label="Navegación"
        closeLabel="Cerrar la navegación"
        className="zd-drawer"
      >
        <SiteNav extraLinks />
      </Drawer>
      {searchEnabled ? <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} /> : null}
    </header>
  );
}
