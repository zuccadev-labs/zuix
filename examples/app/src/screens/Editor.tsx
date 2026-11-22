import { useState, useSyncExternalStore } from "react";
import { Pane, SplitPane } from "@zuccadev-labs/zuix-zout";
import { Badge, CodeBlock, IconButton, Textarea, Tree, type TreeNode } from "@zuccadev-labs/zuix-zui";

const FILES: TreeNode[] = [
  {
    id: "app",
    label: "app",
    icon: "folder",
    children: [
      { id: "App.tsx", label: "App.tsx", icon: "document-text" },
      { id: "main.tsx", label: "main.tsx", icon: "document-text" },
      { id: "app.css", label: "app.css", icon: "document-text" },
    ],
  },
  { id: "package.json", label: "package.json", icon: "document-text" },
];

const SOURCE: Record<string, string> = {
  "App.tsx": "export function App() {\n  return <Shell sidebar={sidebar}>{screen}</Shell>;\n}\n",
  "main.tsx": "createRoot(root).render(<App />);\n",
  "app.css": "html, body, #root { height: 100%; }\n",
  "package.json": '{\n  "name": "@zuccadev-labs/zuix-example-app"\n}\n',
};

type PaneId = "files" | "editor" | "output";

const NARROW = "(max-width: 600px)";
const subscribeNarrow = (notify: () => void) => {
  const query = matchMedia(NARROW);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const readNarrow = () => matchMedia(NARROW).matches;

export function Editor() {
  const [file, setFile] = useState("App.tsx");
  const [focused, setFocused] = useState<PaneId>("editor");
  const [sizes, setSizes] = useState(() => (readNarrow() ? [0.36, 0.64] : [0.25, 0.75]));
  // En un teléfono la lista de archivos va encima: al lado le quedaban 90 px y los nombres no se leían.
  const narrow = useSyncExternalStore(subscribeNarrow, readNarrow, () => false);
  const [text, setText] = useState(SOURCE);

  return (
    <div className="app-editor" data-testid="editor">
      <SplitPane
        direction={narrow ? "column" : "row"}
        sizes={sizes}
        onSizesChange={setSizes}
        dividerLabel="Resize file list"
        className="app-split-main"
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: no es un control; solo anota qué panel tiene el foco para resaltarlo. La interacción está en los controles de dentro. */}
        <div
          className="app-pane-slot"
          onPointerDown={() => setFocused("files")}
          onFocus={() => setFocused("files")}
          data-testid="pane-files"
        >
          <Pane header="Files" focused={focused === "files"}>
            <div className="app-pane-pad">
              <Tree
                nodes={FILES}
                label="Project files"
                defaultExpanded={["app"]}
                selected={file}
                onSelect={(id, node) => {
                  if (!node.children) setFile(id);
                }}
              />
            </div>
          </Pane>
        </div>
        <SplitPane direction="column" defaultSizes={[0.65, 0.35]} dividerLabel="Resize output" className="app-split-inner">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: no es un control; solo anota qué panel tiene el foco para resaltarlo. */}
          <div
            className="app-pane-slot"
            onPointerDown={() => setFocused("editor")}
            onFocus={() => setFocused("editor")}
            data-testid="pane-editor"
          >
            <Pane
              header={
                <>
                  <span className="app-pane-title" data-testid="editor-file">
                    {file}
                  </span>
                  <Badge size="sm" tone="info">
                    TSX
                  </Badge>
                  <span className="app-spacer" />
                  <IconButton icon="play" label="Run" size="sm" variant="ghost" />
                </>
              }
              focused={focused === "editor"}
            >
              <Textarea
                className="app-code"
                mono
                resize="none"
                aria-label={`Contents of ${file}`}
                spellCheck={false}
                value={text[file] ?? ""}
                onChange={(event) => setText({ ...text, [file]: event.target.value })}
                data-testid="editor-text"
              />
            </Pane>
          </div>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: no es un control; solo anota qué panel tiene el foco para resaltarlo. */}
          <div
            className="app-pane-slot"
            onPointerDown={() => setFocused("output")}
            onFocus={() => setFocused("output")}
            data-testid="pane-output"
          >
            <Pane header="Output" focused={focused === "output"}>
              <div className="app-pane-pad">
                <CodeBlock code={"vite v8 ready in 312 ms\n  Local: http://127.0.0.1:5173/"} language="sh" hideCopy />
              </div>
            </Pane>
          </div>
        </SplitPane>
      </SplitPane>
      <output className="z-sr-only" data-testid="split-sizes">
        {sizes.map((s) => s.toFixed(3)).join(",")}
      </output>
    </div>
  );
}
