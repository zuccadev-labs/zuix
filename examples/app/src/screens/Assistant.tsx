// Pantalla de asistente (`?screen=assistant`): conversación con un modelo simulado. Enviar crea la respuesta, que
// razona, llama a una herramienta y escribe a trozos (con parar); pedir un despliegue pasa por una aprobación;
// regenerar abre una rama nueva («‹ 2 / 2 ›») sobre el árbol de core/branches; un artefacto se abre al lado.
import { useEffect, useRef, useState } from "react";
import {
  AgentPlan,
  AgentStatus,
  Artifact,
  AssistantMessage,
  MessageBubble,
  PromptInput,
  Suggestions,
  UsageMeter,
  activePath,
  addBranch,
  branchInfo,
  selectBranch,
  siblings,
  type AgentState,
  type AssistantPart,
  type BranchSelection,
  type PromptSubmit,
  type ResponseState,
} from "@zuccadev-labs/zuix-zui";

interface Turn {
  id: string;
  parentId: string | null;
  role: "user" | "assistant";
  text?: string;
  parts?: AssistantPart[];
  state?: ResponseState;
  createdAt: string;
}

const SOURCES = [
  { title: "Release process", url: "https://example.com/release" },
  { title: "HTML contract", url: "https://example.org/contract" },
  { title: "Glass material", url: "https://example.net/material" },
];

const ANSWER = `Here is a **short plan** to ship the docs this week [1]:

1. Freeze the public surface and regenerate the contract [2].
2. Run the visual audit on both brands.
3. Publish the site and post the notes.

\`\`\`ts
// zudocs.config.ts
export default { brand: "dazlabs", theme: "dark" };
\`\`\`

| Step | Owner | Status |
|:--|:--|:--|
| Contract | Ana | Done |
| Audit | Luis | In progress |

The glass material keeps text off translucent surfaces [3], so the docs stay readable.`;

const ALT = `A **faster path**: publish today with the current contract [2] and run the audit afterwards.

- Fewer steps, but the visual audit happens after release.
- Good when the change is docs only.`;

const DEPLOY = "Deployed to production. The release workflow finished in **4 min 12 s** and every check passed.";

const START = Date.now();
const iso = (offset = 0) => new Date(START + offset).toISOString();
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(id);
      resolve();
    });
  });

let seq = 0;
const nextId = (p: string) => `${p}${++seq}`;

export function AssistantScreen() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [selection, setSelection] = useState<BranchSelection>({});
  const [model, setModel] = useState("deep");
  const [status, setStatus] = useState<"ready" | "submitted" | "streaming">("ready");
  const [agent, setAgent] = useState<{ state: AgentState; detail?: string; since?: number }>({ state: "idle" });
  const [artifact, setArtifact] = useState(false);
  const [tokens, setTokens] = useState(18_400);
  const controller = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const path = activePath(turns, selection);
  const patch = (id: string, change: Partial<Turn>) => setTurns((list) => list.map((t) => (t.id === id ? { ...t, ...change } : t)));
  const scroll = () => requestAnimationFrame(() => end.current?.scrollIntoView({ block: "end" }));

  async function respond(parentId: string, prompt: string, signal: AbortSignal, alt = false) {
    const id = nextId("a");
    const started = Date.now();
    const deploy = /deploy/i.test(prompt);
    const base: Turn = { id, parentId, role: "assistant", createdAt: iso(), state: "submitted", parts: [] };
    setTurns((list) => {
      const next = addBranch(list, selection, base);
      setSelection(next.selection);
      return next.nodes;
    });
    setStatus("submitted");
    setAgent({ state: "thinking", since: started });
    scroll();
    await sleep(500, signal);
    if (signal.aborted) return patch(id, { state: "stopped" });
    const reasoning: AssistantPart = {
      type: "reasoning",
      state: "thinking",
      startedAt: started,
      text: "The user wants a plan. Check the release process, then the contract, then keep it short.",
    };
    patch(id, { parts: [reasoning] });
    await sleep(1200, signal);
    if (signal.aborted) return patch(id, { state: "stopped", parts: [{ ...reasoning, state: "done", endedAt: Date.now() }] });
    const thought: AssistantPart = { ...reasoning, state: "done", endedAt: Date.now() };
    const tool: AssistantPart = {
      type: "tool",
      id: `${id}-t`,
      name: deploy ? "run_workflow" : "search_docs",
      title: deploy ? "Run workflow" : "Search docs",
      status: "running",
      input: deploy ? { workflow: "release.yml", ref: "main" } : { query: prompt.slice(0, 40) },
      startedAt: Date.now(),
    };
    patch(id, { parts: [thought, tool] });
    setAgent({ state: "tool", detail: (tool as { name: string }).name, since: Date.now() });
    if (deploy) {
      const approval: AssistantPart = {
        type: "approval",
        id: `${id}-ok`,
        title: "Deploy to production",
        description: "The agent wants to run the release workflow on main.",
        risk: "high",
        details: [
          { label: "Workflow", value: "release.yml" },
          { label: "Branch", value: "main" },
        ],
      };
      patch(id, { parts: [thought, { ...tool, status: "awaiting-approval" } as AssistantPart, approval] });
      setAgent({ state: "waiting" });
      return;
    }
    await sleep(900, signal);
    const done: AssistantPart = {
      ...(tool as Extract<AssistantPart, { type: "tool" }>),
      status: "success",
      output: { hits: 3, top: "Release process" },
      endedAt: Date.now(),
    };
    await stream(id, [thought, done], alt ? ALT : ANSWER, signal, true);
  }

  async function stream(id: string, before: AssistantPart[], text: string, signal: AbortSignal, withSources: boolean) {
    setStatus("streaming");
    setAgent({ state: "thinking", since: Date.now() });
    let shown = "";
    for (const word of text.split(/(?<=\s)/)) {
      if (signal.aborted) break;
      shown += word;
      patch(id, { state: "streaming", parts: [...before, { type: "text", text: shown }] });
      setTokens((n) => n + 3);
      await sleep(22, signal);
    }
    const parts: AssistantPart[] = [...before, { type: "text", text: shown }];
    if (!signal.aborted && withSources)
      parts.push(
        { type: "sources", items: SOURCES },
        { type: "artifact", id: "config", title: "zudocs.config.ts", kind: "TypeScript", description: "2 versions" },
      );
    patch(id, { state: signal.aborted ? "stopped" : "done", parts });
    setStatus("ready");
    setAgent({ state: signal.aborted ? "idle" : "done" });
    scroll();
  }

  const submit = ({ text }: PromptSubmit) => {
    if (!text.trim() || status !== "ready") return;
    const user: Turn = { id: nextId("u"), parentId: path.at(-1)?.id ?? null, role: "user", text, createdAt: iso() };
    setTurns((list) => {
      const next = addBranch(list, selection, user);
      setSelection(next.selection);
      return next.nodes;
    });
    controller.current = new AbortController();
    void respond(user.id, text, controller.current.signal);
  };

  const regenerate = (turn: Turn) => {
    if (status !== "ready" || !turn.parentId) return;
    const prompt = turns.find((t) => t.id === turn.parentId)?.text ?? "";
    controller.current = new AbortController();
    void respond(turn.parentId, prompt, controller.current.signal, true);
  };

  const approve = (turn: Turn, approved: boolean) => {
    const parts = (turn.parts ?? []).map((p) =>
      p.type === "approval"
        ? { ...p, decision: approved ? ("approved" as const) : ("rejected" as const) }
        : p.type === "tool"
          ? { ...p, status: approved ? ("running" as const) : ("cancelled" as const) }
          : p,
    );
    patch(turn.id, { parts });
    controller.current = new AbortController();
    const signal = controller.current.signal;
    if (!approved) {
      void stream(turn.id, parts, "Understood, I won't deploy. Tell me when you want to try again.", signal, false);
      return;
    }
    setAgent({ state: "tool", detail: "run_workflow", since: Date.now() });
    void sleep(1400, signal).then(() => {
      const finished = parts.map((p) =>
        p.type === "tool"
          ? { ...p, status: "success" as const, output: { status: "completed", duration: "4m 12s" }, endedAt: Date.now() }
          : p,
      );
      return stream(turn.id, finished, DEPLOY, signal, false);
    });
  };

  const empty = path.length === 0;

  return (
    <div className={`app-assistant${artifact ? " app-assistant--split" : ""}`} data-testid="a-screen">
      <section className="app-assistant__main" aria-labelledby="a-title">
        <header className="app-assistant__bar">
          <h1 id="a-title" className="app-assistant__title">
            Assistant
          </h1>
          <AgentStatus state={agent.state} detail={agent.detail} since={agent.since} />
          <span className="app-assistant__usage">
            <UsageMeter variant="inline" used={tokens} limit={200_000} locale="en" />
          </span>
        </header>
        <div className="app-assistant__scroll" data-testid="a-thread">
          <div className="app-assistant__thread">
            {empty ? (
              <div className="app-assistant__empty">
                <h2 className="app-assistant__hello">What should we ship today?</h2>
                <div data-testid="a-suggestions">
                  <Suggestions
                    layout="grid"
                    items={[
                      { text: "Plan the docs release", icon: "document-text", description: "Steps, owners and checks" },
                      { text: "Deploy the release to production", icon: "rocket-launch", description: "Asks for approval first" },
                      { text: "Summarize this week's changes", icon: "list-bullet", description: "From the changelog" },
                    ]}
                    onSelect={({ text }) => submit({ text, attachments: [] })}
                  />
                </div>
                <AgentPlan
                  title="Today"
                  collapsible
                  steps={[
                    { id: "1", title: "Review the HTML contract", status: "done" },
                    { id: "2", title: "Run the visual audit", status: "running", detail: "dazlabs and zutool, light and dark" },
                    { id: "3", title: "Publish the site", status: "pending" },
                  ]}
                />
              </div>
            ) : null}
            {path.map((turn) => {
              if (turn.role === "user")
                return (
                  <div key={turn.id} className="app-assistant__user">
                    <MessageBubble mine locale="en" message={{ id: turn.id, authorId: "me", createdAt: turn.createdAt, text: turn.text }} />
                  </div>
                );
              const info = branchInfo(turns, turn.id);
              return (
                <div key={turn.id} data-testid="a-answer">
                  <AssistantMessage
                    state={turn.state}
                    parts={turn.parts}
                    branch={info ?? undefined}
                    onRegenerate={() => regenerate(turn)}
                    onBranchChange={({ index }) => {
                      const { list } = siblings(turns, turn.id);
                      const target = list[index - 1];
                      if (target) setSelection(selectBranch(turns, selection, target.id));
                    }}
                    onApprove={() => approve(turn, true)}
                    onReject={() => approve(turn, false)}
                    onOpenArtifact={() => setArtifact(true)}
                  />
                </div>
              );
            })}
            <div ref={end} />
          </div>
        </div>
        <div className="app-assistant__input" data-testid="a-prompt">
          <PromptInput
            status={status}
            model={model}
            onModelChange={({ model: next }) => setModel(next)}
            models={[
              { id: "fast", label: "Fast" },
              { id: "deep", label: "Deep reasoning" },
            ]}
            tools={[
              { id: "web", label: "Web search", icon: "globe-alt", active: true },
              { id: "code", label: "Code", icon: "code-bracket" },
            ]}
            usage={{ used: tokens, limit: 200_000 }}
            onSubmit={submit}
            onStop={() => controller.current?.abort()}
          />
          <p className="app-assistant__note">Answers are simulated in this example.</p>
        </div>
      </section>
      {artifact ? (
        <aside className="app-assistant__side" aria-label="Artifact" data-testid="a-artifact">
          <Artifact
            title="zudocs.config.ts"
            kind="TypeScript"
            closable
            downloadName="zudocs.config.ts"
            onClose={() => setArtifact(false)}
            versions={[
              { code: 'export default { brand: "dazlabs" };', language: "ts" },
              { code: 'export default { brand: "dazlabs", theme: "dark" };', language: "ts" },
            ]}
          />
        </aside>
      ) : null}
    </div>
  );
}
