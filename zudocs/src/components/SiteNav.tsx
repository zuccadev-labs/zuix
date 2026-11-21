// Navegación lateral del sitio: secciones en pestañas de icono (documentación, componentes, referencia), grupos
// plegables con contador y filtro, e insignias de estado. La misma pieza va en la barra lateral pegajosa y, en
// pantallas estrechas, dentro del cajón.
import Link from "@docusaurus/Link";
import { useLocation } from "@docusaurus/router";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { SegmentedControl } from "@zuccadev-labs/zuix-zui";
import { useEffect, useMemo, useRef, useState } from "react";
import { type NavItem, useSiteData, useZudocs } from "../site";

interface Group {
  id: string;
  label: string;
  icon: IconName;
  items: NavItem[];
}
interface Section {
  id: "docs" | "components" | "reference";
  label: string;
  icon: IconName;
  /** Enlaces sueltos antes de los grupos. */
  links: NavItem[];
  groups: Group[];
}

const BADGE: Record<string, string> = { new: "nuevo", nuevo: "nuevo", updated: "actualizado", actualizado: "actualizado" };

/** Quita tildes y mayúsculas para filtrar. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Ruta sin barra final, para comparar. */
export const clean = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

export function useSections(): Section[] {
  const site = useZudocs();
  const data = useSiteData();
  return useMemo(() => {
    const out: Section[] = [];
    out.push({
      id: "docs",
      label: "Documentación",
      icon: "book",
      links: [],
      groups: data.areas.map((a) => ({ id: a.id, label: a.label, icon: a.icon ?? "document-text", items: a.items })),
    });
    if (site.pages.components && data.components.length)
      out.push({
        id: "components",
        label: "Componentes",
        icon: "squares-2x2",
        links: [{ title: "Índice de componentes", path: "/components" }],
        groups: data.groups.map((g) => ({
          id: g.id,
          label: g.label,
          icon: g.icon,
          items: data.components.filter((c) => c.group === g.id).map((c) => ({ title: c.name, path: c.path, badge: c.status })),
        })),
      });
    const reference: NavItem[] = [];
    if (site.pages.icons) reference.push({ title: "Iconos", path: "/icons" });
    if (site.pages.tokens) reference.push({ title: "Tokens", path: "/tokens" });
    if (site.pages.loaders) reference.push({ title: "Cargadores", path: "/loaders" });
    if (site.pages.effects) reference.push({ title: "Efectos", path: "/effects" });
    if (reference.length) out.push({ id: "reference", label: "Referencia", icon: "swatch", links: reference, groups: [] });
    return out;
  }, [site, data]);
}

/** Sección a la que pertenece una ruta. */
function sectionOf(sections: Section[], path: string, base: string): Section["id"] {
  const rel = `/${path.slice(base.length)}`;
  if (/^\/components(\/|$)/.test(rel) && sections.some((s) => s.id === "components")) return "components";
  if (/^\/(icons|tokens|loaders|effects)(\/|$)/.test(rel) && sections.some((s) => s.id === "reference")) return "reference";
  return "docs";
}

function ItemLink({ item, current }: { item: NavItem; current: string }) {
  const href = useBaseUrl(item.path);
  const active = clean(href) === current;
  const badge = item.badge ? (BADGE[item.badge] ?? item.badge) : undefined;
  return (
    <li>
      <Link className="zd-nav-item" to={item.path} aria-current={active ? "page" : undefined}>
        <span className="zd-nav-item__label">{item.title}</span>
        {badge ? <span className="zd-badge">{badge}</span> : null}
      </Link>
    </li>
  );
}

function NavGroup({ group, current, base, initiallyOpen }: { group: Group; current: string; base: string; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (initiallyOpen) setOpen(true);
  }, [initiallyOpen]);
  const shown = query ? group.items.filter((i) => fold(i.title).includes(fold(query))) : group.items;
  const withBase = (p: string) => clean(p.startsWith(base) ? p : `${base}${p.replace(/^\//, "")}`);
  const containsCurrent = group.items.some((i) => withBase(i.path) === current);
  return (
    <details className="zd-nav-group" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="zd-nav-group__head" data-current={containsCurrent || undefined}>
        <Icon name={group.icon} size={16} className="zd-nav-group__icon" />
        <span className="zd-nav-group__label">{group.label}</span>
        <span className="zd-count">{group.items.length}</span>
        <Icon name="chevron-right" size={14} className="zd-nav-group__chevron" />
      </summary>
      {group.items.length >= 8 ? (
        <label className="zd-filter">
          <Icon name="funnel" size={14} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filtrar ${group.items.length} en ${group.label}`}
            aria-label={`Filtrar ${group.label}`}
          />
        </label>
      ) : null}
      <ul className="zd-nav-group__items">
        {shown.map((i) => (
          <ItemLink key={i.path} item={i} current={current} />
        ))}
        {query && !shown.length ? <li className="zd-nav-empty">Sin resultados</li> : null}
      </ul>
    </details>
  );
}

export function SiteNav({ extraLinks }: { extraLinks?: boolean }) {
  const sections = useSections();
  const site = useZudocs();
  const base = useBaseUrl("/");
  const current = clean(useLocation().pathname);
  const here = sectionOf(sections, current, base);
  const [tab, setTab] = useState<Section["id"]>(here);
  useEffect(() => setTab(here), [here]);
  const section = sections.find((s) => s.id === tab) ?? sections[0];
  const withBase = (p: string) => clean(p.startsWith(base) ? p : `${base}${p.replace(/^\//, "")}`);
  const openId = section.groups.find((g) => g.items.some((i) => withBase(i.path) === current))?.id;
  // La página actual se ve entera en la barra lateral: si cae fuera de su área con desplazamiento (al final de una
  // lista larga), se centra ahí, sin mover la página.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = scrollRef.current;
    const item = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !item || !current || tab !== here) return;
    const b = box.getBoundingClientRect();
    const r = item.getBoundingClientRect();
    if (r.top < b.top || r.bottom > b.bottom) box.scrollTop += r.top - b.top - (b.height - r.height) / 2;
  }, [current, tab, here]);
  return (
    <div className="zd-sitenav">
      {sections.length > 1 ? (
        <SegmentedControl
          className="zd-sitenav__tabs"
          label="Sección"
          fullWidth
          value={section.id}
          onValueChange={(v) => setTab(v as Section["id"])}
          items={sections.map((s) => ({ value: s.id, label: null, icon: s.icon, ariaLabel: s.label }))}
        />
      ) : null}
      <p className="zd-sitenav__title">{section.label}</p>
      <div className="zd-sitenav__scroll" ref={scrollRef}>
        {section.links.length ? (
          <ul className="zd-nav-links">
            {section.links.map((i) => (
              <ItemLink key={i.path} item={i} current={current} />
            ))}
          </ul>
        ) : null}
        {section.groups.map((g, n) => (
          <NavGroup
            key={`${section.id}-${g.id}`}
            group={g}
            current={current}
            base={base}
            initiallyOpen={g.id === openId || (!openId && n === 0 && section.id === here)}
          />
        ))}
        {extraLinks && site.navbar?.some((n) => n.href) ? (
          <ul className="zd-nav-links zd-nav-links--extra">
            {site.navbar
              .filter((n) => n.href)
              .map((n) => (
                <li key={n.label}>
                  <Link className="zd-nav-item" href={n.href}>
                    <span className="zd-nav-item__label">{n.label}</span>
                    <Icon name="arrow-up-right" size={14} />
                  </Link>
                </li>
              ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
