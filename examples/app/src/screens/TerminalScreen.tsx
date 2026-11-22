import { useRef, useState } from "react";
import { Grid, Inline, Page, PageHeader, PageSection, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Button,
  Card,
  CardHeader,
  CodeViewer,
  DiffViewer,
  LogConsole,
  Terminal,
  type LogEntry,
  type TerminalHandle,
} from "@zuccadev-labs/zuix-zui";

const ESC = "\x1b";
const BANNER = `${ESC}[1mzuix shell${ESC}[0m · type ${ESC}[36mhelp${ESC}[0m\n`;
const COMMANDS = ["help", "build", "clear", "deploy", "describe", "colors"];

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      resolve();
    });
  });

async function* build(signal: AbortSignal): AsyncIterable<string> {
  for (let i = 0; i <= 10 && !signal.aborted; i++) {
    yield `\r${ESC}[2Kbuilding ${"█".repeat(i)}${"░".repeat(10 - i)} ${i * 10}%`;
    await sleep(60, signal);
  }
  if (!signal.aborted) yield `\n${ESC}[32m✓${ESC}[0m built ${ESC}[1m128${ESC}[0m modules\n`;
}

function run(command: string, { signal }: { signal: AbortSignal }) {
  const [name] = command.trim().split(/\s+/);
  if (name === "help") return `commands: ${COMMANDS.join(", ")}`;
  if (name === "build") return build(signal);
  if (name === "colors")
    return `${[1, 2, 3, 4, 5, 6].map((n) => `${ESC}[3${n}m■ ${n}${ESC}[0m`).join(" ")}\n${[208, 39, 129].map((n) => `${ESC}[38;5;${n}m■ ${n}${ESC}[0m`).join(" ")}`;
  if (name === "fail") return Promise.resolve(2);
  return `${ESC}[31mcommand not found:${ESC}[0m ${name}`;
}

const LEVELS = ["info", "info", "debug", "warn", "info", "error"] as const;
const SOURCES = ["api", "worker", "cache", "db"];
const START = Date.parse("2026-11-21T10:00:00Z");
const ENTRIES: LogEntry[] = Array.from({ length: 2400 }, (_, i) => ({
  id: i,
  time: START + i * 750,
  level: LEVELS[i % LEVELS.length],
  source: SOURCES[i % SOURCES.length],
  message: i % LEVELS.length === 5 ? `Job export-${i} failed: timeout after 30 s` : `GET /v1/projects/${i % 97} 200 in ${12 + (i % 40)} ms`,
}));

const SERVER = `import { createServer } from "node:http";

// Answers every request with the same JSON.
const port = Number(process.env.PORT ?? 3000);
const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, path: req.url }));
});

server.listen(port, () => console.log(\`Listening on \${port}\`));
`;
const STYLES = `.card {
  padding: var(--z-space-4);
  border-radius: var(--z-card-radius);
}
`;
const BEFORE = `export function total(items) {
  let sum = 0;
  for (const item of items) {
    sum += item.price;
  }
  return sum;
}
`;
const AFTER = `export function total(items, tax = 0) {
  let sum = 0;
  for (const item of items) {
    sum += item.price * item.quantity;
  }
  return sum * (1 + tax);
}
`;

export function TerminalScreen() {
  const term = useRef<TerminalHandle>(null);
  const [interrupts, setInterrupts] = useState(0);
  const [entries, setEntries] = useState(ENTRIES);
  return (
    <Page>
      <PageHeader title="Terminal" description="Terminal, logs, code viewer and diffs." />
      <PageSection title="Terminal">
        <Stack gap={3}>
          <div data-testid="x-terminal">
            <Terminal
              ref={term}
              title="zsh"
              prompt="~/app $"
              defaultOutput={BANNER}
              history={["pnpm install"]}
              onCommand={run}
              onComplete={(input) => COMMANDS.filter((c) => c.startsWith(input))}
              onInterrupt={() => setInterrupts((n) => n + 1)}
            />
          </div>
          <Inline gap={2}>
            <Button size="sm" data-testid="x-write" onClick={() => term.current?.writeln(`${ESC}[35mhello from the app${ESC}[0m`)}>
              Write from the app
            </Button>
            <span className="app-muted" data-testid="x-interrupts">{`${interrupts} interrupts`}</span>
          </Inline>
        </Stack>
      </PageSection>
      <PageSection title="Logs">
        <Stack gap={3}>
          <div data-testid="x-logs">
            <LogConsole title="api logs" entries={entries} timeZone="UTC" downloadName="api.log" clearable onClear={() => setEntries([])} />
          </div>
          <Button
            size="sm"
            data-testid="x-logs-add"
            onClick={() =>
              setEntries((list) => [
                ...list,
                { id: `new-${list.length}`, time: Date.now(), level: "warn", source: "app", message: "Added from the app" },
              ])
            }
          >
            Add an entry
          </Button>
        </Stack>
      </PageSection>
      <PageSection title="Code">
        <Grid min="340px" gap={4}>
          <Card>
            <CardHeader title="Code viewer" subtitle="Highlighted lines and two files." />
            <div data-testid="x-code">
              <CodeViewer
                files={[
                  { name: "server.ts", code: SERVER },
                  { name: "styles.css", code: STYLES },
                ]}
                highlightLines="5-8"
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Diff" subtitle="Unified or split, with changed words." />
            <div data-testid="x-diff">
              <DiffViewer fileName="src/total.js" before={BEFORE} after={AFTER} />
            </div>
          </Card>
        </Grid>
      </PageSection>
    </Page>
  );
}
