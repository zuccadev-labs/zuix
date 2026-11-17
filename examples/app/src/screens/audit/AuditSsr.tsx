// Prueba de hidratación (?screen=audit-ssr): renderiza en "servidor" (react-dom/server, en el propio navegador) las
// secciones sin portal, con el reloj en otro mes, y después las hidrata con el reloj real. El resultado queda en
// `window.__auditSsr` y lo lee tests/browser/cases-audit-react.mjs.
//   ?clock=same    el servidor usa el reloj real (sin desfase)
//   ?locale=other  el servidor formatea las fechas con otro locale (simula un servidor en otra región)
import { useEffect, useRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { Calendar, DataTable, DatePicker } from "@zuccadev-labs/zuix-zui";
import { StaticSections } from "./sections";

interface SsrResult {
  recoverable: string[];
  consoleErrors: string[];
  serverMonth: string | null;
  hydratedMonth: string | null;
  clientMonth: string;
  serverClock: string;
  htmlLength: number;
}
declare global {
  interface Window {
    __auditSsr?: SsrResult;
  }
}

const WHEN = [{ id: "a", when: new Date(Date.UTC(2026, 2, 10, 23, 30)) }];

function SsrSet({ dates }: { dates: boolean }) {
  return (
    <div className="z-root">
      <div data-testid="ssr-calendar">
        <Calendar locale="en-US" />
      </div>
      <div data-testid="ssr-calendar-range">
        <Calendar mode="range" locale="en-US" />
      </div>
      <DatePicker locale="en-US" aria-label="Due" />
      {dates ? <DataTable rows={WHEN} rowKey={(row) => row.id} columns={[{ key: "when", header: "When", accessor: (row) => row.when }]} caption="Dates" /> : null}
      <StaticSections />
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const monthOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export function AuditSsr() {
  const host = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [status, setStatus] = useState("running");

  useEffect(() => {
    if (started.current || !host.current) return;
    started.current = true;
    const container = host.current;
    const params = new URLSearchParams(window.location.search);
    void (async () => {
      const { renderToString } = await import("react-dom/server");
      const RealDate = Date;
      const realNow = new RealDate();
      // Reloj del servidor: 45 días antes, siempre en otro mes.
      const shifted = params.get("clock") === "same" ? realNow.getTime() : realNow.getTime() - 45 * 86_400_000;
      class ServerDate extends RealDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) super(shifted);
          else super(...(args as [number]));
        }
        static override now() {
          return shifted;
        }
      }
      const realFormat = RealDate.prototype.toLocaleDateString;
      const otherLocale = params.get("locale") === "other";
      let html = "";
      try {
        globalThis.Date = ServerDate as DateConstructor;
        if (otherLocale) RealDate.prototype.toLocaleDateString = function (this: Date) { return realFormat.call(this, "ja-JP", { timeZone: "Pacific/Kiritimati" }); };
        html = renderToString(<SsrSet dates />);
      } finally {
        globalThis.Date = RealDate;
        RealDate.prototype.toLocaleDateString = realFormat;
      }
      container.innerHTML = html;
      const serverMonth = container.querySelector<HTMLElement>('[data-testid="ssr-calendar"] .z-calendar')?.dataset.month ?? null;
      const recoverable: string[] = [];
      const consoleErrors: string[] = [];
      const realError = console.error;
      console.error = (...args: unknown[]) => {
        consoleErrors.push(args.map(String).join(" ").slice(0, 400));
        realError(...args);
      };
      hydrateRoot(container, <SsrSet dates />, { onRecoverableError: (error) => recoverable.push(String((error as Error)?.message ?? error).slice(0, 400)) });
      await new Promise((resolve) => setTimeout(resolve, 600));
      console.error = realError;
      window.__auditSsr = {
        recoverable,
        consoleErrors,
        serverMonth,
        hydratedMonth: container.querySelector<HTMLElement>('[data-testid="ssr-calendar"] .z-calendar')?.dataset.month ?? null,
        clientMonth: monthOf(realNow),
        serverClock: monthOf(new RealDate(shifted)),
        htmlLength: html.length,
      };
      setStatus("done");
    })();
  }, []);

  return (
    <main className="z-canvas audit" data-testid="screen-audit-ssr">
      <output data-testid="ssr-status">{status}</output>
      <div ref={host} data-testid="ssr-host" />
    </main>
  );
}
