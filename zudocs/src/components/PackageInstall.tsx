// Bloque de instalación con pestañas por gestor de paquetes. La elección se recuerda (localStorage) y se
// comparte entre todos los bloques de la página y entre pestañas del navegador.
import { SegmentedControl } from "@zuccadev-labs/zuix-zui";
import { CopyButton } from "./Copy";
import { createChoice, useChoice } from "./store";

export const MANAGERS = ["pnpm", "npm", "yarn", "bun"] as const;
export type Manager = (typeof MANAGERS)[number];
/** Gestor elegido: se recuerda y se comparte entre todos los bloques. */
const manager = createChoice<Manager>("zudocs.pm", MANAGERS, "pnpm");
export const useManager = () => useChoice(manager);

export interface InstallSpec {
  packages: string[];
  dev?: boolean;
}

/** Comando de instalación para cada gestor. */
export function command(m: Manager, { packages, dev }: InstallSpec): string {
  const list = packages.join(" ");
  switch (m) {
    case "npm":
      return `npm install ${dev ? "--save-dev " : ""}${list}`;
    case "yarn":
      return `yarn add ${dev ? "--dev " : ""}${list}`;
    case "bun":
      return `bun add ${dev ? "--dev " : ""}${list}`;
    default:
      return `pnpm add ${dev ? "-D " : ""}${list}`;
  }
}

/** Lee una orden de instalación de un solo gestor (`pnpm add -D x`, `npm i x`…). Devuelve undefined si no lo es. */
export function parseInstall(code: string): InstallSpec | undefined {
  const line = code.trim();
  if (line.includes("\n")) return undefined;
  const m = line.match(/^(?:\$\s*)?(?:pnpm (?:add|install|i)|npm (?:install|i|add)|yarn add|bun (?:add|install|i))\s+(.+)$/);
  if (!m) return undefined;
  const words = m[1].split(/\s+/);
  let dev = false;
  const packages: string[] = [];
  for (const w of words) {
    if (w === "-D" || w === "--save-dev" || w === "--dev" || w === "-d") dev = true;
    else if (w.startsWith("-")) return undefined;
    else packages.push(w);
  }
  return packages.length ? { packages, dev } : undefined;
}

export function PackageInstall({ title = "Instalación", ...spec }: InstallSpec & { title?: string }) {
  const [manager, setManager] = useManager();
  const cmd = command(manager, spec);
  return (
    <div className="zd-install">
      <div className="zd-install__head">
        <span className="zd-install__title">{title}</span>
        <SegmentedControl
          size="sm"
          label="Gestor de paquetes"
          value={manager}
          onValueChange={(v) => setManager(v as Manager)}
          items={MANAGERS.map((m) => ({ value: m, label: m }))}
        />
      </div>
      <div className="zd-install__body">
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: en un móvil el comando se desplaza en horizontal y debe poder hacerse con el teclado */}
        <div className="zd-install__cmd" role="region" aria-label={`Comando de ${manager}`} tabIndex={0}>
          <code>
            <span className="zd-install__prompt" aria-hidden="true">
              ${" "}
            </span>
            {cmd}
          </code>
        </div>
        <CopyButton text={cmd} name="el comando" />
      </div>
    </div>
  );
}
