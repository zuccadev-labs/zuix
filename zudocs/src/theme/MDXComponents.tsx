// Componentes disponibles en cualquier .mdx sin importarlos.
import { translate } from "@docusaurus/Translate";
import MDXComponents from "@theme-original/MDXComponents";
import type { ComponentProps } from "react";
import { Icon } from "@zuccadev-labs/zuix-zicon/core";
import { Alert, Badge, Button, Callout, Card, CardHeader, Carousel, Kbd, Panel, StatTile, Stepper, Tabs } from "@zuccadev-labs/zuix-zui";
import { Grid, Inline, Stack } from "@zuccadev-labs/zuix-zout";

// Las casillas de una lista de tareas (`- [ ]`) llegan sin nombre accesible: un lector de pantalla solo
// diría "casilla, no disponible". Se les pone su estado como nombre.
function TaskCheckbox(props: ComponentProps<"input">) {
  if (props.type !== "checkbox") return <input {...props} />;
  const label = props.checked
    ? translate({ id: "zudocs.task.done", message: "Hecho", description: "Accessible name of a checked task list item" })
    : translate({ id: "zudocs.task.pending", message: "Pendiente", description: "Accessible name of an unchecked task list item" });
  return <input {...props} aria-label={label} />;
}

export default { ...MDXComponents, input: TaskCheckbox, Icon, Alert, Badge, Button, Callout, Card, CardHeader, Carousel, Kbd, Panel, StatTile, Stepper, Tabs, Grid, Inline, Stack };
