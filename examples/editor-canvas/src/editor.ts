// Editor de demostración sobre @zuccadev-labs/zuix-zui/editor. Mínimo a propósito: prueba el conector de punta a
// punta (catálogo, puente, panel de props desde el JSON Schema, marca y exportar), no es un editor de producto.
import "@zuccadev-labs/zuix-zicon/element";
import {
  type Catalog,
  type CatalogBlock,
  type CanvasConnection,
  type ElementNode,
  type JsonSchema,
  type JsonValue,
  type PageDocument,
  type PageNode,
  type SizeClass,
  type AdaptiveTemplates,
  CHILDREN,
  isSizeClass,
  resolveAdaptive,
  resolveTemplate,
  templateAreas,
  accepts,
  connectCanvas,
  createBrandEditor,
  createDocument,
  findNode,
  idGenerator,
  locate,
  toHTML,
  withNewIds,
} from "@zuccadev-labs/zuix-zui/editor";
import data from "@zuccadev-labs/zuix-zui/editor/catalog.json";

const catalog = data as unknown as Catalog;
const byType = new Map(catalog.blocks.map((b) => [b.type, b]));
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const nextId = idGenerator("e");

const adaptiveDemo = catalog.blocks.find((b) => b.type === "AdaptiveLayout")?.presets.find((p) => p.id === "contenido-con-lateral")?.node;
const state: {
  document: PageDocument;
  selected: string | null;
  canUndo: boolean;
  canRedo: boolean;
  connection: CanvasConnection | null;
  sizeClass: SizeClass;
} = {
  document: createDocument({
    title: "Demo",
    lang: "en",
    body: [
      {
        id: "hero",
        type: "LandingHero",
        props: { align: "center" },
        slots: {
          eyebrow: [{ id: "hero-e", type: "#text", text: "zuix 0.5" }],
          title: [{ id: "hero-t", type: "#text", text: "A page from the editor" }],
          lead: [{ id: "hero-l", type: "#text", text: "Blocks from the catalog, rendered with the HTML contract." }],
          actions: [
            {
              id: "cta",
              type: "Button",
              props: { variant: "primary", icon: "plus" },
              children: [{ id: "cta-t", type: "#text", text: "Get started" }],
            },
          ],
        },
      },
      { id: "intro", type: "Paragraph", children: [{ id: "intro-t", type: "#text", text: "Click a block to select it." }] },
      ...(adaptiveDemo ? [adaptiveDemo] : []),
    ],
  }),
  selected: null,
  canUndo: false,
  canRedo: false,
  connection: null,
  sizeClass: "compact",
};
(window as unknown as { zuixEditor: typeof state }).zuixEditor = state;

const status = (text: string) => {
  $("status").textContent = text;
};

// ── Catálogo lateral ─────────────────────────────────────────────────────────────────────────────────────────
function palette(filter = "") {
  const list = $("palette");
  const q = filter.trim().toLowerCase();
  const items = catalog.blocks.filter(
    (b) => b.html !== "none" && b.presets.length && (!q || b.type.toLowerCase().includes(q) || b.group.includes(q)),
  );
  list.replaceChildren(
    ...items.map((b) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "z-btn z-btn--ghost";
      button.dataset.size = "sm";
      button.dataset.block = b.type;
      const icon = document.createElement("z-icon");
      icon.setAttribute("name", b.icon);
      icon.setAttribute("size", "14");
      button.append(icon, b.type);
      button.title = b.description;
      button.addEventListener("click", () => insert(b));
      li.append(button);
      return li;
    }),
  );
}

/** Dónde insertar: dentro del seleccionado si lo admite, si no detrás de él, si no al final del cuerpo. */
function target(block: CatalogBlock): { parent: string | null; slot: string; index: number } {
  const sel = state.selected ? findNode(state.document, state.selected) : null;
  if (sel && sel.type !== "#text") {
    const parentBlock = byType.get(sel.type);
    if (parentBlock?.children && accepts(parentBlock.children, block))
      return { parent: sel.id, slot: CHILDREN, index: (sel as ElementNode).children?.length ?? 0 };
    const at = locate(state.document, sel.id);
    if (at) return { parent: at.parent, slot: at.slot, index: at.index + 1 };
  }
  return { parent: null, slot: CHILDREN, index: state.document.body.length };
}

async function insert(block: CatalogBlock) {
  const preset = block.presets[0];
  if (!preset?.node || !state.connection) return;
  const node = withNewIds(preset.node, nextId);
  try {
    await state.connection.request("insert", { node, at: target(block) });
    await state.connection.request("select", { id: node.id });
  } catch (error) {
    status(error instanceof Error ? error.message : String(error));
  }
}

// ── Panel de props desde el JSON Schema ──────────────────────────────────────────────────────────────────────
function field(name: string, schema: JsonSchema, value: JsonValue | undefined, onChange: (v: JsonValue | null) => void): HTMLElement {
  const label = document.createElement("label");
  label.append(name);
  const control = schema["x-control"] ?? "text";
  const values = schema.enum ?? null;
  let input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  if (values) {
    const select = document.createElement("select");
    if (schema.default === undefined) select.append(new Option("—", ""));
    for (const v of values) select.append(new Option(String(v), String(v), false, String(v) === String(value ?? schema.default)));
    select.addEventListener("change", () =>
      onChange(select.value === "" ? null : (values.find((v) => String(v) === select.value) ?? null)),
    );
    input = select;
  } else if (control === "switch") {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.setAttribute("role", "switch");
    box.checked = value === true || (value === undefined && schema.default === true);
    box.addEventListener("change", () => onChange(box.checked));
    input = box;
  } else if (control === "json") {
    const area = document.createElement("textarea");
    area.rows = 3;
    area.value = value === undefined ? "" : JSON.stringify(value);
    area.addEventListener("change", () => {
      try {
        onChange(area.value.trim() ? (JSON.parse(area.value) as JsonValue) : null);
      } catch {
        status(`${name}: JSON no válido`);
      }
    });
    input = area;
  } else {
    const text = document.createElement("input");
    text.type = control === "number" ? "number" : control === "link" || control === "image" ? "url" : "text";
    if (control === "icon") text.setAttribute("list", "icons");
    text.value = value === undefined || value === null ? "" : String(value);
    text.placeholder = schema.default === undefined ? "" : String(schema.default);
    text.addEventListener("change", () => onChange(text.value === "" ? null : control === "number" ? Number(text.value) : text.value));
    input = text;
  }
  input.name = name;
  input.disabled = schema.readOnly === true;
  label.append(input);
  return label;
}

function panel() {
  const form = $("props");
  const node = state.selected ? findNode(state.document, state.selected) : null;
  $("selected").textContent = node ? `${node.type} · ${node.id}` : "Sin selección";
  form.replaceChildren();
  if (!node) return;
  const send = (patch: Parameters<CanvasConnection["request"]>[1]) =>
    state.connection?.request("update", patch as never).catch((error: Error) => status(error.message));
  if (node.type === "#text") {
    form.append(field("text", { type: "string" }, node.text, (v) => send({ id: node.id, text: String(v ?? "") })));
    return;
  }
  const block = byType.get(node.type);
  if (!block) return;
  for (const [name, schema] of Object.entries(block.props.properties))
    form.append(field(name, schema, (node as ElementNode).props?.[name], (v) => send({ id: node.id, props: { [name]: v } })));
  // Texto directo del nodo: un campo por cada nodo de texto hijo.
  for (const child of [...((node as ElementNode).children ?? []), ...Object.values((node as ElementNode).slots ?? {}).flat()])
    if (child.type === "#text")
      form.append(field(`texto (${child.id})`, { type: "string" }, child.text, (v) => send({ id: child.id, text: String(v ?? "") })));
  for (const [key, spec] of Object.entries(catalog.style))
    form.append(
      field(`style.${key}`, { enum: [...(spec.tokens ?? []), ...(spec.keywords ?? [])] }, (node as ElementNode).style?.[key], (v) =>
        send({ id: node.id, style: { [key]: v === null ? null : String(v) } }),
      ),
    );
}

// ── Adaptativo: lo de la clase de vista previa del nodo seleccionado ──────────────────────────────────────────
function adaptivePanel() {
  const form = $("adaptive");
  const cls = state.sizeClass;
  $("adaptive-title").textContent = `Adaptativo · ${cls}`;
  form.replaceChildren();
  const node = state.selected ? findNode(state.document, state.selected) : null;
  if (!node || node.type === "#text") return;
  const block = byType.get(node.type);
  const own = (node as ElementNode).adaptive?.[cls] ?? {};
  const resolved = resolveAdaptive((node as ElementNode).adaptive, cls);
  const adapt = (patch: Record<string, JsonValue | null>) =>
    state.connection?.request("adapt", { id: node.id, sizeClass: cls, patch } as never).catch((e: Error) => status(e.message));
  form.append(
    field("order", { type: "integer", "x-control": "number", default: resolved.order }, own.order, (v) =>
      adapt({ order: v === null ? null : Math.trunc(Number(v)) }),
    ),
  );
  form.append(
    field("hidden", { type: "boolean", "x-control": "switch", default: resolved.hidden ?? false }, own.hidden, (v) => adapt({ hidden: v })),
  );
  const at = locate(state.document, node.id);
  const parent = at?.parent ? findNode(state.document, at.parent) : null;
  const parentBlock = parent ? byType.get(parent.type) : undefined;
  if (parent && parent.type !== "#text" && parentBlock?.adaptive?.layout) {
    const templates = ((parent as ElementNode).props?.templates ?? parentBlock.adaptive.layout.templates) as AdaptiveTemplates;
    const areas = templateAreas(resolveTemplate(templates, cls));
    form.append(field("area", { enum: areas, default: resolved.area }, own.area, (v) => adapt({ area: v })));
    form.append(
      field("span", { type: "integer", "x-control": "number" }, own.span, (v) =>
        adapt({ span: v === null ? null : Math.trunc(Number(v)) }),
      ),
    );
  }
  if (block?.adaptive?.variants)
    form.append(
      field("variant", { enum: block.adaptive.variants.map((v) => v.value), default: resolved.variant }, own.variant, (v) =>
        adapt({ variant: v }),
      ),
    );
}

$<HTMLSelectElement>("size").addEventListener("change", (e) => {
  const value = (e.target as HTMLSelectElement).value;
  state.connection?.request("viewport", { sizeClass: isSizeClass(value) ? value : null }).catch((error: Error) => status(error.message));
});

// ── Marca ──────────────────────────────────────────────────────────────────────────────────────────────────
const brands = $<HTMLSelectElement>("brand");
for (const b of catalog.tokens.brands) brands.append(new Option(b, b, false, b === catalog.tokens.defaultBrand));
let brand = createBrandEditor(catalog.tokens, brands.value);
brands.addEventListener("change", async () => {
  brand = createBrandEditor(catalog.tokens, brands.value);
  await state.connection?.request("theme", { brand: brands.value, tokens: { accent: null } });
});
$<HTMLSelectElement>("theme").addEventListener("change", (e) =>
  state.connection?.request("theme", { theme: (e.target as HTMLSelectElement).value as "dark" | "light" }),
);
$<HTMLInputElement>("accent").addEventListener("input", async (e) => {
  const value = (e.target as HTMLInputElement).value;
  const theme = $<HTMLSelectElement>("theme").value as "dark" | "light";
  const problems = brand.set("accent", value, theme);
  if (problems.length) return status(problems[0]?.message ?? "");
  await state.connection?.request("theme", { tokens: brand.cssVariables(theme) });
  const report = brand.contrast();
  status(
    report.ok ? "Contraste correcto" : `Contraste: ${report.failures.length} pares por debajo del mínimo (${report.failures[0]?.what})`,
  );
});

// ── Exportar ─────────────────────────────────────────────────────────────────────────────────────────────────
$("export").addEventListener("click", () => {
  const html = toHTML(state.document, { catalog });
  $<HTMLTextAreaElement>("html").value = html;
  const page = `<!doctype html>\n<html lang="${state.document.lang ?? "en"}" data-brand="${brands.value}" data-theme="${$<HTMLSelectElement>("theme").value}">\n<head><meta charset="utf-8"><title>${(state.document.title ?? "").replace(/[<&]/g, "")}</title></head>\n<body class="z-root z-canvas">\n${html}\n</body>\n</html>\n`;
  const link = (name: string, blob: Blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.textContent = `Descargar ${name}`;
    return a;
  };
  $("downloads").replaceChildren(
    link("pagina.html", new Blob([page], { type: "text/html" })),
    " · ",
    link("marca.json", new Blob([JSON.stringify(brand.export(), null, 2)], { type: "application/json" })),
  );
  $<HTMLDialogElement>("exported").showModal();
});

// ── Barra ─────────────────────────────────────────────────────────────────────────────────────────────────────
const buttons = () => {
  $<HTMLButtonElement>("undo").disabled = !state.canUndo;
  $<HTMLButtonElement>("redo").disabled = !state.canRedo;
};
$("undo").addEventListener("click", () => state.connection?.request("undo", {}).catch((e: Error) => status(e.message)));
$("redo").addEventListener("click", () => state.connection?.request("redo", {}).catch((e: Error) => status(e.message)));
$("remove").addEventListener(
  "click",
  () => state.selected && state.connection?.request("remove", { id: state.selected }).catch((e: Error) => status(e.message)),
);
const shift = (delta: number) => {
  if (!state.selected) return;
  const at = locate(state.document, state.selected);
  if (!at) return;
  state.connection
    ?.request("move", { id: state.selected, at: { parent: at.parent, slot: at.slot, index: Math.max(0, at.index + (delta > 0 ? 2 : -1)) } })
    .catch((e: Error) => status(e.message));
};
$("up").addEventListener("click", () => shift(-1));
$("down").addEventListener("click", () => shift(1));
$<HTMLInputElement>("filter").addEventListener("input", (e) => palette((e.target as HTMLInputElement).value));
document.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || (e.target as HTMLElement).closest("input, textarea, select")) return;
  e.preventDefault();
  state.connection?.request(e.shiftKey ? "redo" : "undo", {}).catch(() => {});
});

// Lista de iconos para los campos de icono.
const icons = document.createElement("datalist");
icons.id = "icons";
for (const name of catalog.icons) icons.append(new Option(name));
document.body.append(icons);

// ── Conexión ─────────────────────────────────────────────────────────────────────────────────────────────────
const frame = $<HTMLIFrameElement>("canvas");
frame.src = `./canvas.html?editor=${encodeURIComponent(location.origin)}`;
palette();
connectCanvas(frame, { origin: "null", zuix: catalog.zuix })
  .then(async (connection) => {
    state.connection = connection;
    connection.on("changed", (p) => {
      state.document = p.document;
      state.canUndo = p.canUndo;
      state.canRedo = p.canRedo;
      if (state.selected && !findNode(state.document, state.selected)) state.selected = null;
      buttons();
      panel();
      adaptivePanel();
      status(p.warnings.length ? `Avisos: ${p.warnings.map((w) => w.message).join("; ")}` : `Cambio: ${p.reason}`);
    });
    connection.on("selected", (p) => {
      state.selected = p.id;
      panel();
      adaptivePanel();
    });
    connection.on("viewportChanged", (p) => {
      state.sizeClass = p.sizeClass;
      adaptivePanel();
    });
    connection.on("error", (p) => status(`Error: ${p.message}`));
    await connection.request("load", { document: state.document });
    await connection.request("viewport", {});
    document.documentElement.dataset.editorReady = "";
  })
  .catch((error: Error) => status(error.message));

export type { PageNode };
