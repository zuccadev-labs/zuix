"use client";
import { cloneElement, type ReactElement, type Ref, useEffect, useRef, useState } from "react";
import { bindPortPanel, type PortPanelProps as CoreProps, portPanelTree } from "../../core/port-panel";
import { cx } from "../../cx";
import { useLatest } from "../../primitives/hooks";
import { withRef } from "../../react-compat";
import { toReact } from "../vnode";

export type { PanelPort, PanelVlan, PortConnector, PortPanelLabels, PortState } from "../../core/port-panel";

export interface PortPanelProps extends Omit<CoreProps, "active"> {
  /** Puerto elegido (con Intro, Espacio o un clic). */
  onSelectedChange?: (id: string) => void;
  className?: string;
  id?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Cara de un equipo de red: conectores RJ45, SFP, QSFP o coaxial numerados con su estado, marcas de VLAN (alta = sin
 * etiquetar, cortas = etiquetadas) y destino. Lista de opciones horizontal con foco itinerante; cada puerto se anuncia
 * entero. Dentro de un NodeCanvas, cada conector es el ancla de las aristas de su puerto (`anchor: true` en el nodo).
 */
export const PortPanel = withRef(function PortPanel({ onSelectedChange, className, id, ref, ...props }: PortPanelProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<string | undefined>(undefined);
  const select = useLatest(onSelectedChange);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    return bindPortPanel(el, { onSelect: (port) => select.current?.(port), onActive: setActive });
  }, [select]);
  const el = toReact(portPanelTree({ ...props, active })) as ReactElement<{ className?: string; id?: string; ref?: unknown }>;
  return cloneElement(el, {
    id,
    className: cx((el.props as { className?: string }).className, className),
    ref: (node: HTMLDivElement | null) => {
      root.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLDivElement | null }).current = node;
    },
  });
});
