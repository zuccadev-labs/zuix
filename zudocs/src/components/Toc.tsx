// Índice «En esta página» con la sección visible resaltada. Donde el navegador lo sabe hacer solo
// (`scroll-target-group` + `:target-current`, Chromium 140+) el CSS pinta el estado y aquí solo se copia a
// `aria-current` al terminar el desplazamiento; en el resto, un IntersectionObserver hace las dos cosas.
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { useEffect, useRef } from "react";

export interface TocEntry {
  id: string;
  /** HTML del título (puede llevar código en línea). Sale del propio documento, compilado en el build. */
  value: string;
  level: number;
}

function useScrollSpy(nav: React.RefObject<HTMLElement | null>, key: string) {
  useEffect(() => {
    const ids = key ? key.split("\n") : [];
    const root = nav.current;
    if (!root || !ids.length) return;
    const links = [...root.querySelectorAll<HTMLAnchorElement>("a[href^='#']")];
    const mark = (current?: Element | null) => {
      for (const a of links) {
        const on = a === current;
        a.classList.toggle("is-current", on);
        if (on) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      }
    };
    if (CSS.supports("scroll-target-group: auto")) {
      const sync = () => mark(root.querySelector("a:target-current"));
      sync();
      document.addEventListener("scrollend", sync);
      return () => document.removeEventListener("scrollend", sync);
    }
    const headings = ids.map((id) => document.getElementById(id)).filter((h): h is HTMLElement => !!h);
    const visible = new Set<Element>();
    const pick = () => {
      // La sección actual es el último título que ha cruzado la parte alta de la pantalla.
      const top = headings.filter((h) => h.getBoundingClientRect().top < window.innerHeight * 0.35).at(-1) ?? headings[0];
      mark(links.find((a) => a.hash === `#${CSS.escape(top.id)}` || decodeURIComponent(a.hash.slice(1)) === top.id));
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
        pick();
      },
      { rootMargin: "0px 0px -60% 0px" },
    );
    for (const h of headings) io.observe(h);
    pick();
    return () => io.disconnect();
  }, [nav, key]);
}

export function Toc({ toc, title = "En esta página" }: { toc: readonly TocEntry[]; title?: string }) {
  const ref = useRef<HTMLElement>(null);
  const entries = toc.filter((t) => t.level <= 3);
  const min = Math.min(...entries.map((t) => t.level));
  useScrollSpy(ref, entries.map((t) => t.id).join("\n"));
  if (!entries.length) return null;
  return (
    <nav ref={ref} className="zd-toc zd-glass" aria-labelledby="zd-toc-title">
      <p className="zd-toc__head" id="zd-toc-title">
        <Icon name="bars-3-bottom-left" size={14} />
        {title}
      </p>
      <ol className="zd-toc__list">
        {entries.map((t) => (
          <li key={t.id} data-level={t.level - min}>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: título del documento compilado en el build (como el índice original de Docusaurus) */}
            <a href={`#${t.id}`} dangerouslySetInnerHTML={{ __html: t.value }} />
          </li>
        ))}
      </ol>
    </nav>
  );
}
