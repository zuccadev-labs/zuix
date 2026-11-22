import type { MouseEventHandler, ReactNode } from "react";
import { cx } from "../../cx";
import { IconButton } from "../actions/IconButton";
import { Avatar, type AvatarStatus } from "../data/Avatar";

export interface ChatHeaderProps {
  title: ReactNode;
  /** Imagen del contacto o del grupo. */
  avatar?: string;
  /** Nombre para las iniciales del avatar (por defecto, `title` si es texto). */
  avatarName?: string;
  presence?: AvatarStatus;
  /** Nombre accesible del punto de presencia («Online»). */
  presenceLabel?: string;
  /** Línea de estado: «online», «last seen 5 min ago», «Ana is typing…», «4 members». */
  status?: ReactNode;
  /** `accent` para «typing…» y «online». */
  statusTone?: "muted" | "accent";
  /** Botón de volver (en móvil, a la lista). */
  onBack?: MouseEventHandler<HTMLButtonElement>;
  /** Nombre del botón de volver: dice adónde vuelve («Back to chats»). */
  backLabel?: string;
  /** Acciones (llamada, vídeo, buscar, menú): IconButton. */
  actions?: ReactNode;
  /** Nivel del título (2 por defecto). */
  level?: 2 | 3;
  /** Id del título, para nombrar la conversación con `aria-labelledby`. */
  titleId?: string;
  /** La cabecera es un botón que abre los detalles (perfil). */
  onTitleClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
}

/**
 * Cabecera de una conversación: volver (en móvil), avatar con presencia, nombre, línea de estado y acciones.
 */
export function ChatHeader({
  title,
  avatar,
  avatarName,
  presence,
  presenceLabel,
  status,
  statusTone = "muted",
  onBack,
  backLabel = "Back",
  actions,
  level = 2,
  titleId,
  onTitleClick,
  className,
}: ChatHeaderProps) {
  const Heading = level === 3 ? "h3" : "h2";
  const name = avatarName ?? (typeof title === "string" ? title : undefined);
  const identity = (
    <>
      <Avatar src={avatar} name={name} size="md" status={presence} statusLabel={presenceLabel} />
      <span className="z-chat-header__titles">
        <Heading className="z-chat-header__title" id={titleId}>
          {title}
        </Heading>
        {status ? (
          <span className="z-chat-header__status" data-tone={statusTone === "accent" ? "accent" : undefined}>
            {status}
          </span>
        ) : null}
      </span>
    </>
  );
  return (
    <header className={cx("z-chat-header", className)}>
      {onBack ? <IconButton icon="chevron-left" label={backLabel} className="z-chat-header__back" onClick={onBack} /> : null}
      {onTitleClick ? (
        <button type="button" className="z-chat-header__identity" onClick={onTitleClick}>
          {identity}
        </button>
      ) : (
        <span className="z-chat-header__identity">{identity}</span>
      )}
      {actions ? <span className="z-chat-header__actions">{actions}</span> : null}
    </header>
  );
}
