import type { ReactNode } from "react";
import { cx } from "../cx";

export interface MailLayoutProps {
  /** Carpetas (NavList con contadores). */
  folders?: ReactNode;
  foldersLabel?: string;
  /** Lista de mensajes. */
  list: ReactNode;
  listLabel?: string;
  /** Mensaje abierto. */
  reader?: ReactNode;
  readerLabel?: string;
  /** Qué panel se ve en estrecho: la lista o el mensaje (la aplicación lo cambia al abrir y al volver). */
  view?: "list" | "reader";
  className?: string;
}

/**
 * Correo: carpetas, lista y lectura. Ancho: tres columnas; medio: lista y lectura con las carpetas arriba; estrecho:
 * una sola vista (lista o mensaje) según `view`, con la vuelta que ponga la aplicación en el mensaje.
 */
export function MailLayout({
  folders,
  foldersLabel = "Folders",
  list,
  listLabel = "Messages",
  reader,
  readerLabel = "Message",
  view = "list",
  className,
}: MailLayoutProps) {
  return (
    <div className={cx("z-mail-layout", className)} data-view={view} data-folders={folders ? "" : undefined}>
      <div className="z-mail-layout__grid">
        {folders ? (
          <nav className="z-mail-layout__folders" aria-label={foldersLabel}>
            {folders}
          </nav>
        ) : null}
        <section className="z-mail-layout__list z-liquid" aria-label={listLabel}>
          {list}
        </section>
        <section className="z-mail-layout__reader z-solid" aria-label={readerLabel}>
          {reader}
        </section>
      </div>
    </div>
  );
}
