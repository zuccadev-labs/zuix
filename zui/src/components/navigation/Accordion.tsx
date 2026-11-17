"use client";
import { createElement, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { move } from "../../core/roving";
import { cx } from "../../cx";
import { useControllable, useIsoLayoutEffect, usePresence } from "../../primitives/hooks";

export interface AccordionItem {
  value: string;
  title: ReactNode;
  content: ReactNode;
  icon?: IconName;
  disabled?: boolean;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** `single`: una sección abierta a la vez; `multiple`: varias. */
  type?: "single" | "multiple";
  /** Secciones abiertas (controlado). */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Nivel del encabezado de cada sección. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const NONE: string[] = [];

/**
 * Contenido de una sección. Sigue montado al cerrar (oculto con `hidden`), y su altura se anima con
 * `--z-accordion-content-height`, que se mide al abrir y al cerrar. El primer pintado no se anima.
 */
function Content({ open, id, labelledBy, children }: { open: boolean; id: string; labelledBy: string; children: ReactNode }) {
  const node = useRef<HTMLDivElement | null>(null);
  // Animación solo a partir del primer cambio: una sección que nace abierta no se despliega al cargar.
  const [animated, setAnimated] = useState(false);
  const [last, setLast] = useState(open);
  if (last !== open) {
    setLast(open);
    setAnimated(true);
  }
  // Antes que la presencia: la altura tiene que estar medida cuando empieza la animación.
  useIsoLayoutEffect(() => {
    const el = node.current;
    if (el && animated) el.style.setProperty("--z-accordion-content-height", `${el.scrollHeight}px`);
  }, [open, animated]);
  const present = usePresence(open, node);
  return (
    <div ref={node} id={id} role="region" aria-labelledby={labelledBy} className="z-accordion__content" data-state={open ? "open" : "closed"} hidden={!present} style={animated ? undefined : { animation: "none" }}>
      <div className="z-accordion__body">{children}</div>
    </div>
  );
}

/** Acordeón (patrón APG «accordion»): cada cabecera es un botón dentro de un encabezado; las flechas, Inicio y Fin van de una a otra. */
export function Accordion({ items, type = "single", value: valueProp, defaultValue, onValueChange, headingLevel = 3, className }: AccordionProps) {
  const baseId = useId();
  const [value, setValue] = useControllable(valueProp, defaultValue ?? NONE, onValueChange);
  const open = type === "single" ? value.slice(0, 1) : value;
  const toggle = (item: string) => {
    if (open.includes(item)) setValue(open.filter((v) => v !== item));
    else setValue(type === "single" ? [item] : [...open, item]);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = event.target instanceof Element ? event.target.closest<HTMLButtonElement>(".z-accordion__trigger") : null;
    // Un acordeón anidado en una sección lleva sus propias cabeceras.
    if (!from || from.closest(".z-accordion") !== event.currentTarget) return;
    const list = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(".z-accordion__trigger")].filter((trigger) => trigger.closest(".z-accordion") === event.currentTarget && !trigger.disabled);
    const next = move(list, from, event.key, true);
    if (!next) return;
    event.preventDefault();
    next.focus();
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: el contenedor solo reparte las flechas entre sus cabeceras, que son botones.
    <div className={cx("z-accordion", className)} data-type={type} onKeyDown={onKeyDown}>
      {items.map((item) => {
        const isOpen = open.includes(item.value);
        const state = isOpen ? "open" : "closed";
        const key = item.value.replace(/\s+/g, "_");
        const triggerId = `${baseId}-${key}`;
        const contentId = `${baseId}-${key}-content`;
        return (
          <div key={item.value} className="z-accordion__item" data-state={state} data-value={item.value} data-disabled={item.disabled ? "" : undefined}>
            {createElement(
              `h${headingLevel}`,
              { className: "z-accordion__header" },
              <button type="button" id={triggerId} className="z-accordion__trigger" data-state={state} data-disabled={item.disabled ? "" : undefined} aria-expanded={isOpen} aria-controls={contentId} disabled={item.disabled} onClick={() => toggle(item.value)}>
                {item.icon ? <Icon name={item.icon} size={16} /> : null}
                <span className="z-accordion__title">{item.title}</span>
                <span className="z-accordion__chevron">
                  <Icon name="chevron-down" size={14} />
                </span>
              </button>,
            )}
            <Content open={isOpen} id={contentId} labelledBy={triggerId}>
              {item.content}
            </Content>
          </div>
        );
      })}
    </div>
  );
}
