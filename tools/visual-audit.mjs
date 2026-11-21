#!/usr/bin/env node
// Auditoría visual y funcional: mide en un navegador real lo que la auditoría de estilo (tools/audit.mjs) no
// puede ver en el código fuente. Recorre páginas × marcas × temas × anchos y comprueba:
//
//   desbordamiento   horizontal del documento y elementos que se salen del viewport sin contenedor que desplace
//   recorte          texto cortado (scrollWidth > clientWidth) sin elipsis ni line-clamp
//   solape           elementos interactivos que se pisan
//   fuente           familia computada fuera de la marca, fuente que no cargó y fuente real del sistema
//                    (CSS.getPlatformFontsForNode del protocolo de depuración: qué tipografía pinta de verdad)
//   escala           tamaño, interlineado y peso fuera de los tokens; márgenes, rellenos y huecos fuera de
//                    --z-space-* (±0,5 px); radios fuera de la familia de radios; alturas de control fuera de
//                    --z-control-height-* (24/28/34/40/48 o el objetivo táctil con puntero grueso)
//   píldora          radius-full en un control que no es circular
//   alineación       controles de una misma fila con alturas distintas, iconos descentrados en su botón y huecos
//                    desiguales entre hermanos de un grupo
//   foco             contorno visible en cada parada de Tab y contraste ≥ 3:1 contra lo que tiene detrás
//   objetivo         objetivo táctil ≥ 24×24 (≥ 40 con puntero grueso)
//   axe              WCAG 2.2 A/AA con contraste de color
//   consola y red    errores de página, de consola y peticiones fallidas
//
// Uso (desde la raíz; antes `pnpm check` y, para el sitio, el build de zudocs):
//   pnpm audit:visual [--target site,app,html] [--brands dazlabs,zutool,zenith] [--themes dark,light]
//                     [--widths 1440,768,390] [--filter <texto>] [--out <carpeta>] [--shots] [--no-axe]
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
    else found.set(key, { type, sig: sig(el), owner: owner(el), detail, path: path(el), count: 1, ...extra });
  };
  const near = (v, set, tol = 0.5) => set.some((s) => Math.abs(s - v) <= tol);
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
        const panel = q.height >= vh * 0.6;
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
    // Un evento mide lo que dura y una diapositiva puede asomar a medias: su texto cortado es parte del diseño.
    const byDesign = el.closest(".z-event,.z-carousel__slide");
    if (hidden && !byDesign && !/ellipsis/.test(getComputedStyle(el).textOverflow))
      add("texto-cortado-antecesor", el, "cortado por un antecesor sin desplazamiento", { text: text.slice(0, 40) });
    const current = el.closest("[aria-selected='true'],[aria-current]:not([aria-current='false']),[data-state='active']");
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
  const done = new Set();
  const total = Math.min(document.documentElement.scrollHeight, 20000);
  for (let y = 0; y < total; y += Math.max(200, vh * 0.8)) {
    scrollTo(0, y);
    for (const el of texts) {
      if (done.has(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > vh || r.right <= 0 || r.left >= vw) continue;
      done.add(el);
      const cx = Math.min(Math.max(r.left + Math.min(r.width, 24) / 2, 0), vw - 1);
      // Solo cuenta si lo tapado es una parte: entero debajo de una cabecera es contenido que se desplazó, como debe.
      const coverAt = (py) => {
        for (const hit of document.elementsFromPoint(cx, py)) {
          if (hit === el || el.contains(hit) || hit.contains(el)) return null;
          const hs = getComputedStyle(hit);
          // La insignia de un Float se monta a propósito sobre la esquina de lo que acompaña.
          if ((alphaOf(hs.backgroundColor) >= 0.5 || hs.backdropFilter !== "none") && !pageChrome(hit) && !hit.closest(".z-float"))
            return hit;
        }
        return null;
      };
      // Se mira dentro de lo que el texto deja ver (recortado por sus antecesores con desbordamiento) y con
      // pointer-events activos, que elementsFromPoint ignora los elementos que no reciben el puntero.
      let ct = r.top;
      let cb = r.bottom;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (!/(auto|scroll|hidden|clip)/.test(ps.overflowY)) continue;
        const q = p.getBoundingClientRect();
        ct = Math.max(ct, q.top);
        cb = Math.min(cb, q.bottom);
      }
      if (cb - ct < r.height - 1) continue; // ya recortado por su contenedor: no es tapar, es desplazar
      const pe = el.style.pointerEvents;
      el.style.pointerEvents = "auto";
      const top = coverAt(r.top + 2);
      const bottom = coverAt(r.bottom - 2);
      el.style.pointerEvents = pe;
      const covered = top && !bottom ? top : bottom && !top ? bottom : null;
      if (covered) add("texto-tapado", el, `tapado por ${sig(covered)}`, { text: ownText(el).slice(0, 40) });
    }
  }
  scrollTo(0, 0);

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
    const spaced = inter.every((o) => {
      if (o === el || o.contains(el) || el.contains(o)) return true;
      const q = rects.get(o);
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
  return [...new Set(shell), "audit", "layers", "agenda-stage", "planning-stage"];
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
        if (filter && !`/${p}`.includes(filter)) continue;
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
        if (filter && !screen.includes(filter)) continue;
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
  const record = { ...job, errors: [], issues: [], focus: [], fonts: [], axe: [] };
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
                : /z-resize|z-split__divider/.test(i.sig)
                  ? "tirador de redimensionado: 12 px con ratón, 40 con puntero grueso (::before) y flechas con teclado; más ancho taparía la barra de desplazamiento del panel"
                  : /z-heatmap__cell/.test(i.sig)
                    ? "celda de un mapa de calor de 53 semanas: el tamaño es esencial a la presentación; una sola parada de Tab y flechas"
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
          }
          break;
        }
        case "contenedor-justo":
          if (r.injected) {
            verdict = "aceptado";
            why = "marca inyectada sin cargar su fuente: el sitio se compila con la suya y otra métrica desborda unos px";
          }
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
        case "relleno-tactil":
          verdict = "aceptado";
          why = "relleno calculado para llegar al objetivo táctil con puntero grueso";
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
        case "solape":
          if (/z-event/.test(i.sig) && /z-event/.test(i.detail)) {
            verdict = "aceptado";
            why = "eventos que coinciden en el tiempo: se dibujan en cascada a propósito";
          } else if (i.offscreen) {
            verdict = "aceptado";
            why = "fuera de la pantalla (capa cerrada o carrusel)";
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
