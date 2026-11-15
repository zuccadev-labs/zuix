"use client";
import type { ReactNode } from "react";
import { Accordion as RadixAccordion } from "radix-ui";
import { Icon, type IconName } from "@zuccadev-labs/zuix-zicon/core";
import { cx } from "../../cx";

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

function Items({ items, headingLevel }: { items: AccordionItem[]; headingLevel: number }) {
  return (
    <>
      {items.map((item) => (
        <RadixAccordion.Item key={item.value} value={item.value} disabled={item.disabled} className="z-accordion__item">
          <RadixAccordion.Header className="z-accordion__header" aria-level={headingLevel}>
            <RadixAccordion.Trigger className="z-accordion__trigger">
              {item.icon ? <Icon name={item.icon} size={16} /> : null}
              <span className="z-accordion__title">{item.title}</span>
              <span className="z-accordion__chevron">
                <Icon name="chevron-down" size={14} />
              </span>
            </RadixAccordion.Trigger>
          </RadixAccordion.Header>
          <RadixAccordion.Content className="z-accordion__content">
            <div className="z-accordion__body">{item.content}</div>
          </RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </>
  );
}

export function Accordion({ items, type = "single", value, defaultValue, onValueChange, headingLevel = 3, className }: AccordionProps) {
  const cls = cx("z-accordion", className);
  if (type === "multiple") {
    return (
      <RadixAccordion.Root type="multiple" className={cls} value={value} defaultValue={defaultValue} onValueChange={onValueChange}>
        <Items items={items} headingLevel={headingLevel} />
      </RadixAccordion.Root>
    );
  }
  return (
    <RadixAccordion.Root
      type="single"
      collapsible
      className={cls}
      value={value === undefined ? undefined : (value[0] ?? "")}
      defaultValue={defaultValue?.[0]}
      onValueChange={(next) => onValueChange?.(next ? [next] : [])}
    >
      <Items items={items} headingLevel={headingLevel} />
    </RadixAccordion.Root>
  );
}
