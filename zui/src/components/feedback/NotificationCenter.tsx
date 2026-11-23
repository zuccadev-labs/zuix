"use client";
import type { Ref } from "react";
import {
  NOTIFICATION_CENTER_LABELS,
  notificationCenterWidget,
  type NotificationAction,
  type NotificationCenterLabels,
  type NotificationCenterProps as CoreProps,
  type NotificationItem,
} from "../../core/notification-center-widget";
import { useWidget } from "../agenda/vtree";

export { NOTIFICATION_CENTER_LABELS };
export type { NotificationAction, NotificationCenterLabels, NotificationItem };

export interface NotificationCenterProps extends CoreProps {
  /** Un aviso se marcó como leído o no leído desde la vista. Actualiza `read` en `notifications`. */
  onReadChange?: (detail: { id: string; read: boolean }) => void;
  /** «Mark all as read»: ids de los que estaban sin leer. */
  onReadAll?: (detail: { ids: string[] }) => void;
  /** Botón de una acción propia de un aviso. */
  onAction?: (detail: { id: string; action: string }) => void;
  /** El panel se abrió o se cerró. */
  onOpenChange?: (detail: { open: boolean }) => void;
  id?: string;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Centro de avisos: campana con el número de no leídos y un panel con los avisos agrupados por día, leídos y no
 * leídos, acciones por aviso, «Mark all as read» y estado vacío. Los avisos nuevos se anuncian una vez.
 */
export function NotificationCenter({
  onReadChange,
  onReadAll,
  onAction,
  onOpenChange,
  id,
  className,
  ref,
  ...props
}: NotificationCenterProps) {
  return useWidget(notificationCenterWidget, props, {
    id,
    className,
    ref,
    handlers: {
      "read-change": onReadChange,
      "read-all": onReadAll,
      action: onAction,
      "open-change": onOpenChange,
    } as Record<string, ((detail: never) => void) | undefined>,
  });
}
