"use client";
// Capa ligera que se abre por interés (puntero o foco) y no atrapa el foco: la base de HoverCard y Toggletip.
// Lógica en ../core/interest (retardos, zonas, Tab entre disparador y capa); colocación con ./popup.
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import { focusQuiet, nextTabbable, tabbable } from "../core/focus";
import { bridgeTab, createInterest, type Interest, type InterestSource } from "../core/interest";
import type { Placement } from "../core/place";
import { cx } from "../cx";
import { useControllable, useLatest, useLayer, usePresence } from "./hooks";
import { Popup, Portal, rectOf } from "./popup";
import { slot } from "./slot";

export interface InterestLayerProps {
  /** `hover`: se abre al pasar o enfocar (HoverCard). `toggle`: además, el clic la fija abierta (Toggletip). */
  mode: "hover" | "toggle";
  trigger: ReactElement;
  children?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  openDelay: number;
  closeDelay: number;
  disabled?: boolean;
  placement: Placement;
  gap: number;
  arrow?: boolean;
  width?: number | string;
  className: string;
}

export function InterestLayer({
  mode,
  trigger: triggerProp,
  children,
  open: openProp,
  defaultOpen,
  onOpenChange,
  openDelay,
  closeDelay,
  disabled,
  placement,
  gap,
  arrow,
  width,
  className,
}: InterestLayerProps) {
  const id = useId();
  const [open, setOpen] = useControllable(openProp, defaultOpen ?? false, onOpenChange);
  // Fijada con un clic (Toggletip): no se cierra al salir el puntero o el foco, solo con otro clic, Escape o fuera.
  const [pinned, setPinned] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const present = usePresence(open, content);
  const latest = useLatest({ setOpen, pinned, disabled });
  const [interest] = useState<Interest>(() =>
    createInterest({
      openDelay,
      closeDelay,
      onChange: (next) => {
        if (!next && latest.current.pinned) return;
        latest.current.setOpen(next);
      },
    }),
  );
  interest.setDelays(openDelay, closeDelay);
  useEffect(() => () => interest.dispose(), [interest]);
  // Un cierre desde fuera (controlado) olvida las zonas y deja de estar fijada.
  useEffect(() => {
    if (open) return;
    setPinned(false);
    if (interest.isOpen()) interest.hide();
  }, [open, interest]);

  const enter = (source: InterestSource) => {
    if (!latest.current.disabled) interest.enter(source);
  };
  const leave = (source: InterestSource) => interest.leave(source);
  const close = (refocus: boolean) => {
    const inside = content.current?.contains(document.activeElement) ?? false;
    setPinned(false);
    interest.hide();
    setOpen(false);
    if (refocus && inside) focusQuiet(trigger.current);
  };

  useLayer(open, {
    contains: (target) => (content.current?.contains(target) ?? false) || (trigger.current?.contains(target) ?? false),
    onEscape: () => close(true),
    onPointerOutside: () => close(false),
  });

  // Tab entre el disparador y la capa (montada en otro punto del documento): el orden sigue al visual.
  const onTab = (event: KeyboardEvent) => {
    if (event.key !== "Tab" || !open || !trigger.current || !content.current) return;
    const target = bridgeTab(document.activeElement, event.shiftKey, {
      trigger: trigger.current,
      content: content.current,
      tabbables: tabbable(content.current),
      after: () => {
        const next = trigger.current ? nextTabbable(trigger.current) : undefined;
        return next && content.current?.contains(next) ? undefined : next;
      },
    });
    if (!target) return;
    event.preventDefault();
    if (target.close) close(false);
    focusQuiet(target.focus);
  };

  const describedBy = (triggerProp.props as { "aria-describedby"?: string })["aria-describedby"];
  const host = slot(triggerProp, {
    ref: trigger,
    // HoverCard: el disparador (un enlace) hace otra cosa al activarse, así que la capa lo describe y no lleva
    // aria-expanded. Toggletip: el botón solo la muestra, así que lleva aria-expanded y no la descripción.
    ...(mode === "hover"
      ? { "aria-describedby": present ? [describedBy, id].filter(Boolean).join(" ") : describedBy }
      : { "aria-expanded": open, "aria-controls": present ? id : undefined }),
    "data-state": open ? "open" : "closed",
    onPointerEnter: (event: { pointerType: string }) => {
      if (event.pointerType !== "touch") enter("trigger-pointer");
    },
    onPointerLeave: () => leave("trigger-pointer"),
    onFocus: (event: { currentTarget: Element }) => {
      if (event.currentTarget.matches(":focus-visible")) enter("trigger-focus");
    },
    onBlur: () => leave("trigger-focus"),
    onKeyDown: onTab,
    ...(mode === "toggle"
      ? {
          onClick: () => {
            if (latest.current.disabled) return;
            if (pinned && open) return close(false);
            setPinned(true);
            interest.show();
            setOpen(true);
          },
        }
      : {}),
  });

  const style: CSSProperties | undefined = width === undefined ? undefined : { width };
  return (
    <>
      {host}
      {present ? (
        <Portal anchor={trigger}>
          <Popup
            ref={content}
            id={id}
            open={open}
            anchorRect={() => rectOf(trigger.current)}
            watch={trigger}
            placement={placement}
            gap={gap + (arrow ? 7 : 0)}
            role="tooltip"
            className={cx("z-liquid", className)}
            data-arrow={arrow || undefined}
            style={style}
            onPointerEnter={() => enter("content-pointer")}
            onPointerLeave={() => leave("content-pointer")}
            onFocus={() => enter("content-focus")}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) leave("content-focus");
            }}
            onKeyDown={onTab}
          >
            {children}
          </Popup>
        </Portal>
      ) : null}
    </>
  );
}
