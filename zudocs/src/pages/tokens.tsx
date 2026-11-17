import type { CSSProperties } from "react";
import Layout from "@theme/Layout";
import tokens from "@zuccadev-labs/zuix-tokens/tokens.json";
import { Badge, Panel } from "@zuccadev-labs/zuix-zui";
import { useZudocs } from "../site";

const COLOR = /^(accent|fg|surface|canvas$|canvas-fg|overlay|inset|line|row-hover|success|warning|danger|info|glass-bg|glass-border)/;

export default function Tokens() {
  const site = useZudocs();
  const brand = (tokens.brands as Record<string, { label: string; themes: { dark: Record<string, string> } }>)[site.brand];
  const semantic = [...new Set([...Object.keys(brand?.themes.dark ?? {}), ...Object.keys(tokens.semanticDerived)])]
    .filter((k) => COLOR.test(k))
    .sort();
  const scale = Object.entries(tokens.scale as Record<string, string>);
  const group = (prefix: string) => scale.filter(([k]) => k.startsWith(prefix));
  return (
    <Layout title="Tokens" description="Tokens de diseño de la suite">
      <main className="zd-page z-root">
        <div className="zd-wrap">
          <header>
            <h1>Tokens</h1>
            <p className="zd-sub">
              Marca activa: <Badge tone="accent">{brand?.label ?? site.brand}</Badge>. Los valores se ven en vivo: cambia el tema con el
              botón de la barra superior. Marcas disponibles: {Object.keys(tokens.brands).join(", ")}.
            </p>
          </header>
          <Panel title="Color y material" description="Tokens semánticos. Los componentes solo leen estos.">
            <div className="zd-swatches">
              {semantic.map((k) => (
                <div key={k} className="zd-swatch">
                  <span className="zd-swatch__chip" style={{ "--zd-swatch": `var(--z-${k})` } as CSSProperties} />
                  <span className="zd-swatch__name">{k}</span>
                </div>
              ))}
            </div>
          </Panel>
          {[
            ["Espaciado", "space-"],
            ["Radios", "radius-"],
            ["Tipografía", "text-"],
            ["Movimiento", "duration-"],
            ["Capas", "layer-"],
            ["Medidas de layout", ""],
          ].map(([title, prefix]) => {
            const rows = prefix ? group(prefix as string) : scale.filter(([k]) => /width|height|gap|pad|max$/.test(k));
            return (
              <Panel key={title} title={title}>
                <table className="z-table">
                  <tbody>
                    {rows.map(([k, v]) => (
                      <tr key={k}>
                        <td className="zd-mono">--z-{k}</td>
                        <td className="zd-mono">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            );
          })}
        </div>
      </main>
    </Layout>
  );
}
