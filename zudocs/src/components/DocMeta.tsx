// Línea de metadatos bajo la entradilla: fecha de la última modificación (si se conoce) y tiempo de lectura.
// La inserta scripts/remark-lead.mjs en cada documento; los datos los calcula scripts/site-plugin.mjs.
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { useSiteData } from "../site";
import { clean } from "./SiteNav";

export function DocMeta() {
  const { meta } = useSiteData();
  const { i18n } = useDocusaurusContext();
  const info = meta[clean(useLocation().pathname)];
  if (!info) return null;
  // En UTC: el servidor y el navegador escriben la misma fecha y la hidratación no cambia el texto.
  const date = info.updated
    ? new Intl.DateTimeFormat(i18n.currentLocale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(info.updated))
    : undefined;
  return (
    <p className="zd-meta">
      {date ? (
        <span>
          <Icon name="calendar" size={14} /> Actualizado el <time dateTime={info.updated}>{date}</time>
        </span>
      ) : null}
      <span>
        <Icon name="clock" size={14} /> {info.minutes} min de lectura
      </span>
    </p>
  );
}
