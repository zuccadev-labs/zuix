// Cabecera del documento: el primer párrafo tras el título `#` es la entradilla (clase `zd-lead`) y detrás va
// la línea de metadatos (`<DocMeta />`: actualización y tiempo de lectura). Así la entradilla no se repite en
// el front matter y un documento normal, sin marcas especiales, ya tiene la cabecera completa.
export default function remarkLead() {
  return (tree) => {
    const title = tree.children.findIndex((n) => n.type === "heading" && n.depth === 1);
    if (title < 0) return;
    let at = title + 1;
    const next = tree.children[at];
    if (next?.type === "paragraph" && !next.children.every((c) => c.type === "image")) {
      next.data = { ...next.data, hProperties: { ...next.data?.hProperties, className: ["zd-lead"] } };
      at += 1;
    }
    tree.children.splice(at, 0, { type: "mdxJsxFlowElement", name: "DocMeta", attributes: [], children: [] });
  };
}
