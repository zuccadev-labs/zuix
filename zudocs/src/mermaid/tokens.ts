// Tema de Mermaid derivado de los tokens de la marca activa.
//
// Mermaid calcula sus colores derivados con una librería que solo entiende colores ya resueltos
// (hex, rgb, hsl): no acepta `var(--z-*)` ni `color-mix()`. Por eso los tokens se leen del documento
// en tiempo de ejecución y se resuelven pintándolos sobre el fondo de lectura. Aquí no hay ningún
// color literal: cambiar de marca o de modo cambia el diagrama.
import { useEffect, useState } from "react";

export interface MermaidTokens { theme: string; variables: Record<string, string | boolean> }

/** Variable de Mermaid -> token de la suite. Los translúcidos se componen sobre `--z-reading-bg`. */
const COLORS: Record<string, string> = {
  background: "--z-reading-bg",
  primaryColor: "--z-accent-soft",
  primaryTextColor: "--z-fg",
  primaryBorderColor: "--z-accent",
  secondaryColor: "--z-surface-3",
  secondaryTextColor: "--z-fg",
  secondaryBorderColor: "--z-line-strong",
  tertiaryColor: "--z-surface",
  tertiaryTextColor: "--z-fg",
  tertiaryBorderColor: "--z-line-strong",
  mainBkg: "--z-accent-soft",
  nodeBorder: "--z-accent",
  nodeTextColor: "--z-fg",
  lineColor: "--z-fg-muted",
  textColor: "--z-fg",
  titleColor: "--z-fg",
  clusterBkg: "--z-surface",
  clusterBorder: "--z-line-strong",
  edgeLabelBackground: "--z-reading-bg",
  noteBkgColor: "--z-warning-soft",
  noteTextColor: "--z-fg",
  noteBorderColor: "--z-warning",
  actorBkg: "--z-accent-soft",
  actorBorder: "--z-accent",
  actorTextColor: "--z-fg",
  actorLineColor: "--z-fg-subtle",
  signalColor: "--z-fg-muted",
  signalTextColor: "--z-fg",
  labelBoxBkgColor: "--z-surface-2",
  labelBoxBorderColor: "--z-line-strong",
  labelTextColor: "--z-fg",
  loopTextColor: "--z-fg",
  activationBkgColor: "--z-surface-3",
  activationBorderColor: "--z-accent",
  sequenceNumberColor: "--z-fg-on-accent",
  errorBkgColor: "--z-danger-soft",
  errorTextColor: "--z-danger",
};

const cache = new Map<string, MermaidTokens | null>();
const hex = (n: number) => n.toString(16).padStart(2, "0");

function read(theme: string): MermaidTokens | null {
  const root = document.documentElement;
  // Un resultado por modo y siempre el mismo objeto: si cambiara de identidad sin cambiar de modo,
  // Mermaid volvería a dibujar un diagrama a medio hacer y lo dejaría vacío.
  const hit = cache.get(theme);
  if (hit !== undefined) return hit;

  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  let out: MermaidTokens | null = null;
  if (ctx) {
    ctx.canvas.width = ctx.canvas.height = 1;
    const probe = document.createElement("span");
    probe.style.display = "none";
    root.appendChild(probe);
    // El navegador resuelve `var()` y `color-mix()`; el lienzo lo convierte a un color opaco.
    const computed = (token: string) => { probe.style.color = ""; probe.style.color = `var(${token})`; return getComputedStyle(probe).color; };
    const paint = (color: string) => { ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); };
    const pixel = () => { const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data; return `#${hex(r)}${hex(g)}${hex(b)}`; };
    const canvas = computed("--z-canvas");
    const backdrop = () => { ctx.clearRect(0, 0, 1, 1); paint(canvas); paint(computed("--z-reading-bg")); };
    const variables: Record<string, string | boolean> = {};
    for (const [name, token] of Object.entries(COLORS)) { backdrop(); paint(computed(token)); variables[name] = pixel(); }
    probe.remove();
    const style = getComputedStyle(root);
    variables.fontFamily = style.getPropertyValue("--z-font-sans").trim() || style.fontFamily;
    variables.darkMode = theme === "dark";
    out = { theme, variables };
  }
  cache.set(theme, out);
  return out;
}

/**
 * Tokens resueltos para el modo activo. `undefined` hasta el primer efecto, `null` si no se pueden
 * resolver. Sigue el atributo `data-theme` del documento, que es de donde cuelgan los tokens.
 */
export function useMermaidTokens(): MermaidTokens | null | undefined {
  const [tokens, setTokens] = useState<MermaidTokens | null | undefined>(undefined);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setTokens(read(root.getAttribute("data-theme") ?? "light"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return tokens;
}
