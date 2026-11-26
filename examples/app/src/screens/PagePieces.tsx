import { useState } from "react";
import { DocsLayout, Grid, Inline, Page, Stack } from "@zuccadev-labs/zuix-zout";
import {
  Affix,
  BackToTop,
  Badge,
  Button,
  Card,
  DataView as CollectionView,
  Mentions,
  NavLink,
  NavList,
  OverflowList,
  Popconfirm,
  Prose,
  SearchView,
  TableOfContents,
  Textarea,
  Toolbar,
  TopProgress,
  encodeMentions,
  topProgress,
  type ChosenMention,
  type MentionItem,
} from "@zuccadev-labs/zuix-zui";

// Pantalla de piezas de página: el índice de DocsLayout (TableOfContents) sigue las secciones, una barra de filtros
// fija al desplazar (Affix), volver arriba, la barra de carga superior, una colección en lista o rejilla, una fila que
// se recorta en «+N», menciones en un comentario, la búsqueda de Material 3 y una confirmación en línea. Sin red.

const SECTIONS = [
  { id: "pg-progress", label: "Loading bar", level: 2 },
  { id: "pg-views", label: "List or grid", level: 2 },
  { id: "pg-overflow", label: "Overflow", level: 2 },
  { id: "pg-mentions", label: "Mentions", level: 2 },
  { id: "pg-search", label: "Search view", level: 2 },
  { id: "pg-confirm", label: "Inline confirm", level: 2 },
  { id: "pg-contents", label: "Contents", level: 2 },
] as const;

const PROJECTS = [
  { id: "atlas", name: "Atlas", owner: "Marta Ruiz", status: "Active" },
  { id: "borealis", name: "Borealis", owner: "Luis Gil", status: "Review" },
  { id: "cirrus", name: "Cirrus", owner: "Ana López", status: "Paused" },
  { id: "delta", name: "Delta", owner: "Bruno Díaz", status: "Active" },
  { id: "eos", name: "Eos", owner: "Carla Ruiz", status: "Active" },
];

const SECTIONS_NAV = ["Overview", "Projects", "Reports", "Billing", "Members", "Integrations", "Settings", "Audit log"].map((label) => ({
  id: label.toLowerCase().replace(/\s+/g, "-"),
  label,
}));

const PEOPLE: MentionItem[] = [
  { id: "u1", label: "Ana López", description: "Design" },
  { id: "u2", label: "Bruno Díaz", description: "Engineering" },
  { id: "u3", label: "Carla Ruiz", description: "Support" },
  { id: "u4", label: "Luis Gil", description: "Product" },
];
const CHANNELS: MentionItem[] = ["releases", "design", "support", "random"].map((label, i) => ({ id: `c${i + 1}`, label }));

// Canales «del servidor»: la carga asíncrona con espera, cancelable.
const loadChannels = (query: string, { signal }: { signal: AbortSignal }) =>
  new Promise<MentionItem[]>((resolve, reject) => {
    const timer = setTimeout(() => resolve(CHANNELS.filter((c) => c.label.includes(query.toLowerCase()))), 300);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    });
  });

export function PagePieces() {
  const [comment, setComment] = useState("");
  const [chosen, setChosen] = useState<ChosenMention[]>([]);
  const [sent, setSent] = useState("");
  const [rows, setRows] = useState(PROJECTS);
  const [query, setQuery] = useState("");
  const [log, setLog] = useState("");
  const found = PROJECTS.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <Page label="Page pieces" width="full">
      <TopProgress />
      <DocsLayout toc={SECTIONS.map((s) => ({ ...s }))} labels={{ toc: "On this page" }}>
        <Prose>
          <h1>Page pieces</h1>
          <p>Scroll aids, views and inline actions. The contents on the side follow the section you read.</p>
        </Prose>
        <Affix offset={0} data-testid="pg-affix">
          <Toolbar label="Page actions" size="sm">
            <Button size="sm" icon="arrow-path" onClick={() => topProgress.start()} data-testid="pg-start">
              Start loading
            </Button>
            <Button size="sm" variant="ghost" onClick={() => topProgress.done()} data-testid="pg-done">
              Finish
            </Button>
          </Toolbar>
        </Affix>
        <Stack gap={8}>
          <section aria-labelledby="pg-progress">
            <Stack gap={3}>
              <h2 id="pg-progress">Loading bar</h2>
              <p>The bar at the top follows <code>topProgress</code>: start, trickle and done, as NProgress does.</p>
              <Inline gap={2}>
                <Button size="sm" onClick={() => topProgress.set(0.5)} data-testid="pg-half">
                  Set 50%
                </Button>
                <Button size="sm" variant="ghost" onClick={() => topProgress.inc()}>
                  Increment
                </Button>
              </Inline>
              <div style={{ position: "relative", height: 8 }}>
                <TopProgress inline value={72} announce={false} labels={{ loading: "Upload" }} />
              </div>
            </Stack>
          </section>

          <section aria-labelledby="pg-views">
            <Stack gap={3}>
              <h2 id="pg-views">List or grid</h2>
              <CollectionView
                label="Projects"
                persistKey="zuix-demo-projects-layout"
                items={PROJECTS}
                min={180}
                renderItem={(p, layout) => (
                  <Card padding="sm" data-testid={`pg-project-${p.id}`}>
                    <Stack gap={1}>
                      <strong>{p.name}</strong>
                      {layout === "grid" ? <span>{p.owner}</span> : null}
                      <Inline gap={2}>
                        <Badge>{p.status}</Badge>
                      </Inline>
                    </Stack>
                  </Card>
                )}
              />
            </Stack>
          </section>

          <section aria-labelledby="pg-overflow">
            <Stack gap={3}>
              <h2 id="pg-overflow">Overflow</h2>
              <p>Resize the window: what does not fit moves to the «+N» menu.</p>
              <div data-testid="pg-overflow">
                <OverflowList label="Workspace sections" items={SECTIONS_NAV.map((s) => ({ ...s, onSelect: () => setLog(`Opened ${s.label}`) }))} />
              </div>
              <p aria-live="polite" data-testid="pg-log">
                {log}
              </p>
            </Stack>
          </section>

          <section aria-labelledby="pg-mentions">
            <Stack gap={3}>
              <h2 id="pg-mentions">Mentions</h2>
              <Mentions
                sources={[
                  { trigger: "@", label: "People", items: PEOPLE },
                  { trigger: "#", label: "Channels", load: loadChannels },
                ]}
                onSelect={(item) => setChosen((list) => [...list.filter((c) => c.id !== item.id), item])}
              >
                <Textarea aria-label="Comment" placeholder="Type @ for people or # for channels" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} data-testid="pg-comment" />
              </Mentions>
              <Inline gap={2}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setSent(encodeMentions(encodeMentions(comment, chosen.filter((c) => c.trigger === "@"), "@"), chosen.filter((c) => c.trigger === "#"), "#"));
                    setComment("");
                  }}
                >
                  Post
                </Button>
              </Inline>
              {sent ? (
                <p data-testid="pg-sent">
                  Sent as <code>{sent}</code>
                </p>
              ) : null}
            </Stack>
          </section>

          <section aria-labelledby="pg-search">
            <Stack gap={3}>
              <h2 id="pg-search">Search view</h2>
              <SearchView id="pg-searchview" label="Search projects" placeholder="Search projects" value={query} onValueChange={setQuery}>
                <NavList label="Projects">
                  {found.map((p) => (
                    <NavLink key={p.id} href={`#${p.id}`} icon="folder">
                      {p.name}
                    </NavLink>
                  ))}
                </NavList>
              </SearchView>
            </Stack>
          </section>

          <section aria-labelledby="pg-confirm">
            <Stack gap={3}>
              <h2 id="pg-confirm">Inline confirm</h2>
              <Grid min={240} gap={3}>
                {rows.map((p) => (
                  <Card key={p.id} padding="sm">
                    <Inline gap={2} justify="between">
                      <strong>{p.name}</strong>
                      <Popconfirm
                        intent="danger"
                        title={`Delete ${p.name}?`}
                        description="Its history goes with it."
                        confirmLabel="Delete"
                        onConfirm={() => new Promise((r) => setTimeout(r, 400)).then(() => setRows((list) => list.filter((x) => x.id !== p.id)))}
                        trigger={
                          <Button size="sm" variant="ghost" icon="trash" data-testid={`pg-delete-${p.id}`}>
                            Delete
                          </Button>
                        }
                      />
                    </Inline>
                  </Card>
                ))}
              </Grid>
            </Stack>
          </section>

          <section aria-labelledby="pg-contents">
            <Stack gap={3}>
              <h2 id="pg-contents">Contents</h2>
              <p>The same index, compact, for a narrow column.</p>
              <div style={{ maxWidth: 320 }}>
                <TableOfContents id="pg-toc-compact" compact items={SECTIONS.map((s) => ({ ...s }))} labels={{ title: "Jump to" }} />
              </div>
            </Stack>
          </section>
        </Stack>
        <BackToTop threshold={300} showLabel />
      </DocsLayout>
    </Page>
  );
}
