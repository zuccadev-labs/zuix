import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import "@zuccadev-labs/zuix-zicon/all";
import "./app.css";

import { ToastProvider } from "@zuccadev-labs/zuix-zui";
import { App } from "./App";
import { Audit } from "./screens/audit/Audit";
import { AuditSsr } from "./screens/audit/AuditSsr";
import { Layers } from "./screens/audit/Layers";
import { AgendaScreen } from "./screens/Agenda";
import { PIECES, PlanningPieces, type PieceId } from "./screens/Planning";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

// Pantallas de auditoría: fuera del Shell, sin pestaña ni entrada en la navegación (?screen=audit, ?screen=audit-ssr,
// ?screen=layers).
const params = new URLSearchParams(window.location.search);
const screen = params.get("screen");
if (screen === "audit" || screen === "audit-ssr" || screen === "layers" || screen === "agenda-stage" || screen === "planning-stage") {
  document.documentElement.dataset.theme = params.get("theme") === "light" ? "light" : "dark";
  document.documentElement.dataset.brand = params.get("brand") === "zutool" ? "zutool" : "dazlabs";
}
// ?dir=rtl: cualquier pantalla (también el Shell) de derecha a izquierda.
if (params.get("dir") === "rtl") document.documentElement.dir = "rtl";

createRoot(root).render(
  <StrictMode>
    {screen === "audit" ? (
      <Audit />
    ) : screen === "audit-ssr" ? (
      <AuditSsr />
    ) : screen === "layers" ? (
      <Layers />
    ) : screen === "planning-stage" ? (
      // Piezas de planificación a todo el ancho (?piece=gantt…): las que se comparan con el prototipo.
      <main className="z-root app-stage">
        <PlanningPieces only={(PIECES as string[]).includes(params.get("piece") ?? "") ? (params.get("piece") as PieceId) : null} />
      </main>
    ) : screen === "agenda-stage" ? (
      // Agenda a todo el ancho, sin el Shell: la que se compara con el prototipo.
      <main className="z-root app-stage">
        <AgendaScreen bare />
      </main>
    ) : (
      <ToastProvider>
        <App />
      </ToastProvider>
    )}
  </StrictMode>,
);
