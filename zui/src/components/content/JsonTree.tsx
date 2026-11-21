"use client";
import { useMemo, useState, type ReactNode } from "react";
import { announceText, copyText } from "../../core/clipboard";
import { jsonNodes, type JsonNode } from "../../core/json-tree";
import { idsToDepth } from "../../core/tree";
import { cx } from "../../cx";
import { Tree, type TreeNode } from "../navigation/Tree";

export interface JsonTreeProps {
  /** Valor que se muestra: objetos, arrays, Map, Set, fechas, bigint, cadenas, números… */
  value: unknown;
  /** Nombre accesible del árbol. */
  label?: string;
  /** Profundidad expandida al montar (1 = solo la raíz; 0 = todo plegado). */
  defaultExpandDepth?: number;
  /** Longitud máxima de una cadena antes de truncarla (el texto completo queda en `title`). */
  maxStringLength?: number;
  /** Nombre de la raíz en las rutas (`$`). */
  rootName?: string;
  /** Activar un nodo (clic, Intro): su ruta y su valor. */
  onSelect?: (path: string, value: unknown) => void;
  /** Activar un nodo copia su ruta al portapapeles y lo anuncia. */
  copyPath?: boolean;
  /** Anuncio al copiar («Copied {path}»). */
  copiedLabel?: string;
  className?: string;
}

function labelOf(node: JsonNode): ReactNode {
  return (
    <>
      {node.key !== null ? (
        <>
          <span className="z-jsontree__key">{node.key}</span>
          <span className="z-jsontree__sep">: </span>
        </>
      ) : null}
      <span className="z-jsontree__value" data-type={node.kind} title={node.full}>
        {node.preview}
      </span>
    </>
  );
}

const toTree = (nodes: JsonNode[]): TreeNode[] =>
  nodes.map((node) => ({ id: node.id, label: labelOf(node), children: node.children?.length ? toTree(node.children) : undefined }));

/** Visor de JSON (y de valores de JavaScript) como árbol: tipos con color, profundidad inicial, Map y Set, cadenas
 *  largas truncadas y copia de la ruta. El teclado es el de Tree. */
export function JsonTree({
  value,
  label = "JSON",
  defaultExpandDepth = 1,
  maxStringLength,
  rootName,
  onSelect,
  copyPath,
  copiedLabel = "Copied {path}",
  className,
}: JsonTreeProps) {
  const nodes = useMemo(() => jsonNodes(value, { maxStringLength, rootName }), [value, maxStringLength, rootName]);
  const byId = useMemo(() => {
    const map = new Map<string, JsonNode>();
    const walk = (list: JsonNode[]) => {
      for (const node of list) {
        map.set(node.id, node);
        walk(node.children ?? []);
      }
    };
    walk(nodes);
    return map;
  }, [nodes]);
  const [expanded] = useState(() => idsToDepth(nodes, defaultExpandDepth));
  const [message, setMessage] = useState("");
  return (
    <div className={cx("z-jsontree", className)}>
      <Tree
        label={label}
        nodes={toTree(nodes)}
        defaultExpanded={expanded}
        onSelect={(id) => {
          const node = byId.get(id);
          onSelect?.(id, node?.value);
          if (copyPath)
            void copyText(id).then((ok) => {
              if (ok) setMessage(announceText(copiedLabel.replace("{path}", id)));
            });
        }}
      />
      {copyPath ? (
        <span className="z-sr-only" role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}
