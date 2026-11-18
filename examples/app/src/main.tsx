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

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

// Pantallas de auditoría: fuera del Shell, sin pestaña ni entrada en la navegación (?screen=audit, ?screen=audit-ssr,
// ?screen=layers).
const params = new URLSearchParams(window.location.search);
const screen = params.get("screen");
if (screen === "audit" || screen === "audit-ssr" || screen === "layers") {
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
    ) : (
      <ToastProvider>
        <App />
      </ToastProvider>
    )}
  </StrictMode>,
);
