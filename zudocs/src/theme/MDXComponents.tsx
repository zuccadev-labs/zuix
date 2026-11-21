// Componentes disponibles en cualquier .mdx sin importarlos.
import { translate } from "@docusaurus/Translate";
import MDXComponents from "@theme-original/MDXComponents";
import { type ComponentProps, useEffect, useRef } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { Alert, Badge, Button, Callout, Card, CardHeader, Carousel, Kbd, Panel, StatTile, Stepper, Tabs } from "@zuccadev-labs/zuix-zui";
import { Grid, Inline, Stack } from "@zuccadev-labs/zuix-zout";
import { DocMeta } from "../components/DocMeta";
import { PackageInstall } from "../components/PackageInstall";

// Las casillas de una lista de tareas (`- [ ]`) llegan sin nombre accesible: un lector de pantalla solo
// diría "casilla, no disponible". Se les pone su estado como nombre.
function TaskCheckbox(props: ComponentProps<"input">) {
  if (props.type !== "checkbox") return <input {...props} />;
  const label = props.checked
    ? translate({ id: "zudocs.task.done", message: "Hecho", description: "Accessible name of a checked task list item" })
    : translate({ id: "zudocs.task.pending", message: "Pendiente", description: "Accessible name of an unchecked task list item" });
  return <input {...props} aria-label={label} />;
}

/**
 * Marca en `data-scroll-edges` el lado del marco con contenido oculto ("start", "end" o los dos); la hoja de zui lo
 * difumina, así se ve que la tabla sigue. Holgura de 8 px, como en las tiras de zui.
 */
function useScrollEdges() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const hidden = el.scrollWidth - el.clientWidth;
      const at = Math.abs(el.scrollLeft);
      const value = hidden <= 8 ? "" : [at > 8 ? "start" : "", at < hidden - 8 ? "end" : ""].filter(Boolean).join(" ");
      if (value) el.setAttribute("data-scroll-edges", value);
      else el.removeAttribute("data-scroll-edges");
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, []);
  return ref;
}

// Una tabla ancha se desplaza dentro de su marco, que es enfocable para poder desplazarla con el teclado.
function Table(props: ComponentProps<"table">) {
  const ref = useScrollEdges();
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: región desplazable; sin foco no se podría recorrer con el teclado
    <div ref={ref} className="zd-table" role="region" aria-label="Tabla" tabIndex={0}>
      <table {...props} />
    </div>
  );
}

export default {
  ...MDXComponents,
  input: TaskCheckbox,
  table: Table,
  DocMeta,
  PackageInstall,
  Icon,
  Alert,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  Carousel,
  Kbd,
  Panel,
  StatTile,
  Stepper,
  Tabs,
  Grid,
  Inline,
  Stack,
};
