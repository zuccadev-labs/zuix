"use client";
import type { Ref } from "react";
import type { Member, Role } from "../../core/members";
import { memberListWidget, type MemberListLabels, type MemberListProps as CoreProps } from "../../core/member-list-widget";
import { useWidget } from "../agenda/vtree";

export type { Member, MemberListLabels, Role };

export interface MemberListProps extends CoreProps {
  /** Cambio de rol desde el selector de una fila. */
  onRoleChange?: (detail: { memberId: string; role: string }) => void;
  /** Botón de quitar de una fila. La fila desaparece de la vista; quítala también de `members`. */
  onRemove?: (detail: { memberId: string }) => void;
  /** Botón «Invite». */
  onInvite?: () => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Lista de miembros: búsqueda que anuncia los resultados, grupos por rol o por presencia, rol en un selector nativo,
 * quitar con nombre propio e invitar.
 */
export function MemberList({ onRoleChange, onRemove, onInvite, id, className, ref, ...props }: MemberListProps) {
  return useWidget(memberListWidget, props, {
    id,
    className,
    ref,
    handlers: { "role-change": onRoleChange, remove: onRemove, invite: onInvite as ((d: never) => void) | undefined },
  });
}
