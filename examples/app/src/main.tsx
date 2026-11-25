import { StrictMode, version } from "react";
import { createRoot } from "react-dom/client";

import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import "@zuccadev-labs/zuix-zicon/all";
import "../../fonts/fonts.css";
import "./app.css";

import { ToastProvider } from "@zuccadev-labs/zuix-zui";
import { App } from "./App";
import { Audit } from "./screens/audit/Audit";
import { AuditSsr } from "./screens/audit/AuditSsr";
import { Layers } from "./screens/audit/Layers";
import { AgendaScreen } from "./screens/Agenda";
import { PIECES, PlanningPieces, type PieceId } from "./screens/Planning";
import { PerfStage } from "./screens/Perf";
import { ScaleListsStage } from "./screens/scale";

// La suite de navegador comprueba con este atributo qué React sirvió la página (tests/browser/run.mjs, REACT=18).
document.documentElement.dataset.react = version;

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

// Pantallas de auditoría: fuera del Shell, sin pestaña ni entrada en la navegación (?screen=audit, ?screen=audit-ssr,
// ?screen=layers).
const params = new URLSearchParams(window.location.search);
const screen = params.get("screen");
if (
  screen === "audit" ||
  screen === "audit-ssr" ||
  screen === "layers" ||
  screen === "agenda-stage" ||
  screen === "planning-stage" ||
  screen === "perf-stage" ||
  screen === "scale-stage"
) {
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
    ) : screen === "perf-stage" ? (
      // Rendimiento de la agenda: 5000 eventos y 500 recursos (?n= cambia el número de eventos).
      <main className="z-root app-stage" data-testid="screen-perf-stage">
        <PerfStage n={Number(params.get("n")) || 5000} />
      </main>
    ) : screen === "scale-stage" ? (
      // Listas de miles: ConversationList y MemberList con 1000 entradas (ventana virtual).
      <main className="z-root app-stage" data-testid="screen-scale-stage">
        <ScaleListsStage />
      </main>
    ) : screen === "planning-stage" ? (
      // Piezas de planificación a todo el ancho (?piece=gantt…): las que se comparan con el prototipo.
      <main className="z-root app-stage" data-testid="screen-planning-stage">
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
