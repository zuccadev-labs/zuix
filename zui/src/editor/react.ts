// @zuccadev-labs/zuix-zui/editor/react — el documento de página como elementos de React (18.2+ y 19).
//
// Los bloques de solo marcado (los `template` del conector) salen con el mismo árbol que toHTML, así que el marcado
// de servidor y el del cliente coinciden con html.json. Un bloque con componente en `components` sale con su
// componente (props, huecos como ReactNode y `style` de tokens): así se usa el binding para lo que tiene
// comportamiento propio. Los bloques `preset` salen con su marcado estático (su comportamiento, con zui/dom).
// Sin hooks ni manejadores: se puede llamar desde un Server Component.

import { type ComponentType, Fragment, type ReactElement, type ReactNode, createElement } from "react";
import type { VNode } from "../core/vnode";
import { BUILTIN_BLOCKS } from "./blocks";
import { type BlockSpec, type HtmlOptions, type RawHtml, RenderError, registry, styleOf, toTrees, withDefaults, decorate } from "./render";
import { CHILDREN, slotOf } from "./tree";
import { type PageDocument, type PageNode, isText } from "./types";

export interface ReactOptions extends HtmlOptions {
  /**
   * Componentes por tipo. Con `{ ...zui, ...zout }` (los módulos de `@zuccadev-labs/zuix-zui` y `-zout`) cada bloque
   * sale con su componente; sin él, los bloques `template` salen con su marcado y los `none` fallan.
   */
  components?: Record<string, unknown>;
}

const ATTR: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  readonly: "readOnly",
  colspan: "colSpan",
  rowspan: "rowSpan",
};

type Ctx = { blocks: Map<string, BlockSpec>; o: ReactOptions };

function toElement(node: VNode | RawHtml, key: string | number, ctx: Ctx): ReactNode {
  if (node === null || node === undefined || node === false) return null;
  if (typeof node === "string") return node;
  if ("slot" in node) {
    if ((node.slot as string) === "react") return one((node as unknown as { p: { node: PageNode } }).p.node, ctx.blocks, ctx.o);
    if (node.slot === "html") {
      // Marcado fijo del contrato (bloques `preset`), no texto de la aplicación.
      return createElement("div", {
        key,
        className: "z-editor-preset",
        style: { display: "contents" },
        dangerouslySetInnerHTML: { __html: node.html },
      });
    }
    if (node.slot === "icon")
      return createElement("z-icon", {
        key,
        name: String(node.p.name),
        size: String(node.p.size),
        ...(node.p.variant === "solid" ? { variant: "solid" } : {}),
      });
    return null;
  }
  const props: Record<string, unknown> = { key };
  for (const [k, v] of Object.entries(node.a ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    // Un elemento personalizado (z-icon) recibe los atributos tal cual.
    props[node.t.includes("-") ? k : (ATTR[k] ?? k)] = v === true ? "" : v;
  }
  if (node.s) props.style = { ...node.s };
  const kids = (node.c ?? []).map((c, i) => toElement(c as VNode | RawHtml, i, ctx));
  return createElement(node.t, props, ...(kids.length ? kids : []));
}

/** El documento como un elemento de React (un fragmento con los bloques del cuerpo). */
export function toReact(doc: PageDocument, o: ReactOptions = {}): ReactElement {
  const blocks = registry([...BUILTIN_BLOCKS, ...(o.blocks ?? [])]);
  return createElement(Fragment, null, ...nodes(doc.body, blocks, o));
}

function nodes(list: readonly PageNode[], blocks: Map<string, BlockSpec>, o: ReactOptions): ReactNode[] {
  return list.map((node) => one(node, blocks, o));
}

function one(node: PageNode, blocks: Map<string, BlockSpec>, o: ReactOptions): ReactNode {
  if (isText(node)) return node.text;
  const component = o.components?.[node.type] as ComponentType<Record<string, unknown>> | undefined;
  const block = o.catalog?.blocks.find((b) => b.type === node.type);
  if (
    component &&
    (typeof component === "function" || typeof component === "object") &&
    block?.html !== "preset" &&
    block?.package !== "core"
  ) {
    const props: Record<string, unknown> = { key: node.id, ...node.props };
    for (const [name, list] of Object.entries(node.slots ?? {})) props[name] = createElement(Fragment, null, ...nodes(list, blocks, o));
    const style = styleOf(node.style, o.catalog?.style);
    if (Object.keys(style).length) props.style = style;
    const kids = slotOf(node, CHILDREN);
    return createElement(component, props, ...(kids.length ? nodes(kids, blocks, o) : []));
  }
  const spec = blocks.get(node.type);
  if (!spec) {
    if (block?.html !== "preset")
      throw new RenderError(`${node.type} «${node.id}»: sin componente en \`components\` ni marcado propio`, node.id);
    const [tree] = toTrees([node], blocks, o);
    return toElement(tree as RawHtml, node.id, { blocks, o });
  }
  // Bloque de marcado: el mismo árbol que toHTML; cada hijo es un hueco que se resuelve aquí (con su componente si lo hay).
  const hole = (list: PageNode[]) =>
    list.map((child) => (isText(child) ? child.text : ({ slot: "react", p: { node: child } } as unknown as VNode)));
  const el = spec.render({
    props: withDefaults(spec, node.props, o.catalog),
    children: hole(slotOf(node, CHILDREN)),
    slot: (name) => hole(slotOf(node, name)),
    has: (name) => slotOf(node, name).length > 0,
    text: slotOf(node)
      .map((c) => (isText(c) ? c.text : ""))
      .join(""),
    id: node.id,
  });
  return toElement(decorate(el, node, o), node.id, { blocks, o });
}
