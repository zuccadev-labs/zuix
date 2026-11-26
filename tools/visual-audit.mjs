#!/usr/bin/env node
// Auditoría visual y funcional: mide en un navegador real lo que la auditoría de estilo (tools/audit.mjs) no
// puede ver en el código fuente. Recorre páginas × marcas × temas × anchos y comprueba:
//
//   desbordamiento   horizontal del documento y elementos que se salen del viewport sin contenedor que desplace
//   recorte          texto cortado (scrollWidth > clientWidth) sin elipsis ni line-clamp
//   tapado           texto que otra capa tapa a medias (dentro de lo que sus contenedores dejan ver, en los dos ejes)
//   cortes           tira o tabla que desplaza y corta un texto en seco sin fundido; fila flex que pasa de su borde;
//                    pieza que sale de la caja de su padre; fila de controles apilados uno por línea; dato (fecha,
//                    código) partido en dos líneas; nombre corto cortado con elipsis
//   trazos           letras que pisan o rozan el trazo de un SVG de su componente (cifras de una esfera, arco)
//   carrusel         lente cortada en seco o con sangrado vacío; slide activo fuera del centro; mazo plano
//   teléfono         navegación lateral acoplada que se come el ancho del contenido
//   solape           elementos interactivos que se pisan
//   fuente           familia computada fuera de la marca, fuente que no cargó y fuente real del sistema
//                    (CSS.getPlatformFontsForNode del protocolo de depuración: qué tipografía pinta de verdad) y
//                    texto que una transformación deja por debajo de 9 px en pantalla (lienzo con poco zoom)
//   escala           tamaño, interlineado y peso fuera de los tokens; márgenes, rellenos y huecos fuera de
//                    --z-space-* (±0,5 px); radios fuera de la familia de radios; alturas de control fuera de
//                    --z-control-height-* (24/28/34/40/48 o el objetivo táctil con puntero grueso)
//   píldora          radius-full en un control que no es circular
//   alineación       controles de una misma fila con alturas distintas, iconos descentrados en su botón y huecos
//                    desiguales entre hermanos de un grupo
//   icono-desalineado icono que comparte línea con un texto y cuyo centro vertical se aparta del de esa línea más
//                    de 1 px (1,5 px si mide más de 20): botón, enlace, chip, menú, alerta, encabezado, sidebar…
//   foco             contorno visible en cada parada de Tab y contraste ≥ 3:1 contra lo que tiene detrás
//   objetivo         objetivo táctil ≥ 24×24 (≥ 40 con puntero grueso)
//   axe              WCAG 2.2 A/AA con contraste de color
//   consola y red    errores de página, de consola y peticiones fallidas
//
// Uso (desde la raíz; antes `pnpm check` y, para el sitio, el build de zudocs):
//   pnpm audit:visual [--target site,app,html] [--brands dazlabs,zutool,zenith] [--themes dark,light]
//                     [--widths 1440,768,390] [--filter <texto>[,<texto>…]] [--out <carpeta>] [--shots] [--no-axe]
//                     [--dir rtl]
//                     [--site <carpeta compilada>] [--base /ruta/] [--max <n páginas>] [--report]
//   AUDIT_OUT=<carpeta>  carpeta de salida (por defecto .tmp/visual-audit, fuera del control de versiones)
//   --report             reclasifica el último raw.json sin abrir el navegador (para afinar los detectores)
//
// Salida: <out>/raw.json (medidas), <out>/report.json y <out>/report.md (defectos por tipo y por componente),
// <out>/shots/ con --shots. Sale con código 1 si queda algún defecto clasificado como real.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import net from "node:net";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i < 0 ? fallback : argv.splice(i, 2)[1];
};
const flag = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return false;
  argv.splice(i, 1);
  return true;
};
const list = (v) =>
  String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const targets = list(opt("--target", "site,app,html"));
const brands = list(opt("--brands", "dazlabs,zutool,zenith"));
const themes = list(opt("--themes", "dark,light"));
const widths = list(opt("--widths", "1440,768,390")).map(Number);
const filter = opt("--filter")?.toLowerCase();
const out = resolve(opt("--out", process.env.AUDIT_OUT ?? join(root, ".tmp/visual-audit")));
const siteDir = resolve(opt("--site", join(root, "zudocs/build")));
const baseArg = opt("--base");
const maxPages = Number(opt("--max", "0")) || Number.POSITIVE_INFINITY;
const shots = flag("--shots");
const noAxe = flag("--no-axe");
// --dir rtl: cada página de derecha a izquierda (`dir` en <html> antes de medir).
const dir = opt("--dir", "ltr") === "rtl" ? "rtl" : "ltr";
const reportOnly = flag("--report");
const concurrency = Number(opt("--jobs", "4")) || 4;
mkdirSync(out, { recursive: true });

// ── Tokens: nombres del contrato, leídos del CSS generado ──────────────────────────────────────────────
const tokenCss = readFileSync(join(root, "tokens/dist/tokens.css"), "utf8");
const tokenNames = [...new Set(tokenCss.match(/--z-[a-z0-9-]+(?=\s*:)/g))];
const pick = (re) => tokenNames.filter((n) => re.test(n));
const TOKENS = {
  space: pick(/^--z-(space-|docs-gutter|docs-gap)/),
  text: pick(/^--z-text-(fine|caption|small|body|code|reading|lead|title|heading|heading-lg|display|display-sm|display-lg|hero)$/),
  leading: pick(/^--z-leading-/),
  weight: pick(/^--z-weight-/),
  radius: pick(/radius/),
  height: pick(/^--z-(control-height-|touch-target|calendar-cell$|docs-navbar-height|header-height)/),
};
// Familias por marca: primera familia de cada pila (sans, display, mono), leída de las marcas.
const FAMILIES = {};
for (const b of ["dazlabs", "zutool", "zenith"]) {
  const brand = JSON.parse(readFileSync(join(root, `tokens/brands/${b}.json`), "utf8"));
  FAMILIES[b] = Object.values(brand.fonts).flatMap((stack) =>
    stack
      .split(",")
      .slice(0, 2)
      .map((f) => f.trim().replace(/^"|"$/g, ""))
      .filter((f) => !/^(ui-|system-ui|-apple|sans-serif|monospace|serif)/.test(f)),
  );
}

// Familia principal de cada pila: la que debe cargar (las siguientes son alternativas).
const FIRST = {};
for (const b of ["dazlabs", "zutool", "zenith"]) {
  const brand = JSON.parse(readFileSync(join(root, `tokens/brands/${b}.json`), "utf8"));
  FIRST[b] = [...new Set(Object.values(brand.fonts).map((stack) => stack.split(",")[0].trim().replace(/^"|"$/g, "")))];
}

// ── Recolector que corre dentro de la página ────────────────────────────────────────────────────────────
// Devuelve medidas en bruto, deduplicadas por firma (etiqueta + clases z- + atributos de variante). La
// clasificación (qué es defecto) vive en Node, para poder afinarla sin volver a abrir el navegador.
function collect({ TOKENS, families, coarse }) {
  const vw = document.documentElement.clientWidth;
  const vh = innerHeight;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;inset-block-start:0;inset-inline-start:0";
  document.body.append(probe);
  const px = (prop, name) => {
    probe.style.setProperty(prop, `var(${name})`);
    const v = Number.parseFloat(
      getComputedStyle(probe)[prop === "border-radius" ? "borderTopLeftRadius" : prop.replace(/-(.)/g, (_, c) => c.toUpperCase())],
    );
    probe.style.removeProperty(prop);
    return v;
  };
  const raw = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const scale = {
    space: [...new Set(TOKENS.space.map((n) => px("width", n)).filter(Number.isFinite))],
    text: [...new Set(TOKENS.text.map((n) => px("font-size", n)).filter(Number.isFinite))],
    leading: [...new Set(TOKENS.leading.map((n) => Number.parseFloat(raw(n))).filter(Number.isFinite))],
    weight: [...new Set(TOKENS.weight.map((n) => Number.parseFloat(raw(n))).filter(Number.isFinite))],
    radius: [...new Set(TOKENS.radius.map((n) => px("width", n)).filter((v) => Number.isFinite(v) && v < 999))],
    height: [...new Set(TOKENS.height.map((n) => px("height", n)).filter(Number.isFinite))],
  };
  probe.remove();

  const visible = (el, r = el.getBoundingClientRect()) => {
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    if (el.closest("[hidden],[inert],.zd-sr-only,.z-sr-only")) return false;
    // Contenido de un <details> cerrado, content-visibility o un antecesor invisible
    if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true }))
      return false;
    // sr-only: recorte de 1px
    if (r.width <= 1 || r.height <= 1) return false;
    return true;
  };
  const sig = (el) => {
    const cls = String(el.getAttribute("class") ?? "")
      .split(/\s+/)
      .filter((c) => /^(z|zd)-/.test(c))
      .slice(0, 3)
      .join(".");
    const attrs = ["data-size", "data-variant", "data-tone", "role"]
      .map((a) => (el.hasAttribute(a) ? `[${a}=${el.getAttribute(a)}]` : ""))
      .join("");
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}${attrs}`;
  };
  // Componente al que pertenece: primer ancestro (o él mismo) con clase z-<bloque> (sin __ ni --).
  const owner = (el) => {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const c = String(p.getAttribute?.("class") ?? "")
        .split(/\s+/)
        .find((x) => /^z-[a-z0-9-]+$/.test(x) && !/^z-(root|liquid|solid|sr-only|stack|row)$/.test(x));
      if (c) return c;
    }
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const c = String(p.getAttribute?.("class") ?? "")
        .split(/\s+/)
        .find((x) => /^zd-[a-z0-9-]+$/.test(x));
      if (c) return c;
    }
    return "(página)";
  };
  const path = (el) => {
    const parts = [];
    for (let p = el; p && p !== document.body && parts.length < 4; p = p.parentElement) parts.unshift(sig(p));
    return parts.join(" > ");
  };
  const found = new Map();
  const add = (type, el, detail, extra = {}) => {
    const key = `${type}|${sig(el)}|${detail}`;
    const prev = found.get(key);
    if (prev) prev.count += 1;
    else
      found.set(key, {
        type,
        sig: sig(el),
        owner: owner(el),
        detail,
        path: path(el),
        count: 1,
        // Dentro de un lienzo de nodos: su contenido vive en un plano con zoom bajo controles flotantes.
        canvas: !!el.closest(".z-node-canvas"),
        world: !!el.closest(".z-node-canvas__world"),
        ...extra,
      });
  };
  const near = (v, set, tol = 0.5) => set.some((s) => Math.abs(s - v) <= tol);
  // Margen lateral fluido de Container (token `container-gutter`, un clamp() entre dos px). Solo cuenta si el margen
  // del elemento sale de ese token, y dentro de sus dos límites.
  const gutter = getComputedStyle(document.documentElement).getPropertyValue("--z-container-gutter").trim();
  const gutterBounds = /^clamp\(\s*([\d.]+)px\s*,.+,\s*([\d.]+)px\s*\)$/.exec(gutter)?.slice(1).map(Number);
  const all = [...document.body.querySelectorAll("*")].filter(
    (el) => !(el instanceof SVGElement) && !["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "BR", "Z-ICON"].includes(el.tagName),
  );
  const rects = new Map();
  for (const el of all) rects.set(el, el.getBoundingClientRect());
  const shown = all.filter((el) => visible(el, rects.get(el)));
  const ownText = (el) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join("")
      .trim();
  const INTERACTIVE =
    "a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=menuitem],[role=option],[role=checkbox],[role=radio],[role=switch],[role=slider],[role=combobox],[role=spinbutton],[role=gridcell][tabindex],[tabindex]:not([tabindex='-1'])";
  const isControlBox = (el, cs) =>
    el.matches(
      "button,a.z-btn,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=color]):not([type=file]),select,[role=combobox],[role=spinbutton],[role=tab],[class*='__trigger'],[class*='__control'],.z-input,.z-select,.z-chip,.z-segmented__item,.z-btn",
    ) &&
    (Number.parseFloat(cs.borderTopWidth) > 0 ||
      (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") ||
      cs.backgroundImage !== "none");
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) return true;
      if (cs.position === "fixed") return false;
    }
    return false;
  };

  // 1. Desbordamiento
  const de = document.documentElement;
  const docOver = Math.max(de.scrollWidth, document.body.scrollWidth) - de.clientWidth;
  if (docOver > 1) add("desbordamiento-documento", document.body, `${docOver}px`);
  for (const el of shown) {
    const r = rects.get(el);
    if ((r.right > vw + 1 || r.left < -1) && !inScroller(el)) {
      const parent = el.parentElement;
      const pr = parent && rects.get(parent);
      if (pr && (pr.right > vw + 1 || pr.left < -1) && parent !== document.body) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" && (r.left >= vw || r.right <= 0)) continue; // fuera de pantalla a propósito (cajón cerrado)
      add("desbordamiento-elemento", el, `x ${Math.round(r.left)}–${Math.round(r.right)} (viewport ${vw})`);
    }
  }

  // 2. Texto recortado
  for (const el of shown) {
    if (el.matches("input,textarea,select,pre,code,[role=textbox],[contenteditable]")) continue;
    const text = ownText(el);
    if (!text) continue;
    const cs = getComputedStyle(el);
    const clipsX = /(hidden|clip)/.test(cs.overflowX);
    const clipsY = /(hidden|clip)/.test(cs.overflowY);
    const clampLines = cs.webkitLineClamp && cs.webkitLineClamp !== "none";
    if (clipsX && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== "ellipsis")
      add("texto-recortado", el, `ancho ${el.scrollWidth} > ${el.clientWidth}`, { text: text.slice(0, 40) });
    else if (clipsY && !clampLines && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 4)
      add("texto-recortado", el, `alto ${el.scrollHeight} > ${el.clientHeight}`, { text: text.slice(0, 40) });
    else if (clipsX && cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1)
      add("elipsis", el, "texto con elipsis", { text: text.slice(0, 40) });
  }

  // 2b. Texto tapado o cortado desde fuera de su caja:
  //   - tapado: otro elemento con fondo (una cabecera pegajosa, una capa) pinta encima de una parte del texto;
  //   - cortado por un antecesor que no desplaza (overflow hidden/clip): se ve solo una parte;
  //   - lo seleccionado (pestaña activa, item actual) a medias dentro de una tira con desplazamiento.
  const alphaOf = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return 0;
    const parts = m[1].split(/[ ,/]+/).filter(Boolean);
    return parts.length > 3 ? Number.parseFloat(parts[3]) : 1;
  };
  for (const el of shown) {
    const text = ownText(el);
    if (!text || el.matches("input,textarea,select,option")) continue;
    const r = rects.get(el);
    // Cortado por un antecesor
    let hidden = false;
    let scrolledOut = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (!/(auto|scroll|hidden|clip)/.test(ps.overflowX + ps.overflowY)) continue;
      const q = p.getBoundingClientRect();
      if (q.width <= 1 || q.height <= 1) break; // sr-only y similares
      const cut = r.left < q.left - 1 || r.right > q.right + 1 || r.top < q.top - 1 || r.bottom > q.bottom + 1;
      const inside = r.right > q.left && r.left < q.right && r.bottom > q.top && r.top < q.bottom;
      const scroller = /(auto|scroll)/.test(ps.overflowX + ps.overflowY);
      // Fuera de la vista de un contenedor con desplazamiento: contenido desplazado, no recortado.
      if (scroller && cut && !inside) break;
      if (!cut || !inside) continue;
      // Un recorte sin desplazamiento dentro de algo que sí desplaza (cabecera sincronizada de una rejilla, tira de
      // pestañas) es el mismo desplazamiento: cuenta como tal.
      if (!scroller) {
        let outer = p.parentElement;
        while (
          outer &&
          outer !== document.body &&
          !/(auto|scroll)/.test(getComputedStyle(outer).overflowX + getComputedStyle(outer).overflowY)
        )
          outer = outer.parentElement;
        const o = outer && outer !== document.body ? outer.getBoundingClientRect() : null;
        if (o && (r.left < o.left - 1 || r.right > o.right + 1 || r.top < o.top - 1 || r.bottom > o.bottom + 1)) {
          scrolledOut = true;
          break;
        }
      }
      // Un recorte con fundido (máscara) indica a propósito que hay más: colapso parcial, desvanecido de una tira.
      if (ps.maskImage !== "none" || ps.webkitMaskImage !== "none") break;
      if (/(auto|scroll)/.test(ps.overflowX + ps.overflowY)) {
        scrolledOut = true;
        // Un contenedor que desborda menos de dos filas no es una lista larga: le falta alto, y la última fila
        // queda cortada a media altura sin que nada invite a desplazar.
        const extraY = p.scrollHeight - p.clientHeight;
        const extraX = p.scrollWidth - p.clientWidth;
        const row = el.closest("a,button,li,[role=option],[role=treeitem],[role=menuitem],[role=row]")?.getBoundingClientRect() ?? r;
        // Un panel del alto de la pantalla (barra lateral, índice) con una lista larga desplaza como debe; el código
        // y los comandos desplazan en horizontal a propósito.
        const panel = q.height >= vh * 0.4;
        const mono = /mono/i.test(getComputedStyle(el).fontFamily) || el.closest("pre,code");
        const short =
          (!panel &&
            extraY > 0 &&
            extraY < Math.max(r.height, Math.min(row.height, 48)) * 2 &&
            (r.top < q.top - 1 || r.bottom > q.bottom + 1)) ||
          // Una región con desplazamiento declarada (role=region, enfocable) desplaza en horizontal a propósito: tablas.
          (!mono &&
            !p.matches("[role=region],[tabindex]") &&
            extraX > 0 &&
            extraX < r.width * 0.5 &&
            (r.left < q.left - 1 || r.right > q.right + 1));
        if (short)
          add("contenedor-justo", el, `${sig(p)} desborda ${Math.round(Math.max(extraY, extraX))} px y corta este texto`, {
            text: text.slice(0, 40),
          });
      } else hidden = true;
      break;
    }
    // Un evento mide lo que dura, una diapositiva puede asomar a medias, en una marquesina los elementos entran y
    // salen por el borde (cuál queda cortado depende del fotograma) y un lienzo de nodos recorta lo que queda fuera de
    // la vista (se ve desplazando): su texto cortado es parte del diseño.
    const byDesign = el.closest(".z-event,.z-carousel__slide,.z-marquee__viewport,.z-node-canvas__world");
    if (hidden && !byDesign && !/ellipsis/.test(getComputedStyle(el).textOverflow))
      add("texto-cortado-antecesor", el, "cortado por un antecesor sin desplazamiento", { text: text.slice(0, 40) });
    // Lo seleccionado de una tira: no un panel de pestañas activo, que es contenido corriente.
    const current = el.closest(
      "[aria-selected='true'],[aria-current]:not([aria-current='false']),[data-state='active']:not([role=tabpanel])",
    );
    if (scrolledOut && current)
      add("seleccionado-a-medias", el, `${sig(current)} visible a medias en su tira con desplazamiento`, { text: text.slice(0, 40) });
  }

  // Elipsis con espacio libre: un texto truncado con elipsis cuando su fila (o la tira que la contiene) tiene hueco
  // libre para lo que esconde, o cuando es el elemento activo y sus hermanos podrían ceder ese espacio (una pestaña
  // activa en «Fo…» mientras una inactiva ocupa su ancho completo).
  const flexRow = (n) => n && /flex/.test(getComputedStyle(n).display) && !/column/.test(getComputedStyle(n).flexDirection);
  const freeIn = (box) => {
    const bs = getComputedStyle(box);
    const inner = box.clientWidth - Number.parseFloat(bs.paddingLeft) - Number.parseFloat(bs.paddingRight);
    const kids = [...box.children].filter((k) => k.getBoundingClientRect().width > 0 && getComputedStyle(k).position !== "absolute");
    const used =
      kids.reduce((sum, k) => sum + k.getBoundingClientRect().width, 0) +
      Math.max(0, kids.length - 1) * (Number.parseFloat(bs.columnGap) || 0);
    return Math.max(0, inner - used);
  };
  for (const el of shown) {
    const es = getComputedStyle(el);
    if (es.textOverflow !== "ellipsis" || el.scrollWidth <= el.clientWidth + 1 || !el.textContent.trim()) continue;
    const hidden = el.scrollWidth - el.clientWidth;
    // Si es parte de lo activo (una pestaña), la fila que cuenta es la de sus hermanos (la tira), no su botón.
    // Lo activo de una tira (pestaña, item actual), no un día marcado como hoy (aria-current="date").
    const current = el.closest("[data-selected],[aria-selected='true'],[aria-current='page'],[aria-current='true'],[data-state='active']");
    // Lo activo cuenta como pieza de una tira solo si es un elemento de una fila flex (pestaña en su lista).
    const tab = current ? (current.parentElement?.closest("[data-selected]") ?? current) : null;
    const inStrip =
      tab && flexRow(tab.parentElement) && tab.parentElement.children.length > 1 && getComputedStyle(tab).position !== "absolute";
    let item = inStrip ? tab : el;
    while (item.parentElement && !(flexRow(item.parentElement) && item.parentElement.children.length > 1) && item !== document.body)
      item = item.parentElement;
    const row = item.parentElement;
    if (!row || row === document.body) continue;
    // Piezas colocadas a mano (eventos de una rejilla de tiempo) o filas que parten línea: el ancho no se reparte.
    if (getComputedStyle(item).position === "absolute" || getComputedStyle(row).flexWrap !== "nowrap") continue;
    let free = freeIn(row);
    if (flexRow(row.parentElement)) free += freeIn(row.parentElement);
    const active = Boolean(inStrip);
    let give = 0;
    if (active)
      for (const sib of row.children) {
        if (sib === item || getComputedStyle(sib).position === "absolute") continue;
        const w = sib.getBoundingClientRect().width;
        const min = Math.max(Number.parseFloat(getComputedStyle(sib).minWidth) || 0, 40);
        give += Math.max(0, w - min);
      }
    if (free + give >= hidden)
      add(
        "elipsis-con-espacio",
        el,
        `esconde ${Math.round(hidden)} px con ${Math.round(free)} px libres${give ? ` y ${Math.round(give)} que pueden ceder sus hermanos` : ""}`,
        {
          text: el.textContent.trim().slice(0, 40),
        },
      );
  }

  // Palabra partida en mitad: un salto de línea entre dos letras de la misma palabra, sin guion, porque la caja
  // permite partir en cualquier punto (`overflow-wrap: anywhere | break-word`, `word-break: break-all`). Se mide
  // con un rango por letra: si la siguiente letra de la palabra empieza más abajo, la palabra se partió.
  const LETTER = /[\p{L}\p{N}_]/u;
  for (const el of shown) {
    const st = getComputedStyle(el);
    if (!/anywhere|break-word/.test(st.overflowWrap) && !/break-all|break-word/.test(st.wordBreak)) continue;
    if (st.hyphens === "auto") continue;
    for (const node of el.childNodes) {
      if (node.nodeType !== 3) continue;
      const t = node.textContent;
      if (t.length < 2 || t.length > 600) continue;
      const range = document.createRange();
      let prevTop = null;
      let prevLetter = false;
      let split = null;
      let token = "";
      for (let i = 0; i < t.length && !split; i++) {
        const letter = LETTER.test(t[i]);
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const box = range.getClientRects()[0];
        if (!box) {
          prevLetter = false;
          continue;
        }
        if (letter && prevLetter && prevTop !== null && box.top > prevTop + box.height / 2) {
          let a = i;
          let b = i;
          while (a > 0 && LETTER.test(t[a - 1])) a--;
          while (b < t.length && LETTER.test(t[b])) b++;
          split = `${t.slice(a, i)}/${t.slice(i, b)}`;
          let c = i;
          let d = i;
          while (c > 0 && /\S/.test(t[c - 1])) c--;
          while (d < t.length && /\S/.test(t[d])) d++;
          token = t.slice(c, d);
        }
        prevTop = box.top;
        prevLetter = letter;
      }
      // Un código largo sin espacios (atributos, una ruta) más ancho que la línea solo puede partirse.
      if (split && token && token.length > 30)
        add("token-partido", el, `código largo partido «${token.slice(0, 40)}»`, { text: t.trim().slice(0, 40) });
      else if (split) add("palabra-partida", el, `salto dentro de una palabra sin guion «${split}»`, { text: t.trim().slice(0, 40) });
    }
  }

  // Valor cortado: un campo de una línea cuyo valor corto (un número, un código) no cabe en su caja. Un texto largo
  // que el usuario escribe puede desplazar dentro del campo; un valor de hasta 12 caracteres tiene que verse entero.
  for (const el of shown) {
    if (!el.matches("input:not([type=checkbox],[type=radio],[type=range],[type=color],[type=file],[type=hidden])")) continue;
    const v = el.value ?? "";
    if (!v || v.length > 12 || el.scrollWidth <= el.clientWidth + 1) continue;
    add("valor-cortado", el, `el valor «${v}» pide ${el.scrollWidth} px y el campo deja ${el.clientWidth}`, { text: v });
  }

  // Tapado: se recorre la página por tramos de una pantalla y en cada tramo se mira, en lo alto y en lo bajo de
  // cada texto que cabe entero, qué pinta encima. Lo pegajoso o fijo de la propia página (la barra del sitio) no
  // cuenta: tapa al desplazar, como debe; lo pegajoso dentro de un contenedor con desplazamiento sí (una cabecera
  // de rejilla que se come la primera hora).
  const pageChrome = (hit) => {
    for (let p = hit; p && p !== document.body; p = p.parentElement) {
      const pos = getComputedStyle(p).position;
      if (pos !== "sticky" && pos !== "fixed") continue;
      if (pos === "fixed") return true;
      for (let q = p.parentElement; q && q !== document.body; q = q.parentElement)
        if (/(auto|scroll)/.test(getComputedStyle(q).overflowY + getComputedStyle(q).overflowX)) return false;
      return true;
    }
    return false;
  };
  const texts = shown.filter((el) => ownText(el) && !el.matches("input,textarea,select,option"));
  const stickies = shown.filter((el) => {
    const cs = getComputedStyle(el);
    return cs.position === "sticky" && cs.pointerEvents === "none";
  });
  const done = new Set();
  const total = Math.min(document.documentElement.scrollHeight, 20000);
  for (let y = 0; y < total; y += Math.max(200, vh * 0.8)) {
    scrollTo(0, y);
    for (const el of texts) {
      if (done.has(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > vh || r.right <= 0 || r.left >= vw) continue;
      done.add(el);
      // Varios puntos a lo ancho del texto: lo que tapa puede estar en el centro (un separador pegajoso centrado) y no al
      // principio de la línea.
      // A lo ancho de las letras, no de la caja: un bloque a todo el ancho con un título corto no está tapado por lo que
      // ocupa su hueco libre (el botón de ampliar en la esquina de una tarjeta).
      let ink = r;
      {
        let left = Number.POSITIVE_INFINITY;
        let right = Number.NEGATIVE_INFINITY;
        for (const node of el.childNodes) {
          if (node.nodeType !== 3 || !node.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const b = range.getBoundingClientRect();
          if (b.width > 0) {
            left = Math.min(left, b.left);
            right = Math.max(right, b.right);
          }
        }
        if (right > left) ink = { left, width: right - left };
      }
      const xs = [0.1, 0.5, 0.9].map((f) => Math.min(Math.max(ink.left + Math.min(ink.width * f, ink.width - 2), 0), vw - 1));
      const paints = (hit) => {
        const hs = getComputedStyle(hit);
        return alphaOf(hs.backgroundColor) >= 0.5 || hs.backdropFilter !== "none";
      };
      // Solo cuenta si lo tapado es una parte: entero debajo de una cabecera es contenido que se desplazó, como debe.
      // Dentro de una pieza deformada en 3D (una diapositiva con lente) la caja del texto es la del cuadrilátero
      // proyectado: abarca lo que tiene al lado en su mismo plano sin que nada lo tape.
      let warped = null;
      for (let p = el.parentElement; p && p !== document.body && !warped; p = p.parentElement)
        if (/matrix3d/.test(getComputedStyle(p).transform)) warped = p;
      const coverAt = (cx, py) => {
        for (const hit of document.elementsFromPoint(cx, py)) {
          if (hit === el || el.contains(hit) || hit.contains(el)) break;
          if (warped?.contains(hit)) continue;
          // La insignia de un Float se monta a propósito sobre la esquina de lo que acompaña.
          if (paints(hit) && !pageChrome(hit) && !hit.closest(".z-float")) return hit;
        }
        // elementsFromPoint no ve lo que tiene pointer-events: none. Un pegajoso así (un separador de fecha, una
        // cabecera decorativa) sigue pintando encima: se busca a mano lo que pinta dentro de él en ese punto.
        for (const sticky of stickies) {
          if (sticky.contains(el) || el.contains(sticky)) continue;
          // La barra pegajosa de la propia página tapa al desplazar, como debe.
          if (pageChrome(sticky)) continue;
          const sr = sticky.getBoundingClientRect();
          if (cx < sr.left || cx > sr.right || py < sr.top || py > sr.bottom) continue;
          for (const part of [sticky, ...sticky.querySelectorAll("*")]) {
            const pr = part.getBoundingClientRect();
            if (cx >= pr.left && cx <= pr.right && py >= pr.top && py <= pr.bottom && paints(part)) return part;
          }
        }
        return null;
      };
      // Se mira dentro de lo que el texto deja ver (recortado por sus antecesores con desbordamiento, en los dos ejes)
      // y con pointer-events activos, que elementsFromPoint ignora los elementos que no reciben el puntero. Lo que un
      // contenedor recorta no se ve: lo que pinte encima de esa parte (el panel de al lado) no lo tapa.
      let ct = r.top;
      let cb = r.bottom;
      let cl = r.left;
      let cr = r.right;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        const q = p.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(ps.overflowY)) {
          ct = Math.max(ct, q.top);
          cb = Math.min(cb, q.bottom);
        }
        if (/(auto|scroll|hidden|clip)/.test(ps.overflowX)) {
          cl = Math.max(cl, q.left);
          cr = Math.min(cr, q.right);
        }
      }
      if (cb - ct < r.height - 1) continue; // ya recortado por su contenedor: no es tapar, es desplazar
      if (cr - cl < 4) continue;
      const pe = el.style.pointerEvents;
      el.style.pointerEvents = "auto";
      // Tapado a medias: en vertical (arriba sí y abajo no, o al revés) o en horizontal (unos puntos de la línea sí y
      // otros no: una pastilla encima de la mitad de una frase).
      let covered = null;
      const across = [];
      for (const cx0 of xs) {
        const cx = Math.min(Math.max(cx0, cl + 1), cr - 1);
        const top = coverAt(cx, r.top + 2);
        const bottom = coverAt(cx, r.bottom - 2);
        covered = top && !bottom ? top : bottom && !top ? bottom : null;
        if (covered) break;
        across.push(top && bottom ? top : null);
      }
      if (!covered && across.some(Boolean) && across.some((c) => !c)) covered = across.find(Boolean);
      el.style.pointerEvents = pe;
      if (covered)
        add("texto-tapado", el, `tapado por ${sig(covered)}`, {
          text: ownText(el).slice(0, 40),
          // Una columna fijada de una tabla que desplaza tapa lo que pasa por debajo, como debe.
          pinned: Boolean(covered.closest?.("[data-pinned]") || el.closest("[data-pinned]")),
        });
    }
  }
  scrollTo(0, 0);

  // 2c. Lo que se ve mal sin que nada se salga del viewport.
  const shownSet = new Set(shown);
  const masked = (s) => s.maskImage !== "none" || s.webkitMaskImage !== "none";
  const mono = (el) => /mono/i.test(getComputedStyle(el).fontFamily) || el.closest("pre,code,kbd,samp");
  const textRects = (el) => {
    const out = [];
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const b of range.getClientRects()) if (b.width > 1 && b.height > 1) out.push(b);
    }
    return out;
  };

  // Corte sin fundido: una tira o una tabla que desplaza en horizontal y corta un texto en seco por su borde, sin
  // fundido (máscara) ni barra de desplazamiento a la vista: no hay nada que diga que sigue.
  for (const box of shown) {
    const bs = getComputedStyle(box);
    if (!/(auto|scroll)/.test(bs.overflowX) || box.scrollWidth - box.clientWidth <= 8 || masked(bs)) continue;
    const q = rects.get(box);
    if (q.width < 60 || q.height < 16) continue;
    const bar = box.offsetHeight - box.clientHeight - Number.parseFloat(bs.borderTopWidth) - Number.parseFloat(bs.borderBottomWidth);
    if (bar > 2 && bs.scrollbarWidth !== "none") continue;
    let hit = null;
    for (const el of box.querySelectorAll("*")) {
      if (!shownSet.has(el) || !ownText(el) || mono(el)) continue;
      const r = rects.get(el);
      if (r.bottom <= q.top || r.top >= q.bottom) continue;
      if ((r.left < q.left - 1 && r.right > q.left + 4) || (r.right > q.right + 1 && r.left < q.right - 4)) {
        hit = el;
        break;
      }
    }
    // Una rejilla con ejes fijos (cabecera o columna pegajosa: línea de tiempo, semana) desplaza en los dos ejes como
    // una hoja de cálculo: el eje fijo dice dónde se está y el corte del contenido es el de cualquier rejilla.
    const axes = hit && [...box.querySelectorAll("*")].some((e) => getComputedStyle(e).position === "sticky");
    // En un carrusel la diapositiva siguiente asoma a propósito: es lo que invita a desplazar.
    if (hit && box.matches(".z-carousel__viewport"))
      add("asoma-diapositiva", box, "la diapositiva siguiente asoma por el borde", { text: ownText(hit).slice(0, 40) });
    else if (hit && axes)
      add("corte-rejilla", box, `rejilla con ejes fijos que desplaza ${box.scrollWidth - box.clientWidth} px`, {
        text: ownText(hit).slice(0, 40),
      });
    else if (hit)
      add("corte-sin-fundido", box, `desplaza ${box.scrollWidth - box.clientWidth} px en horizontal y corta un texto en seco`, {
        text: ownText(hit).slice(0, 40),
      });
  }
  // Lo mismo en vertical para listas de navegación (barra lateral, menú): una fila que el borde corta a media altura,
  // sin fundido ni barra a la vista, parece un elemento roto y no una lista que sigue.
  for (const box of shown) {
    const bs = getComputedStyle(box);
    if (!/(auto|scroll)/.test(bs.overflowY) || box.scrollHeight - box.clientHeight <= 8 || masked(bs)) continue;
    if (!box.closest("nav,aside,[role=navigation],[role=menu],[role=listbox],.z-sidebar")) continue;
    const q = rects.get(box);
    if (q.width < 60 || q.height < 60) continue;
    const bar = box.offsetWidth - box.clientWidth - Number.parseFloat(bs.borderLeftWidth) - Number.parseFloat(bs.borderRightWidth);
    if (bar > 2 && bs.scrollbarWidth !== "none") continue;
    let hit = null;
    for (const el of box.querySelectorAll("a,button,[role=menuitem],[role=option],[role=treeitem]")) {
      if (!shownSet.has(el) || el.closest("[role=grid],table")) continue;
      const r = rects.get(el);
      if (r.right <= q.left || r.left >= q.right) continue;
      if ((r.top < q.top - 1 && r.bottom > q.top + 4) || (r.bottom > q.bottom + 1 && r.top < q.bottom - 4)) {
        hit = el;
        break;
      }
    }
    if (hit)
      add("corte-sin-fundido", box, `desplaza ${box.scrollHeight - box.clientHeight} px en vertical y corta una fila en seco`, {
        text: (hit.textContent ?? "").trim().slice(0, 40),
      });
  }

  // Texto pisado por un trazo: una cifra de una esfera sobre las marcas, el valor de un indicador que roza su arco. Se
  // muestrea el área de las letras (sin el hueco de ascendentes y descendentes) más una holgura de 0,12 em contra el
  // trazo real de cada figura fija del SVG del mismo componente (isPointInStroke). Las agujas se mueven: no cuentan.
  const block = (el) => {
    let top = null;
    for (let p = el; p && p !== document.body; p = p.parentElement)
      if (
        String(p.getAttribute?.("class") ?? "")
          .split(/\s+/)
          .some((c) => /^z-[a-z0-9-]+$/.test(c) && !/^z-(root|liquid|solid|stack|row|card|section|page|container|shell.*)$/.test(c))
      ) {
        top = p;
        break;
      }
    return top;
  };
  const strokeDone = new Set();
  for (const svg of document.querySelectorAll("svg")) {
    const sr = svg.getBoundingClientRect();
    if (sr.width < 24 || sr.height < 24 || svg.closest("z-icon,.z-icon,button,[hidden]")) continue;
    const geoms = [...svg.querySelectorAll("line,path,circle,ellipse,polyline,polygon")].filter((g) => {
      const gs = getComputedStyle(g);
      return (
        gs.stroke !== "none" &&
        Number.parseFloat(gs.strokeWidth) > 0 &&
        Number(gs.strokeOpacity) > 0.2 &&
        Number(gs.opacity) > 0.2 &&
        gs.display !== "none" &&
        gs.visibility !== "hidden" &&
        // Solo las piezas de un componente (con clase): marcas, pistas, arcos; no un conector o un adorno sin nombre.
        /^z-/.test(String(g.getAttribute("class") ?? "")) &&
        !/(hand|needle|pointer)/.test(String(g.getAttribute("class") ?? "")) &&
        typeof g.isPointInStroke === "function"
      );
    });
    if (!geoms.length) continue;
    const owner = block(svg.parentElement) ?? svg.parentElement;
    const candidates = [...svg.querySelectorAll("text"), ...[...owner.querySelectorAll("*")].filter((e) => shownSet.has(e) && ownText(e))];
    for (const el of candidates) {
      if (strokeDone.has(el)) continue;
      const boxes = el instanceof SVGElement ? [el.getBoundingClientRect()] : textRects(el);
      let crossed = null;
      const em = Number.parseFloat(getComputedStyle(el).fontSize) || 12;
      const clear = Math.max(2, em * 0.12);
      for (const b of boxes) {
        const t = b.top + b.height * 0.25 - clear;
        const bt = b.bottom - b.height * 0.2 + clear;
        const l = b.left + 1 - clear;
        const rr = b.right - 1 + clear;
        if (bt <= t || rr <= l) continue;
        for (const g of geoms) {
          const gr = g.getBoundingClientRect();
          const pad = Number.parseFloat(getComputedStyle(g).strokeWidth) * 2;
          if (gr.right + pad < l || gr.left - pad > rr || gr.bottom + pad < t || gr.top - pad > bt) continue;
          const m = g.getScreenCTM()?.inverse();
          if (!m) continue;
          for (let y = t; y <= bt && !crossed; y += 1.5)
            for (let x = l; x <= rr && !crossed; x += 1.5) {
              const p = new DOMPoint(x, y).matrixTransform(m);
              if (g.isPointInStroke(p)) crossed = g;
            }
          if (crossed) break;
        }
        if (crossed) break;
      }
      if (crossed) {
        strokeDone.add(el);
        add("texto-sobre-trazo", el, `sus letras pisan el trazo de ${sig(crossed)}`, { text: el.textContent.trim().slice(0, 40) });
      }
    }
  }

  // Dato partido: una fecha, una hora o un código (una sola palabra con cifras) que parte línea por un guion o una
  // barra. Un dato se lee entero: va en una línea.
  for (const el of shown) {
    for (const node of el.childNodes) {
      if (node.nodeType !== 3) continue;
      const t = node.textContent.trim();
      if (!/^\S{4,32}$/.test(t) || !/\d/.test(t) || !/[-/.]/.test(t)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const tops = [...new Set([...range.getClientRects()].filter((b) => b.width > 0.5).map((b) => Math.round(b.top / 3)))];
      if (tops.length > 1) add("dato-partido", el, `«${t}» parte en ${tops.length} líneas`, { text: t });
    }
  }

  // Fuera de su contenedor: una pieza que se ve (un botón, una barra con fondo) sale de la caja de su padre sin que
  // este la recorte ni desplace: el padre no le deja sitio.
  const paintsBox = (s) =>
    alphaOf(s.backgroundColor) >= 0.3 ||
    s.backdropFilter !== "none" ||
    Number.parseFloat(s.borderTopWidth) > 0 ||
    s.backgroundImage !== "none";
  for (const el of shown) {
    const cs = getComputedStyle(el);
    if (!/^(static|relative|sticky)$/.test(cs.position)) continue;
    // Una pieza transformada (la cara de un carrusel 3D) sale de su caja a propósito.
    if (cs.transform !== "none" || cs.translate !== "none" || cs.scale !== "none" || cs.rotate !== "none") continue;
    if (!(el.matches(INTERACTIVE) || (paintsBox(cs) && ownText(el) === "" && el.children.length))) continue;
    const parent = el.parentElement;
    if (!parent || parent === document.body) continue;
    const ps = getComputedStyle(parent);
    if (/(auto|scroll|hidden|clip)/.test(ps.overflowX) || /contents/.test(ps.display)) continue;
    if (Number.parseFloat(cs.marginLeft) < 0 || Number.parseFloat(cs.marginRight) < 0) continue;
    // Las filas de una rejilla que desplaza son más anchas que su grupo a propósito.
    if (el.matches("[role=row],[role=rowgroup]") || parent.matches("[role=grid],[role=treegrid]")) continue;
    const r = rects.get(el);
    const pr = rects.get(parent) ?? parent.getBoundingClientRect();
    if (pr.width < 1) continue;
    const over = Math.max(r.right - pr.right, pr.left - r.left);
    if (over > 8)
      add("fuera-del-contenedor", el, `sale ${Math.round(over)} px de ${sig(parent)}`, { text: el.textContent.trim().slice(0, 40) });
  }

  // Fila que desborda: una fila flex sin salto de línea ni desplazamiento cuyas piezas pasan de su borde; lo que sobra
  // queda fuera del panel (o recortado por él) sin que nada lo diga.
  for (const row of shown) {
    const cs = getComputedStyle(row);
    if (!/flex/.test(cs.display) || /column/.test(cs.flexDirection) || cs.flexWrap !== "nowrap") continue;
    if (!/visible/.test(cs.overflowX)) continue;
    const r = rects.get(row);
    if (r.width < 40) continue;
    let far = null;
    for (const k of row.children) {
      const ks = getComputedStyle(k);
      if (!shownSet.has(k) || /absolute|fixed/.test(ks.position)) continue;
      // Girada o animada (un indicador que da vueltas), su caja no es su sitio.
      if (ks.transform !== "none" || ks.rotate !== "none" || ks.animationName !== "none") continue;
      const kr = rects.get(k);
      if (kr.right > r.right + 8 || kr.left < r.left - 8) far = k;
    }
    if (far && !far.closest(".z-carousel__track,.z-marquee__track,[data-scroll-edges]"))
      add(
        "fila-desborda",
        row,
        `${sig(far)} pasa ${Math.round(Math.max(rects.get(far).right - r.right, r.left - rects.get(far).left))} px del borde de la fila`,
        {
          text: far.textContent.trim().slice(0, 40),
        },
      );
  }

  // Etiqueta cortada: el nombre de algo (un dato, una persona, un título de tarjeta) de hasta tres palabras cortado con
  // elipsis. Un nombre corto pasa a dos líneas o le cede sitio lo secundario; la elipsis es para lo largo.
  for (const el of shown) {
    const es = getComputedStyle(el);
    if (es.textOverflow !== "ellipsis" || el.scrollWidth <= el.clientWidth + 1) continue;
    const t = el.textContent.trim();
    // Un nombre de archivo puede ser largo: se corta con elipsis y conserva la extensión a la vista en su propio dato.
    // Tampoco un identificador (un nombre de icono, una ruta): es un código, no un nombre que se lea.
    if (!t || t.length > 24 || t.split(/\s+/).length > 3 || /\.[a-z0-9]{1,5}$/i.test(t) || /^[a-z0-9]+([-_/][a-z0-9]+)+$/i.test(t))
      continue;
    if (!/__(label|title|name)\b/.test(String(el.getAttribute("class") ?? ""))) continue;
    if (
      el.closest(
        ".z-event,.z-timeline,.z-tabstrip,[role=tab],[role=gridcell],[role=columnheader],[role=row],.z-jsontree,[role=option],.z-paneheader",
      )
    )
      continue;
    add("etiqueta-cortada", el, `muestra ${Math.round((el.clientWidth / el.scrollWidth) * 100)} % de un nombre corto`, { text: t });
  }

  // Navegación lateral fija en un teléfono: una columna de navegación acoplada que se come el ancho del contenido.
  if (vw <= 480)
    for (const nav of shown.filter((e) => e.matches("nav,[role=navigation]"))) {
      if (nav.closest("dialog,[popover],[role=dialog],.z-shell__drawer")) continue;
      const r = rects.get(nav);
      if (r.height >= vh * 0.5 && r.width >= 40 && r.width <= 120 && r.left < vw * 0.3)
        add("navegacion-lateral-en-telefono", nav, `${Math.round(r.width)} px de ${vw} acoplados al lado del contenido`);
    }

  // Fila apilada: una fila de controles que parte línea en cada pieza (una debajo de otra, de anchos distintos).
  for (const row of shown) {
    const cs = getComputedStyle(row);
    if (!/flex/.test(cs.display) || /column/.test(cs.flexDirection) || cs.flexWrap === "nowrap") continue;
    const kids = [...row.children].filter((k) => shownSet.has(k) && getComputedStyle(k).position !== "absolute");
    if (kids.length < 3) continue;
    // Líneas por solape vertical: un texto y un botón centrados en la misma línea tienen `top` distintos.
    const lines = [];
    for (const k of [...kids].sort((a, b) => rects.get(a).top - rects.get(b).top)) {
      const r = rects.get(k);
      const line = lines.find((l) => r.top < l.bottom - 2 && r.bottom > l.top + 2);
      if (line) line.bottom = Math.max(line.bottom, r.bottom);
      else lines.push({ top: r.top, bottom: r.bottom });
    }
    const tops = { size: lines.length };
    const width = rects.get(row).width;
    // Si todas miden lo mismo (una lista de botones a todo el ancho), apilarlas es la forma; con anchos muy distintos,
    // una debajo de otra, la fila se rompió.
    const ws = kids.map((k) => rects.get(k).width);
    if (
      tops.size === kids.length &&
      Math.max(...ws) > Math.min(...ws) * 1.5 &&
      Math.min(...ws) < width * 0.8 &&
      // Una pieza a todo el ancho (un campo de búsqueda) apila la fila a propósito.
      Math.max(...ws) < width * 0.9 &&
      kids.some((k) => k.matches(INTERACTIVE) || k.querySelector(INTERACTIVE))
    )
      add("fila-apilada", row, `${kids.length} piezas de una fila, cada una en su línea`);
  }

  // Lente del carrusel: las diapositivas laterales cortadas en seco por el borde (sin fundido) y el sangrado vertical
  // que el motor reserva para el estiramiento sin que nada lo ocupe.
  for (const vp of shown.filter((e) => e.matches(".z-carousel__viewport"))) {
    const bleed = Number.parseFloat(getComputedStyle(vp.closest(".z-carousel")).getPropertyValue("--z-carousel-bleed")) || 0;
    if (!bleed) continue;
    // Con WebGL las zonas curvas las pinta el lienzo, no las diapositivas: su caja no dice cuánto ocupa la lente.
    const cssLens = vp.closest(".z-carousel").dataset.mode === "css";
    const q = rects.get(vp);
    const slides = [...vp.querySelectorAll(".z-carousel__slide")]
      .map((s) => s.getBoundingClientRect())
      .filter((r) => r.right > q.left && r.left < q.right);
    if (
      !masked(getComputedStyle(vp)) &&
      slides.some((r) => (r.left < q.left - 1 && r.right > q.left + 8) || (r.right > q.right + 1 && r.left < q.right - 8))
    )
      add("lente-cortada", vp, "diapositivas laterales cortadas en seco por el borde del carrusel");
    if (cssLens && slides.length) {
      const top = Math.min(...slides.map((r) => r.top)) - q.top;
      const bottom = q.bottom - Math.max(...slides.map((r) => r.bottom));
      if (Math.min(top, bottom) > 24)
        add("sangrado-sobrante", vp, `${Math.round(Math.min(top, bottom))} px vacíos encima y debajo de las diapositivas`);
    }
  }

  // Carrusel con ajuste al centro (prisma, coverflow, rueda): el slide marcado como activo es el que está en el centro.
  // Si otro ocupa el centro, la persona ve uno y el carrusel (indicadores, índice, estilo de la selección) dice otro.
  for (const root of shown.filter((e) => e.matches('.z-carousel[data-mode="snap"]'))) {
    const vp = root.querySelector(":scope > .z-carousel__viewport");
    const active = root.querySelector(".z-carousel__slide[data-active]");
    if (!vp || !active || root.querySelectorAll(".z-carousel__slide[data-active]").length !== 1) continue;
    // Con reproducción automática se mueve solo: el centro y el activo coinciden al asentarse, no en cada fotograma.
    if (root.dataset.autoplayState === "playing") continue;
    if (!root.matches('[data-align="center"],[data-effect="prism"],[data-effect="coverflow"],[data-effect="wheel"]')) continue;
    const q = vp.getBoundingClientRect();
    const vertical = root.dataset.orientation === "vertical";
    const mid = vertical ? q.top + q.height / 2 : q.left + q.width / 2;
    let centered = null;
    for (const s of root.querySelectorAll(".z-carousel__slide")) {
      const r = s.getBoundingClientRect();
      if (vertical ? r.top <= mid && r.bottom >= mid : r.left <= mid && r.right >= mid) centered = s;
    }
    if (centered && centered !== active)
      add("activo-descentrado", root, `el centro muestra el slide ${centered.dataset.index} y el activo es el ${active.dataset.index}`, {
        text: centered.textContent.trim().slice(0, 40),
      });
  }

  // Mazo plano: la tarjeta de arriba de un mazo (`layout="stack"`) tiene el mismo fondo y la misma sombra que las de
  // debajo; solo el desplazamiento la separa y el mazo se lee como una tarjeta suelta.
  for (const root of shown.filter((e) => e.matches('.z-carousel[data-layout="stack"]'))) {
    const top = root.querySelector(".z-carousel__slide[data-active]");
    const under = [...root.querySelectorAll(".z-carousel__slide:not([data-active])")].find((s) => getComputedStyle(s).opacity !== "0");
    if (!top || !under) continue;
    const a = getComputedStyle(top);
    const b = getComputedStyle(under);
    if (a.backgroundColor === b.backgroundColor && a.backgroundImage === b.backgroundImage && a.boxShadow === b.boxShadow)
      add("mazo-plano", top, "la tarjeta de arriba tiene el fondo y la sombra de las de debajo");
  }

  // 3. Tipografía, escala, radios, alturas
  const fontEls = [];
  for (const el of shown) {
    const cs = getComputedStyle(el);
    const text = ownText(el);
    if (text && !el.closest(".zd-swatch,.zd-icon-grid")) {
      const first = cs.fontFamily
        .split(",")[0]
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!families.includes(first)) add("fuente-familia", el, `${first}`);
      else if (fontEls.length < 80 && !fontEls.some((f) => f.first === first && f.weight === cs.fontWeight && f.style === cs.fontStyle)) {
        el.setAttribute("data-va-font", String(fontEls.length));
        fontEls.push({ first, weight: cs.fontWeight, style: cs.fontStyle, sig: sig(el), text: text.slice(0, 30) });
      }
      const size = Number.parseFloat(cs.fontSize);
      // Tamaño en pantalla: un antecesor con transform (el mundo de un lienzo con zoom, una tarjeta en perspectiva)
      // encoge las letras aunque el tamaño computado esté en la escala. Por debajo de 9 px no se leen.
      const drawn = el.offsetWidth > 0 ? rects.get(el).width / el.offsetWidth : 1;
      if (drawn < 0.99 && size * drawn < 9)
        add("texto-ilegible", el, `${(size * drawn).toFixed(1)} px en pantalla (${size} px × ${drawn.toFixed(2)})`, {
          text: text.slice(0, 40),
        });
      if (!near(size, scale.text)) {
        const parentSize = Number.parseFloat(getComputedStyle(el.parentElement).fontSize);
        if (el.matches("code,kbd,samp") && !near(parentSize, scale.text) === false && size < parentSize)
          add("tamano-relativo", el, `${size}px (relativo a ${parentSize}px)`);
        else add("escala-tamano", el, `${size}px`);
      }
      if (cs.lineHeight !== "normal") {
        const lh = Number.parseFloat(cs.lineHeight);
        const ok =
          scale.leading.some((l) => Math.abs(l * size - lh) <= 0.75) ||
          near(lh, scale.height, 0.5) ||
          near(lh, scale.space, 0.5) ||
          Math.abs(lh - size) <= 0.5;
        if (!ok) add("escala-interlineado", el, `${lh}px sobre ${size}px (${(lh / size).toFixed(3)})`);
      } else if (!el.matches("button,input,select,textarea,option") && !el.closest("button,select"))
        add("interlineado-normal", el, `normal sobre ${size}px`);
      const w = Number(cs.fontWeight);
      if (!scale.weight.includes(w)) add("escala-peso", el, `${w}`);
    }
    const isZ = /(^|\s)(z|zd)-/.test(String(el.getAttribute("class") ?? "")) || el.closest("[class*='z-'],[class*='zd-']");
    if (!isZ) continue;
    // Espaciado: rellenos y huecos; márgenes salvo los automáticos (centrados o empujados)
    const props = [
      ["padding-top", cs.paddingTop],
      ["padding-bottom", cs.paddingBottom],
      ["padding-left", cs.paddingLeft],
      ["padding-right", cs.paddingRight],
      ["row-gap", cs.rowGap],
      ["column-gap", cs.columnGap],
      ["margin-top", cs.marginTop],
      ["margin-bottom", cs.marginBottom],
    ];
    const ml = Number.parseFloat(cs.marginLeft);
    const mr = Number.parseFloat(cs.marginRight);
    if (Math.abs(ml - mr) > 0.5 || ml === 0) {
      if (ml <= 64) props.push(["margin-left", cs.marginLeft]);
      if (mr <= 64) props.push(["margin-right", cs.marginRight]);
    }
    const parentDisplay = el.parentElement ? getComputedStyle(el.parentElement).display : "";
    for (const [prop, value] of props) {
      if (!/px$/.test(value)) continue;
      if (/gap/.test(prop) && !/(flex|grid)/.test(cs.display)) continue;
      const signed = Number.parseFloat(value);
      const v = Math.abs(signed);
      if (v === 0 || near(v, scale.space)) continue;
      // Valor calculado (no el usado): `auto` se ve como tal en computedStyleMap aunque getComputedStyle dé px.
      const specified = el.computedStyleMap?.().get(prop)?.toString();
      if (
        /margin/.test(prop) &&
        (specified === "auto" || (/(flex|grid)/.test(parentDisplay) && Number.parseFloat(value) > 40 && !el.computedStyleMap))
      ) {
        add("margen-automatico", el, `${prop} ${value} (margen automático que empuja)`);
        continue;
      }
      if (
        gutterBounds &&
        /padding-(left|right)/.test(prop) &&
        cs.getPropertyValue("--z-container-pad").trim() === gutter &&
        v >= gutterBounds[0] - 0.5 &&
        v <= gutterBounds[1] + 0.5
      ) {
        add("margen-fluido", el, `${prop} ${Math.round(v * 100) / 100}px (container-gutter: ${gutter})`);
        continue;
      }
      // Con puntero grueso, un relleno que lleva la fila al objetivo táctil (40) sale de un cálculo, no de la escala.
      if (
        coarse &&
        /padding-(top|bottom)/.test(prop) &&
        (Math.abs(rects.get(el).height - Math.min(...scale.height.filter((h) => h >= 40))) <= 1 ||
          Math.abs(Number.parseFloat(value) - (Math.min(...scale.height.filter((h) => h >= 40)) - Number.parseFloat(cs.lineHeight)) / 2) <=
            0.6)
      ) {
        add("relleno-tactil", el, `${prop} ${value} (completa el objetivo táctil)`);
        continue;
      }
      // Relleno que centra una línea en una altura de control: la fila admite una segunda línea y sus iconos se
      // alinean con la primera (`padding-block: calc((control-height - 1lh) / 2)`).
      if (/padding-(top|bottom)/.test(prop) && scale.height.some((h) => Math.abs(v - (h - Number.parseFloat(cs.lineHeight)) / 2) <= 0.6)) {
        add("relleno-de-linea", el, `${prop} ${Math.round(v * 100) / 100}px (centra la primera línea en la altura de control)`);
        continue;
      }
      // Centrado geométrico (marcador de un gráfico): margen negativo de medio tamaño propio.
      if (
        /margin/.test(prop) &&
        signed < 0 &&
        (Math.abs(v - rects.get(el).width / 2) <= 1 || Math.abs(v - rects.get(el).height / 2) <= 1)
      ) {
        add("centrado-geometrico", el, `${prop} ${signed}px (medio tamaño)`);
        continue;
      }
      // Texto de lectura (Prose) y marcas en línea: el ritmo va en em y escala con la letra.
      if (el.closest(".z-prose, .z-highlight__mark")) {
        add("ritmo-em", el, `${prop} ${Math.round(v * 100) / 100}px`);
        continue;
      }
      if (/margin/.test(prop) && signed < 0 && v <= 2) {
        add("espaciado-compensado", el, `${prop} ${signed}px (bordes unidos)`);
        continue;
      }
      const border = Math.max(Number.parseFloat(cs.borderTopWidth) || 0, Number.parseFloat(cs.borderLeftWidth) || 0);
      // Compensación de borde: el relleno es un token menos el borde que el elemento tiene de verdad.
      const compensated = border > 0 && /padding/.test(prop) && (near(v + border, scale.space) || near(v + 2 * border, scale.space));
      if (v <= 1) add("espaciado-linea", el, `${prop} ${v}px`);
      else add(compensated ? "espaciado-compensado" : "escala-espaciado", el, `${prop} ${Math.round(v * 100) / 100}px`);
    }
    const r = rects.get(el);
    // Radios
    const rad = Number.parseFloat(cs.borderTopLeftRadius);
    const radEnd = Number.parseFloat(cs.borderTopRightRadius);
    for (const v of [rad, radEnd]) {
      if (!v) continue;
      const circular = v >= Math.min(r.width, r.height) / 2 - 0.5 && v > Math.max(...scale.radius) + 0.5;
      if (circular) {
        const ratio = Math.max(r.width, r.height) / Math.min(r.width, r.height);
        if (ratio > 1.15 && Math.min(r.width, r.height) >= 10)
          add("pildora", el, `radio ${v}px en ${Math.round(r.width)}×${Math.round(r.height)}`, {
            interactive: el.matches(INTERACTIVE) || isControlBox(el, cs),
          });
        break;
      }
      if (!near(v, scale.radius)) {
        // Radio concéntrico: radio de la familia ± un espacio pequeño (interior = exterior − relleno)
        const derived =
          scale.radius.some((rr) =>
            [1, 2, ...scale.space.filter((sp) => sp && sp <= 8)].some((sp) => near(v, [rr - sp]) || near(v, [rr + sp])),
          ) || scale.radius.some((rr) => near(v, [rr / 2]));
        add(derived ? "radio-derivado" : "escala-radio", el, `${v}px`);
      }
      break;
    }
    // Alturas de control
    if (isControlBox(el, cs) && !el.closest(".zd-icon-grid")) {
      const h = Math.round(r.height * 100) / 100;
      add("altura-control", el, `${h}`, { h, w: Math.round(r.width), coarse });
    }
  }

  // 4. Alineación en filas de controles, iconos centrados, huecos de grupo
  for (const parent of shown) {
    const cs = getComputedStyle(parent);
    if (!/flex/.test(cs.display) || /column/.test(cs.flexDirection)) continue;
    // Hermanos que se ven, también los decorativos (aria-hidden: puntos suspensivos de la paginación).
    const kids = [...parent.children].filter((k) => {
      const r = rects.get(k);
      if (!r || r.width < 1 || r.height < 1) return false;
      if (k.checkVisibility && !k.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
      const ks = getComputedStyle(k);
      return ks.position !== "absolute" && ks.position !== "fixed";
    });
    if (kids.length < 2) continue;
    // por línea
    const lines = [];
    for (const k of kids) {
      const r = rects.get(k);
      const line = lines.find((l) => Math.abs(l.top - r.top) < r.height / 2);
      if (line) line.items.push(k);
      else lines.push({ top: r.top, items: [k] });
    }
    for (const line of lines) {
      const controls = line.items.filter((k) => isControlBox(k, getComputedStyle(k)));
      if (controls.length >= 2) {
        const hs = controls.map((k) => Math.round(rects.get(k).height));
        const sizes = new Set(controls.map((k) => k.getAttribute("data-size") ?? ""));
        if (Math.max(...hs) - Math.min(...hs) > 1 && sizes.size > 1)
          add("alineacion-alturas-tallas", parent, `alturas ${[...new Set(hs)].join("/")} (tallas distintas a propósito)`);
        else if (Math.max(...hs) - Math.min(...hs) > 1)
          add("alineacion-alturas", parent, `alturas ${[...new Set(hs)].join("/")} en la misma fila`);
        const cs2 = controls.map((k) => rects.get(k).top + rects.get(k).height / 2);
        if (Math.max(...cs2) - Math.min(...cs2) > 1.5)
          add("alineacion-centros", parent, `centros desplazados ${Math.round(Math.max(...cs2) - Math.min(...cs2))}px`);
      }
      if (line.items.length >= 3 && !/space-(around|evenly)/.test(cs.justifyContent)) {
        const sorted = [...line.items].sort((a, b) => rects.get(a).left - rects.get(b).left);
        const gaps = [];
        for (let i = 1; i < sorted.length; i++)
          gaps.push(Math.round((rects.get(sorted[i]).left - rects.get(sorted[i - 1]).right) * 10) / 10);
        const autoPushed = [...parent.children].some((k) => {
          const s = getComputedStyle(k);
          const map = k.computedStyleMap?.();
          return (
            map?.get("margin-left")?.toString() === "auto" ||
            map?.get("margin-right")?.toString() === "auto" ||
            Number.parseFloat(s.marginLeft) > 24 ||
            Number.parseFloat(s.marginRight) > 24 ||
            Number(s.flexGrow) > 0
          );
        });
        const separators =
          [...parent.children].some((k) =>
            k.matches("hr,[role=separator],.z-divider,[class*='separator'],[class*='__sep'],[class*='literal']"),
          ) || [...parent.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        const sortedGaps = [...gaps].sort((x, y) => x - y);
        // Un hueco mucho mayor que el resto es un grupo empujado al final (margen automático), no un desajuste.
        const pushed = gaps.length >= 2 && sortedGaps.at(-1) > 48 && sortedGaps.at(-2) - sortedGaps[0] <= 1.5;
        if (pushed) add("alineacion-empujado", parent, `huecos ${gaps.join("/")}px (grupo empujado)`);
        else if (!autoPushed && !separators && gaps.every((g) => g >= -0.5) && Math.max(...gaps) - Math.min(...gaps) > 1.5)
          add("alineacion-huecos", parent, `huecos ${gaps.join("/")}px entre hermanos`);
      }
    }
  }
  for (const btn of shown.filter((el) => el.matches("button,[role=button],a.z-btn"))) {
    if (ownText(btn) || btn.textContent.trim()) continue;
    const icons = btn.querySelectorAll(":scope > svg, :scope > z-icon, :scope > .z-icon, :scope > span > svg");
    if (icons.length !== 1) continue;
    const b = btn.getBoundingClientRect();
    const i = icons[0].getBoundingClientRect();
    if (i.width < 1 || i.height < 1 || b.width < 1) continue;
    const dx = i.left + i.width / 2 - (b.left + b.width / 2);
    const dy = i.top + i.height / 2 - (b.top + b.height / 2);
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) add("icono-descentrado", btn, `desvío ${dx.toFixed(1)},${dy.toFixed(1)}px`);
  }
  // Icono que comparte línea con un texto: su centro vertical contra el de la caja de línea del texto de al lado
  // (Range sobre el nodo de texto, una caja por línea). Con un texto de varias líneas cuenta la línea con la que
  // el icono se cruza, la primera si se alinea arriba.
  const TEXT_SKIP = "svg,script,style,template,[hidden],.z-sr-only,.zd-sr-only,input,textarea,select,kbd";
  const lineBoxes = (scope, icon) => {
    const boxes = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const host = n.parentElement;
      if (!host || host.closest(TEXT_SKIP) || icon.contains(host)) continue;
      if (host.checkVisibility && !host.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      // Texto solo para lectores de pantalla (caja de 1 px recortada): no se ve.
      let hiddenText = false;
      for (let a = host; a && a !== scope.parentElement; a = a.parentElement) {
        const ar = a.getBoundingClientRect();
        if (ar.width <= 2 || ar.height <= 2) hiddenText = getComputedStyle(a).display !== "contents";
        if (hiddenText) break;
      }
      if (hiddenText) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) if (q.width > 0.5 && q.height > 0.5) boxes.push({ q, host });
    }
    return boxes;
  };
  const icons = [...document.body.querySelectorAll("svg")].filter((s) => !s.ownerSVGElement);
  for (const icon of icons) {
    const i = icon.getBoundingClientRect();
    if (i.width < 8 || i.height < 8 || i.width > 32 || i.height > 32 || i.width / i.height > 1.4 || i.height / i.width > 1.4) continue;
    if (icon.checkVisibility && !icon.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    if (icon.closest("[hidden],[inert],.z-sr-only,.zd-sr-only,[popover]:not(:popover-open),dialog:not([open])")) continue;
    const ics = getComputedStyle(icon);
    if (ics.position === "absolute" || ics.position === "fixed") continue;
    // Caja que lo contiene: <z-icon> es `display: contents`.
    let host = icon.parentElement;
    while (host && getComputedStyle(host).display === "contents") host = host.parentElement;
    if (!host) continue;
    // Icono que gira (indicador de progreso): su caja cambia con cada vuelta.
    if (
      [icon, host].some((el) => el.getAnimations?.().some((a) => a.effect?.getComputedTiming?.().iterations === Number.POSITIVE_INFINITY))
    )
      continue;
    const hostPos = getComputedStyle(host).position;
    // Icono dibujado encima de otra cosa (adorno de un campo, insignia sobre un avatar): no comparte línea.
    if ((hostPos === "absolute" || hostPos === "fixed") && !host.textContent.trim()) continue;
    let partner = null;
    for (let p = host, depth = 0; p && p !== document.body && depth < 3 && !partner; p = p.parentElement, depth++) {
      if (getComputedStyle(p).display === "contents") {
        depth--;
        continue;
      }
      // En la misma línea: se cruza en vertical con el icono y queda al lado, a un hueco razonable.
      const near = lineBoxes(p, icon).filter(({ q }) => {
        const overlap = Math.min(q.bottom, i.bottom) - Math.max(q.top, i.top);
        const gap = Math.max(q.left - i.right, i.left - q.right, 0);
        // Al lado, no encima: un contador posicionado sobre el icono (insignia) no es su texto de línea.
        const beside = q.left >= i.right - 1 || q.right <= i.left + 1;
        return beside && overlap > Math.min(q.height, i.height) * 0.3 && gap <= 24;
      });
      if (near.length) {
        // La línea que más se cruza con el icono; a igualdad, la más cercana en horizontal.
        near.sort((a, b) => {
          const oa = Math.min(a.q.bottom, i.bottom) - Math.max(a.q.top, i.top);
          const ob = Math.min(b.q.bottom, i.bottom) - Math.max(b.q.top, i.top);
          if (Math.abs(oa - ob) > 0.5) return ob - oa;
          const ga = Math.max(a.q.left - i.right, i.left - a.q.right, 0);
          const gb = Math.max(b.q.left - i.right, i.left - b.q.right, 0);
          return ga - gb;
        });
        partner = { ...near[0], scope: p };
        break;
      }
      // Control con solo un icono (botón, enlace, pestaña): va solo; su centrado lo mide icono-descentrado.
      if (p.matches(INTERACTIVE) || p.matches("[role=img],figure")) break;
    }
    if (!partner) continue;
    const { q, host: textHost } = partner;
    // Icono en un recuadro propio (fondo o borde, más alto que el icono): se mide el recuadro. Si junto a él hay
    // un bloque de varias líneas (título y subtítulo), es un objeto multimedia, no un icono de línea.
    const hs = getComputedStyle(host);
    const t = host.getBoundingClientRect();
    const tile =
      !host.textContent.trim() &&
      t.height >= i.height + 6 &&
      t.width >= i.width + 6 &&
      (Number.parseFloat(hs.borderTopWidth) > 0 ||
        !/^(rgba\(0, 0, 0, 0\)|transparent)$/.test(hs.backgroundColor) ||
        hs.backgroundImage !== "none");
    const box = tile ? t : i;
    const bc = box.top + box.height / 2;
    const dy = bc - (q.top + q.height / 2);
    const limit = box.height > 20 ? 1.5 : 1;
    if (Math.abs(dy) <= limit) continue;
    // Pila de texto al mismo lado del icono que se cruza con su altura: título y subtítulo, o un texto que parte.
    const side = q.left >= box.right - 1 ? 1 : -1;
    const stack = lineBoxes(partner.scope, icon).filter(
      ({ q: o }) =>
        (side > 0 ? o.left >= box.right - 1 : o.right <= box.left + 1) &&
        // La misma columna que la línea de al lado (una debajo de otra), no un contador a su lado.
        o.left < q.right &&
        o.right > q.left &&
        o.bottom > box.top - q.height * 0.75 &&
        o.top < box.bottom + q.height * 0.75,
    );
    const lines = new Set(stack.map(({ q: o }) => Math.round(o.top + o.height / 2)));
    const hosts = new Set(stack.map(({ host: h }) => h));
    const stackTop = Math.min(...stack.map(({ q: o }) => o.top));
    const stackBottom = Math.max(...stack.map(({ q: o }) => o.bottom));
    // Recuadro junto a varias líneas: objeto multimedia. Icono centrado en una pila de dos textos distintos (título
    // y subtítulo): centrado a propósito. Un mismo texto que parte en dos líneas no cuenta: el icono va con la primera.
    const media = lines.size > 1 && (tile || (hosts.size > 1 && Math.abs(bc - (stackTop + stackBottom) / 2) <= 1.5));
    // Marca circular del tamaño de un avatar (asistente, hito de una línea de tiempo): va arriba, junto al bloque.
    const avatar = tile && t.height >= 28 && Number.parseFloat(hs.borderTopLeftRadius) >= Math.min(t.width, t.height) / 2 - 0.5;
    const ts = getComputedStyle(textHost);
    add(
      "icono-desalineado",
      host,
      `${dy > 0 ? "+" : ""}${(Math.round(dy * 2) / 2).toFixed(1)}px (${tile ? "recuadro" : "icono"} ${Math.round(box.height)}, texto ${ts.fontSize}/${ts.lineHeight})`,
      {
        text: textHost.textContent.trim().slice(0, 40),
        icon: icon.getAttribute("data-icon") ?? icon.getAttribute("class") ?? "svg",
        display: `${ics.display}/${ics.verticalAlign}`,
        media,
        avatar,
      },
    );
  }

  // 5. Solapes y objetivo táctil
  const inter = shown.filter((el) => el.matches(INTERACTIVE) && !el.closest("[popover]:not(:popover-open),dialog:not([open])"));
  const inViewport = inter.filter((el) => {
    const r = rects.get(el);
    return r.bottom > 0 && r.top < vh * 3;
  });
  // Rectángulo visible: el del elemento recortado por cada antecesor que no deja ver lo que desborda
  // (una lista de pestañas con desplazamiento esconde la pestaña que pasa por debajo del botón de añadir).
  const clipped = (el) => {
    const r = rects.get(el);
    let { left, top, right, bottom } = r;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      if (!/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflow)) continue;
      const q = p.getBoundingClientRect();
      left = Math.max(left, q.left);
      top = Math.max(top, q.top);
      right = Math.min(right, q.right);
      bottom = Math.min(bottom, q.bottom);
    }
    return { left, top, right: Math.max(left, right), bottom: Math.max(top, bottom) };
  };
  for (let i = 0; i < inViewport.length; i++)
    for (let j = i + 1; j < inViewport.length; j++) {
      const a = inViewport[i];
      const b = inViewport[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = clipped(a);
      const rb = clipped(b);
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 3 && oy > 3) {
        // ¿Lo de encima tapa al otro? Solo cuenta si el punto central del solape pertenece a uno solo.
        const x = Math.max(ra.left, rb.left) + ox / 2;
        const y = Math.max(ra.top, rb.top) + oy / 2;
        if (y < 0 || y > vh || x < 0 || x > vw) {
          add("solape", a, `con ${sig(b)} (${Math.round(ox)}×${Math.round(oy)})`, { offscreen: true });
          continue;
        }
        const hit = document.elementFromPoint(x, y);
        if (hit && (a.contains(hit) || b.contains(hit))) add("solape", a, `con ${sig(b)} (${Math.round(ox)}×${Math.round(oy)})`);
      }
    }
  const min = coarse ? 40 : 24;
  for (const el of inter) {
    const r = rects.get(el);
    if (r.width >= min && r.height >= min) continue;
    // Zona de pulsación ampliada con un ::before posicionado (dibujo pequeño, objetivo grande).
    const pre = getComputedStyle(el, "::before");
    if (
      pre.content !== "none" &&
      pre.position === "absolute" &&
      Number.parseFloat(pre.width) >= min &&
      Number.parseFloat(pre.height) >= min
    )
      continue;
    // Excepción WCAG 2.5.8: enlace dentro de una frase
    const inline = el.matches("a") && getComputedStyle(el).display === "inline" && el.parentElement && ownText(el.parentElement).length > 0;
    if (inline) continue;
    if (el.matches("input") && el.closest("label")) {
      const lr = el.closest("label").getBoundingClientRect();
      if (lr.width >= min && lr.height >= min) continue;
    }
    // Excepción de espaciado: un círculo de 24 px centrado en el objetivo no toca otro objetivo ni su círculo.
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // El vecino cuenta por la parte que se ve: un chip desplazado fuera de su fila (overflow) no está junto al objetivo.
    const spaced = inter.every((o) => {
      if (o === el || o.contains(el) || el.contains(o)) return true;
      const c = clipped(o);
      const q = { left: c.left, top: c.top, right: c.right, bottom: c.bottom, width: c.right - c.left, height: c.bottom - c.top };
      if (q.width < 1 || q.height < 1) return true;
      const dx = Math.max(q.left - cx, 0, cx - q.right);
      const dy = Math.max(q.top - cy, 0, cy - q.bottom);
      if (Math.hypot(dx, dy) < 12) return false;
      if (q.width < 24 || q.height < 24) return Math.hypot(q.left + q.width / 2 - cx, q.top + q.height / 2 - cy) >= 24;
      return true;
    });
    add(spaced ? "objetivo-espaciado" : "objetivo-tactil", el, `${Math.round(r.width)}×${Math.round(r.height)} < ${min}`);
  }
  return { scale, issues: [...found.values()], fontEls, coarse: matchMedia("(pointer: coarse)").matches };
}

// ── Foco: recorre con Tab y mide el contorno contra el fondo ───────────────────────────────────────────
function focusProbe() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const parse = (c) => {
    if (!globalThis.__vaCtx) globalThis.__vaCtx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const ctx = globalThis.__vaCtx;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3]);
    if (!a) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a);
  };
  // Fondo detrás del contorno: el del padre (el contorno cae fuera del elemento), compuesto hacia arriba.
  const backdrop = (start) => {
    const stack = [];
    for (let p = start; p; p = p.parentElement) {
      const bg = parse(getComputedStyle(p).backgroundColor);
      if (bg[3] > 0) stack.push(bg);
      if (bg[3] >= 0.999) break;
    }
    let color = parse(getComputedStyle(document.documentElement).getPropertyValue("--z-canvas") || "#000");
    if (color[3] === 0) color = [0, 0, 0, 1];
    for (const bg of stack.reverse()) color = over(bg, color);
    return color;
  };
  const sig = (e) =>
    `${e.tagName.toLowerCase()}${[...e.classList]
      .filter((c) => /^(z|zd)-/.test(c))
      .slice(0, 2)
      .map((c) => `.${c}`)
      .join("")}${e.getAttribute("role") ? `[role=${e.getAttribute("role")}]` : ""}`;
  // Una pieza de SVG (porción de una tarta, punto de una línea) marca el foco con el trazo: cuenta si su trazo cambia
  // respecto a una hermana sin foco.
  if (el instanceof SVGElement) {
    const sib = [...(el.parentElement?.children ?? [])].find(
      (s) => s !== el && s.tagName === el.tagName && s.getAttribute("class") === el.getAttribute("class"),
    );
    const a = getComputedStyle(el);
    const b = sib ? getComputedStyle(sib) : null;
    const changed = !b || a.stroke !== b.stroke || a.strokeWidth !== b.strokeWidth || a.outlineStyle !== "none";
    return { sig: sig(el), on: "", kind: changed ? "stroke" : "none", width: 0, ratio: null };
  }
  // El anillo puede ir en el propio elemento o en el contenedor (:focus-within de un campo).
  for (let p = el, depth = 0; p && depth < 4; p = p.parentElement, depth++) {
    const cs = getComputedStyle(p);
    const ow = Number.parseFloat(cs.outlineWidth);
    if (cs.outlineStyle !== "none" && ow > 0) {
      const ring = parse(cs.outlineColor);
      // Contorno transparente (solo para colores forzados) con el indicador pintado en ::after (divisores)
      if (ring[3] === 0) {
        const after = getComputedStyle(p, "::after");
        if (parse(after.backgroundColor)[3] > 0) return { sig: sig(el), on: "::after", kind: "pseudo", width: 0, ratio: null };
      }
      const offset = Number.parseFloat(cs.outlineOffset) || 0;
      const bg = backdrop(offset >= 0 ? (p.parentElement ?? p) : p);
      const composed = over(ring, bg);
      const l1 = lum(composed);
      const l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      return { sig: sig(el), on: depth ? sig(p) : "", kind: "outline", width: ow, ratio: Math.round(ratio * 100) / 100 };
    }
    if (cs.boxShadow !== "none" && depth === 0) return { sig: sig(el), on: "", kind: "box-shadow", width: 0, ratio: null };
  }
  // El anillo puede ir en la fila hija (árbol: el item contiene su fila y sus hijos)
  const row = el.firstElementChild;
  if (row && getComputedStyle(row).outlineStyle !== "none" && Number.parseFloat(getComputedStyle(row).outlineWidth) > 0)
    return { sig: sig(el), on: sig(row), kind: "outline-child", width: 0, ratio: null };
  // Campo de texto de una paleta: el foco no sale nunca del campo y se ve por el cursor de texto
  if (el.matches("input[role=combobox]") && el.closest("dialog,[role=dialog],.z-palette,.z-command"))
    return { sig: sig(el), on: "", kind: "caret", width: 0, ratio: null };
  return { sig: sig(el), on: "", kind: "none", width: 0, ratio: 0 };
}

// ── Servidores ─────────────────────────────────────────────────────────────────────────────────────────
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};
function staticServer(dir, base, notFound) {
  const fileFor = (pathname) => {
    if (!pathname.startsWith(base)) return undefined;
    let file = join(dir, normalize(decodeURIComponent(pathname.slice(base.length - 1))));
    if (!file.startsWith(dir)) return undefined;
    if (existsSync(`${file}.html`) && !/\/$/.test(pathname)) return `${file}.html`;
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    return existsSync(file) && statSync(file).isFile() ? file : undefined;
  };
  const server = createServer((req, res) => {
    const file = fileFor(new URL(req.url, "http://x").pathname);
    if (!file) {
      res.writeHead(404, { "content-type": TYPES[".html"] });
      return res.end(notFound && existsSync(notFound) ? readFileSync(notFound) : "404");
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((r) =>
    server.listen(0, "127.0.0.1", () => r({ origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })),
  );
}
const freePort = () =>
  new Promise((res, rej) => {
    const s = net.createServer();
    s.once("error", rej);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });
async function viteServer() {
  const appDir = join(root, "examples/app");
  const port = await freePort();
  const child = spawn(
    process.execPath,
    [join(appDir, "node_modules/vite/bin/vite.js"), "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
    {
      cwd: appDir,
      stdio: "ignore",
      env: { ...process.env, NO_COLOR: "1", ZUIX_TEST_SERVER: "1" },
    },
  );
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    if (Date.now() > deadline || child.exitCode !== null) throw new Error("Vite no arrancó");
    await new Promise((r) => setTimeout(r, 200));
  }
  return { origin, close: () => child.kill("SIGTERM") };
}

// ── Superficies ────────────────────────────────────────────────────────────────────────────────────────
function sitePages() {
  if (!existsSync(join(siteDir, "index.html"))) throw new Error(`No hay sitio compilado en ${siteDir}`);
  const index = readFileSync(join(siteDir, "index.html"), "utf8");
  const canonical = index.match(/rel="?canonical"?\s+href="?([^\s">]+)/)?.[1];
  const base = baseArg ?? (canonical ? new URL(canonical).pathname.replace(/\/?$/, "/") : "/");
  const sitemap = existsSync(join(siteDir, "sitemap.xml")) ? readFileSync(join(siteDir, "sitemap.xml"), "utf8") : "";
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.slice(base.length));
  return { base, paths: ["", ...paths.filter(Boolean), "search", "no-existe-esta-pagina"] };
}
function appScreens() {
  const data = readFileSync(join(root, "examples/app/src/data.ts"), "utf8");
  const shell = [...data.slice(data.indexOf("SCREENS")).matchAll(/\{ id: "([a-z-]+)"/g)].map((m) => m[1]);
  return [...new Set(shell), "audit", "layers", "agenda-stage", "planning-stage", "scale-stage"];
}

// ── Recorrido ──────────────────────────────────────────────────────────────────────────────────────────
const rawFile = join(out, "raw.json");
let records = [];
if (reportOnly) records = JSON.parse(readFileSync(rawFile, "utf8"));
else await run();
classify(records);

async function run() {
  const axeSource = noAxe ? "" : readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--force-device-scale-factor=1"] });
  const jobs = [];
  const servers = [];
  // Interrumpida (Ctrl+C o kill), la auditoría no deja el servidor de Vite vivo.
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      for (const srv of servers) srv.close();
      process.exit(130);
    });
  try {
    if (targets.includes("site")) {
      const { base, paths } = sitePages();
      const srv = await staticServer(siteDir, base, join(siteDir, "404.html"));
      servers.push(srv);
      let n = 0;
      for (const p of paths) {
        // Varias páginas separadas por comas: `--filter overlay/modal,layout/shell`.
        if (filter && !filter.split(",").some((f) => f && `/${p}`.includes(f))) continue;
        if (n++ >= maxPages) break;
        // El sitio se compila con una marca (zudocs.config.json): las otras se inyectan para medir color y contraste.
        for (const brand of brands)
          for (const theme of themes)
            for (const width of widths) {
              if (brand !== "dazlabs" && !(width === 1440 && (p === "" || p.startsWith("components/")))) continue;
              jobs.push({
                target: "site",
                page: `/${p}`,
                url: `${srv.origin}${base}${p}?docusaurus-theme=${theme}`,
                brand,
                theme,
                width,
                injected: brand !== "dazlabs",
              });
            }
      }
    }
    if (targets.includes("app")) {
      const srv = await viteServer();
      servers.push(srv);
      for (const screen of appScreens()) {
        // Varias pantallas separadas por comas: `--filter dashboard,kanban`.
        if (filter && !filter.split(",").some((f) => f && screen.includes(f))) continue;
        for (const brand of brands)
          for (const theme of themes)
            for (const width of widths)
              jobs.push({
                target: "app",
                page: `?screen=${screen}`,
                url: `${srv.origin}/?screen=${screen}&theme=${theme}&brand=${brand === "zenith" ? "dazlabs" : brand}`,
                brand,
                theme,
                width,
                setBrand: brand === "zenith",
              });
      }
    }
    if (targets.includes("html")) {
      const srv = await staticServer(root, "/");
      servers.push(srv);
      if (!filter || "html".includes(filter))
        for (const brand of brands)
          for (const theme of themes)
            for (const width of widths)
              jobs.push({
                target: "html",
                page: "examples/html",
                url: `${srv.origin}/examples/html/index.html`,
                brand,
                theme,
                width,
                setBrand: true,
                setTheme: true,
              });
    }
    console.log(`auditoría visual: ${jobs.length} combinaciones (página × marca × tema × ancho)`);
    const queue = [...jobs];
    let done = 0;
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        records.push(await audit(browser, job, axeSource));
        done += 1;
        if (done % 25 === 0 || !queue.length) {
          console.log(`  ${done}/${jobs.length}`);
          writeFileSync(rawFile, JSON.stringify(records));
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  } finally {
    writeFileSync(rawFile, JSON.stringify(records));
    await browser.close();
    for (const s of servers) s.close();
  }
}

async function audit(browser, job, axeSource) {
  const coarse = job.width === 390;
  const context = await browser.newContext({
    viewport: { width: job.width, height: job.width === 390 ? 844 : 900 },
    colorScheme: job.theme,
    locale: "es-ES",
    ...(coarse ? { hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : {}),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  const record = { ...job, dir, errors: [], issues: [], focus: [], fonts: [], axe: [] };
  page.on("pageerror", (e) => record.errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) record.errors.push(`consola: ${m.text().slice(0, 200)}`);
  });
  page.on("requestfailed", (r) => {
    if (!/net::ERR_ABORTED/.test(r.failure()?.errorText ?? "")) record.errors.push(`red: ${r.url().slice(-80)} ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !(job.page === "/no-existe-esta-pagina" && r.request().resourceType() === "document"))
      record.errors.push(`red: HTTP ${r.status()} ${r.url().slice(-80)}`);
  });
  try {
    await page.goto(job.url, { waitUntil: "load", timeout: 90000 });
    if (job.target === "site")
      await page.waitForFunction(() => document.documentElement.dataset.hasHydrated === "true", null, { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    if (job.injected) await page.addStyleTag({ path: join(root, `tokens/dist/brands/${job.brand}.css`) });
    if (job.setBrand) await page.evaluate((b) => (document.documentElement.dataset.brand = b), job.brand);
    if (job.setTheme) await page.evaluate((t) => (document.documentElement.dataset.theme = t), job.theme);
    if (dir === "rtl") await page.evaluate(() => (document.documentElement.dir = "rtl"));
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(job.target === "app" ? 600 : 250);
    const families = [...FAMILIES[job.brand], ...(job.injected ? FAMILIES.dazlabs : [])];
    const res = await page.evaluate(collect, { TOKENS, families, coarse });
    record.scale = res.scale;
    record.coarseMatched = res.coarse;
    record.issues = res.issues;
    // Fuentes: ¿cargó cada familia de la marca? ¿qué fuente del sistema pinta cada muestra?
    record.fontStatus = await page.evaluate(
      (fams) =>
        fams.map((f) => ({
          family: f,
          loaded: [...document.fonts].some((ff) => ff.family.replace(/["']/g, "") === f && ff.status === "loaded"),
          // Una familia que la página no usa no se descarga: solo cuenta si algún texto la pide.
          used: [...document.querySelectorAll("body *")].some(
            (el) =>
              getComputedStyle(el).fontFamily.replace(/["']/g, "").startsWith(f) &&
              el.textContent.trim() &&
              el.checkVisibility?.({ visibilityProperty: true }),
          ),
        })),
      FIRST[job.brand],
    );
    const cdp = await context.newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root: docRoot } = await cdp.send("DOM.getDocument", { depth: -1 });
    const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: docRoot.nodeId, selector: "[data-va-font]" });
    for (const nodeId of nodeIds) {
      const attrs = (await cdp.send("DOM.getAttributes", { nodeId })).attributes;
      const idx = Number(attrs[attrs.indexOf("data-va-font") + 1]);
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId }).catch(() => ({ fonts: [] }));
      // La de la marca si pinta algún glifo (un «⌘» suelto cae en otra fuente sin que el texto deje de ser de la marca);
      // si no, la que más glifos pinta.
      const want = res.fontEls[idx]?.first.replace(/ Variable$/, "");
      const main = fonts.find((f) => f.familyName.startsWith(want)) ?? [...fonts].sort((a, b) => b.glyphCount - a.glyphCount)[0];
      if (main)
        record.fonts.push({ ...res.fontEls[idx], platform: main.familyName, postscript: main.postScriptName, glyphs: main.glyphCount });
    }
    await cdp.detach();
    if (axeSource) {
      await page.evaluate(axeSource);
      record.axe = await page.evaluate(async () => {
        const r = await globalThis.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
          resultTypes: ["violations"],
        });
        return r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
          sample: v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} — ${(n.any[0]?.message ?? n.failureSummary ?? "").slice(0, 160)}`),
        }));
      });
    }
    if (shots) {
      const dir = join(out, "shots", job.target);
      mkdirSync(dir, { recursive: true });
      const name = `${job.page.replace(/^\/?\??/, "").replace(/\W+/g, "_") || "home"}-${job.brand}-${job.theme}-${job.width}.jpg`;
      await page.screenshot({ path: join(dir, name), fullPage: true, type: "jpeg", quality: 70 }).catch(() => {});
      record.shot = join("shots", job.target, name);
    }
    // Foco con Tab (a 1440 y con la marca de la superficie: el contorno no depende del ancho)
    if (job.width === 1440 && !job.injected) {
      await page.evaluate(() => {
        scrollTo(0, 0);
        document.activeElement?.blur?.();
      });
      // Sin transiciones: el indicador de foco se lee en su estado final, no a mitad de animación.
      await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation-duration: 0s !important; }" });
      const seen = new Set();
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press("Tab");
        const f = await page.evaluate(focusProbe).catch(() => null);
        if (!f) continue;
        const key = `${f.sig}|${f.on}`;
        if (seen.has(key)) continue;
        seen.add(key);
        record.focus.push(f);
      }
    }
  } catch (error) {
    record.errors.push(`auditoría: ${String(error.message).split("\n")[0]}`);
  }
  await context.close();
  return record;
}

// ── Clasificación ──────────────────────────────────────────────────────────────────────────────────────
// Cada tipo de medida tiene su regla. Lo que una regla acepta queda contado como «aceptado» con el motivo, a
// la vista en el informe: no se ignora nada en bloque.
function classify(recs) {
  const real = new Map(); // tipo → Map(clave → {…})
  const accepted = new Map();
  const bump = (map, type, key, info, where) => {
    if (!map.has(type)) map.set(type, new Map());
    const m = map.get(type);
    const prev = m.get(key) ?? { ...info, where: new Set(), count: 0 };
    prev.count += 1;
    if (prev.where.size < 6) prev.where.add(where);
    m.set(key, prev);
  };
  for (const r of recs) {
    const where = `${r.target} ${r.page} ${r.brand}/${r.theme}/${r.width}`;
    const heights = new Set((r.scale?.height ?? []).map((h) => Math.round(h)));
    for (const e of r.errors) bump(real, "consola-red", e.replace(/:\d+:\d+/g, ""), { owner: r.target, detail: e }, where);
    for (const f of r.fontStatus ?? [])
      if (!f.loaded && f.used !== false && !r.injected)
        bump(real, "fuente-no-cargada", `${r.target}|${f.family}`, { owner: r.target, detail: `${f.family} no cargó (${r.brand})` }, where);
    for (const f of r.fonts ?? []) {
      const want = f.first.replace(/ Variable$/, "");
      // Un texto hecho solo de símbolos (⌘, ↵, flechas) cae en otra fuente porque la de la marca no trae el glifo.
      if (!f.platform.startsWith(want) && !r.injected && /^[^\p{L}\p{N}]+$/u.test(f.text.trim()))
        bump(
          accepted,
          "fuente-sistema",
          `${r.target}|${f.first}|${f.platform}`,
          { owner: f.sig, detail: `«${f.text}» en ${f.platform}`, why: "glifo de símbolo que la fuente de la marca no incluye" },
          where,
        );
      else if (!f.platform.startsWith(want) && !r.injected)
        bump(
          real,
          "fuente-sistema",
          `${r.target}|${f.first}|${f.platform}`,
          { owner: f.sig, detail: `pide ${f.first}, pinta ${f.platform}` },
          where,
        );
    }
    for (const v of r.axe ?? [])
      bump(
        real,
        `axe-${v.id}`,
        `${v.id}|${v.sample[0]?.split(" — ")[0]}`,
        { owner: v.id, detail: v.sample.join(" | "), impact: v.impact },
        where,
      );
    for (const f of r.focus ?? []) {
      if (f.kind === "none") bump(real, "foco-ausente", f.sig, { owner: f.sig, detail: "sin contorno de foco" }, where);
      else if (f.kind === "outline" && f.ratio < 3)
        bump(
          real,
          "foco-contraste",
          `${f.sig}|${r.brand}|${r.theme}`,
          { owner: f.sig, detail: `contorno ${f.ratio}:1${f.on ? ` (en ${f.on})` : ""}` },
          where,
        );
    }
    for (const i of r.issues ?? []) {
      const key = `${i.type}|${i.sig}|${i.detail}`;
      const info = { owner: i.owner, detail: `${i.sig}: ${i.detail}${i.text ? ` «${i.text}»` : ""}`, path: i.path };
      let verdict = "real";
      let why = "";
      // Sumas de tokens revisadas a mano: el relleno de un evento deja sitio a su barra de color
      // (space-1-5 + event-bar-width) y la nota de un mes del año perpetuo se alinea con el nombre (space-4 + space-1-5).
      const SUMS = [
        [/z-event/, /padding-left 9px/, "space-1-5 + ancho de la barra del evento"],
        [/^small$/, /padding-left 22px/, "space-4 + space-1-5: alineado con el nombre del mes (año perpetuo)"],
        [/z-sidebar__sub/, /margin-left 19px/, "space-3 + space-2 − 1 px: la guía bajo el centro del icono"],
      ];
      const sum = i.type === "escala-espaciado" && SUMS.find(([sig, detail]) => sig.test(i.sig) && detail.test(i.detail));
      if (sum) {
        bump(accepted, i.type, key, { ...info, why: `suma de tokens: ${sum[2]}` }, where);
        continue;
      }
      // Sangrado que el motor del carrusel calcula en px para que el 3D (lente, cover flow) no se recorte.
      if (i.type === "escala-espaciado" && /z-carousel__viewport/.test(i.sig) && /padding-(top|bottom)/.test(i.detail)) {
        bump(accepted, i.type, key, { ...info, why: "sangrado calculado por el motor del carrusel" }, where);
        continue;
      }
      switch (i.type) {
        case "objetivo-tactil": {
          // Excepciones de WCAG 2.5.8 revisadas una a una (docs: auditoría visual).
          const why2 =
            /z-event/.test(i.sig) && / < 40$/.test(i.detail)
              ? "evento de la rejilla de tiempo en un teléfono: su ancho lo fija la duración y el solape; se abre también desde la vista de lista"
              : /z-segmented__item/.test(i.sig) && / < 40$/.test(i.detail)
                ? "opción de segmentado: con puntero grueso la zona táctil crece a 40 px con ::before"
                : /z-resize|z-table__resize|z-split__divider/.test(i.sig)
                  ? "tirador de redimensionado: 12 px con ratón, 40 con puntero grueso (::before) y flechas con teclado; más ancho taparía la barra de desplazamiento del panel"
                  : /z-heatmap__cell|z-chart__cell/.test(i.sig)
                    ? "celda de un mapa de calor (53 semanas, o día × hora en HeatmapChart): el tamaño es esencial a la presentación; una sola parada de Tab y flechas"
                    : /z-rating__star/.test(i.sig)
                      ? "media estrella: la estrella entera mide 24 px y el valor se fija también con flechas"
                      : /z-timeline__booking/.test(i.sig)
                        ? "reserva en conflicto partida en dos mitades de la fila; cada una se alcanza también con teclado"
                        : /z-datefield__segment/.test(i.sig) && Number(i.detail.split("×")[1]?.split(" ")[0]) >= 24
                          ? "segmento de un campo de fecha (24 px de alto): el valor se escribe de corrido y salta de segmento; el selector de calendario es el control equivalente"
                          : "";
          if (why2) {
            verdict = "aceptado";
            why = why2;
          } else if (i.world) {
            verdict = "aceptado";
            why =
              "control dentro de un lienzo de nodos con zoom: su tamaño en pantalla sigue al zoom (a 100 % mide lo suyo); los puertos conservan 24 px a cualquier zoom";
          }
          break;
        }
        case "contenedor-justo":
          if (r.injected) {
            verdict = "aceptado";
            why = "marca inyectada sin cargar su fuente: el sitio se compila con la suya y otra métrica desborda unos px";
          }
          break;
        case "asoma-diapositiva":
          verdict = "aceptado";
          why = "la diapositiva siguiente de un carrusel asoma a propósito";
          break;
        case "token-partido":
          verdict = "aceptado";
          why = "código sin espacios más ancho que la línea: solo puede partirse";
          break;
        case "escala-tamano":
          if (/hero__title/.test(i.sig)) {
            verdict = "aceptado";
            why = "titular fluido entre dos tokens (display-sm y hero) según el ancho de su contenedor";
          }
          break;
        case "corte-rejilla":
          verdict = "aceptado";
          why = "rejilla con ejes fijos (cabecera o columna pegajosa) que desplaza en los dos ejes";
          break;
        case "objetivo-espaciado":
          verdict = "aceptado";
          why = "menor de 24 px pero con la excepción de espaciado de WCAG 2.5.8";
          break;
        case "alineacion-alturas-tallas":
          verdict = "aceptado";
          why = "muestra de tallas distintas a propósito";
          break;
        case "radio-derivado":
          verdict = "aceptado";
          why = "radio concéntrico (token ± relleno)";
          break;
        case "elipsis":
          verdict = "aceptado";
          why = "elipsis intencionada";
          break;
        case "alineacion-empujado":
          verdict = "aceptado";
          why = "grupo empujado al final de la fila (margen automático o justify)";
          break;
        case "centrado-geometrico":
          verdict = "aceptado";
          why = "margen negativo de medio tamaño: centra un marcador sobre su punto";
          break;
        case "ritmo-em":
          verdict = "aceptado";
          why = "ritmo de lectura en em (Prose, marcas en línea): escala con la letra";
          break;
        case "espaciado-linea":
          verdict = "aceptado";
          why = "1 px: línea de rejilla o ajuste óptico, por debajo del paso más pequeño de la escala";
          break;
        case "margen-fluido":
          verdict = "aceptado";
          why = "margen lateral fluido de Container: el token container-gutter crece con el ancho entre sus dos límites";
          break;
        case "relleno-tactil":
          verdict = "aceptado";
          why = "relleno calculado para llegar al objetivo táctil con puntero grueso";
          break;
        case "relleno-de-linea":
          verdict = "aceptado";
          why = "relleno que centra la primera línea en una altura de control; con dos líneas, el icono sigue a la primera";
          break;
        case "margen-automatico":
          verdict = "aceptado";
          why = "margen automático (empuja al final del contenedor)";
          break;
        case "tamano-relativo":
          verdict = "aceptado";
          why = "código en línea relativo al texto que lo rodea (em)";
          break;
        case "espaciado-compensado":
          verdict = "aceptado";
          why = "token de espacio menos el borde (compensación de 1–2 px)";
          break;
        case "interlineado-normal":
          verdict = "aceptado";
          why = "interlineado normal heredado del navegador (sin token)";
          break;
        case "altura-control": {
          const h = Math.round(i.h);
          const ok = heights.has(h) || [32, 36].includes(h) || (i.coarse && h >= 40);
          // Con puntero grueso la opción del segmentado se pulsa en todo el alto por su ::before (objetivo ≥ 40)
          if (i.coarse && /z-segmented__item/.test(i.sig)) {
            verdict = "aceptado";
            why = "zona táctil ampliada con ::before";
            bump(accepted, i.type, key, { ...info, why }, where);
            continue;
          }
          if (ok) continue;
          // Controles que no son de una sola línea o que dibujan otra cosa (área de arrastre, celdas, áreas)
          if (
            h > 48 ||
            /\[role=(checkbox|radio)\]/.test(i.sig) ||
            /textarea|z-file-upload|dropzone|__track|z-slider|z-carousel|z-tree|z-calendar|z-agenda|z-event|__cell|__day|__slot|z-swatch|z-color|z-otp|__thumb/.test(
              i.sig + i.path,
            )
          ) {
            verdict = "aceptado";
            why = "no es un control de una línea (área, celda o pista)";
          }
          break;
        }
        case "pildora":
          if (
            /z-switch/.test(i.sig) ||
            (!i.interactive &&
              /z-(avatar|badge|status|dot|spinner|progress|meter|switch|radio|slider|skeleton|indicator)|__(dot|thumb|track|bar|indicator|fill|range)/.test(
                i.sig + i.path,
              ))
          ) {
            verdict = "aceptado";
            why = "pieza circular o pista fina (avatar, punto, interruptor, pista)";
          }
          break;
        case "texto-tapado":
          if (i.pinned) {
            verdict = "aceptado";
            why = "columna fijada de una tabla que desplaza en horizontal: lo de debajo se alcanza desplazando";
            break;
          }
          // El mundo del lienzo es más grande que la vista: el minimapa y los controles flotan sobre él como sobre un
          // mapa, y lo que queda debajo se alcanza desplazando (y desde la vista en lista).
          if (i.world && /z-node-(minimap|controls)/.test(i.detail)) {
            verdict = "aceptado";
            why =
              "nodo bajo el minimapa o los controles flotantes del lienzo: se alcanza desplazando, con el teclado y desde la vista en lista";
          }
          break;
        case "icono-desalineado":
          if (i.media) {
            verdict = "aceptado";
            why =
              "icono en un recuadro junto a un bloque de varias líneas, o centrado en una pila de título y subtítulo: objeto multimedia, no icono de línea";
          } else if (i.avatar) {
            verdict = "aceptado";
            why = "marca circular del tamaño de un avatar arriba del bloque que acompaña (mensaje del asistente), como un avatar";
          }
          break;
        case "solape":
          if (/z-event/.test(i.sig) && /z-event/.test(i.detail)) {
            verdict = "aceptado";
            why = "eventos que coinciden en el tiempo: se dibujan en cascada a propósito";
          } else if (i.offscreen) {
            verdict = "aceptado";
            why = "fuera de la pantalla (capa cerrada o carrusel)";
          } else if (i.canvas) {
            verdict = "aceptado";
            why =
              "lienzo de nodos: los nodos pasan bajo el minimapa y los controles flotantes y con poco zoom se acercan; se alcanzan desplazando, acercando, con el teclado y desde la vista en lista";
          }
          break;
        default:
      }
      bump(verdict === "real" ? real : accepted, i.type, key, { ...info, why }, where);
    }
  }
  const toObj = (map) =>
    Object.fromEntries(
      [...map.entries()]
        .sort((a, b) => b[1].size - a[1].size)
        .map(([type, m]) => [type, [...m.values()].sort((a, b) => b.count - a.count).map((v) => ({ ...v, where: [...v.where] }))]),
    );
  const report = { combinations: recs.length, real: toObj(real), accepted: toObj(accepted) };
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 1));
  const lines = [`# Auditoría visual`, "", `${recs.length} combinaciones.`, "", "## Defectos", ""];
  const byOwner = new Map();
  for (const [type, items] of Object.entries(report.real)) {
    lines.push(`### ${type} (${items.length})`, "");
    for (const it of items.slice(0, 40)) {
      lines.push(`- ${it.detail} · ×${it.count} · ${it.where[0]}`);
      byOwner.set(it.owner, (byOwner.get(it.owner) ?? 0) + 1);
    }
    lines.push("");
  }
  lines.push(
    "## Por componente",
    "",
    ...[...byOwner.entries()].sort((a, b) => b[1] - a[1]).map(([o, n]) => `- ${o}: ${n}`),
    "",
    "## Aceptados",
    "",
  );
  // Aceptados agrupados por motivo, con un ejemplo de cada uno.
  for (const [type, items] of Object.entries(report.accepted)) {
    const reasons = new Map();
    for (const it of items) reasons.set(it.why, [...(reasons.get(it.why) ?? []), it]);
    for (const [why, group] of reasons) lines.push(`- ${type} · ${group.length} · ${why} (p. ej. ${group[0].detail.slice(0, 90)})`);
  }
  writeFileSync(join(out, "report.md"), `${lines.join("\n")}\n`);
  const total = Object.values(report.real).reduce((s, v) => s + v.length, 0);
  console.log(`\n${total} defectos distintos en ${Object.keys(report.real).length} tipos:`);
  for (const [type, items] of Object.entries(report.real)) console.log(`  ${type}: ${items.length}`);
  console.log(`informe: ${join(out, "report.md")}`);
  process.exitCode = total ? 1 : 0;
}
