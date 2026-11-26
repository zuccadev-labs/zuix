// WebPreview (core/widget): vista previa de una dirección en un iframe aislado (`sandbox`, `referrerpolicy`,
// `allow` vacío), con barra de dirección (atrás, adelante, recargar, abrir en otra pestaña) y anchos de dispositivo.
// Compatible con una CSP estricta: el ancho del marco es una variable que se escribe por CSSOM, no un estilo en
// línea; la dirección solo admite http y https. Una página que prohíbe que la enmarquen (X-Frame-Options,
// frame-ancestors) se queda en blanco: el navegador no lo cuenta, así que siempre queda «abrir en otra pestaña».
import { canTravel, displayUrl, normalizeUrl, sandboxValue, travel, visit, type UrlHistory } from "./web-preview";
import { h, icon, on } from "./vnode";
import { yes, type Widget } from "./widget";

export type WebPreviewViewport = "desktop" | "tablet" | "mobile";

export interface WebPreviewLabels {
  preview: string;
  address: string;
  back: string;
  forward: string;
  reload: string;
  open: string;
  viewports: string;
  desktop: string;
  tablet: string;
  mobile: string;
  invalid: string;
  empty: string;
}

export const WEB_PREVIEW_LABELS: WebPreviewLabels = {
  preview: "Web preview",
  address: "Address",
  back: "Back",
  forward: "Forward",
  reload: "Reload",
  open: "Open in new tab",
  viewports: "Viewport",
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
  invalid: "Enter an http or https address",
  empty: "Enter an address to preview it",
};

export interface WebPreviewProps {
  /** Dirección (controlado). */
  url?: string;
  defaultUrl?: string;
  /** Título del iframe (su nombre accesible). Por defecto, el de `labels.preview`. */
  title?: string;
  /** Permisos de `sandbox` («allow-scripts allow-forms» por defecto). Vacío: el más restrictivo. */
  sandbox?: string;
  /** Política de permisos del marco (`allow`); vacía por defecto. */
  allow?: string;
  viewport?: WebPreviewViewport;
  defaultViewport?: WebPreviewViewport;
  /** Botones de ancho de dispositivo. */
  viewports?: boolean;
  /** Barra de dirección editable (true). */
  editable?: boolean;
  labels?: Partial<WebPreviewLabels>;
}

interface Config {
  url?: string | null;
  defaultUrl: string | null;
  title?: string;
  sandbox: string;
  allow: string;
  viewport?: WebPreviewViewport;
  defaultViewport: WebPreviewViewport;
  viewports: boolean;
  editable: boolean;
  labels: WebPreviewLabels;
}

interface State {
  history: UrlHistory;
  /** Lo controlado la última vez (para seguir sus cambios). */
  prop: string | null | undefined;
  loading: boolean;
  invalid: boolean;
  reloads: number;
  viewport: WebPreviewViewport;
}

const VIEWPORTS: readonly WebPreviewViewport[] = ["desktop", "tablet", "mobile"];
const VIEWPORT_ICON: Record<WebPreviewViewport, string> = { desktop: "computer-desktop", tablet: "tablet", mobile: "mobile" };
const isViewport = (v: unknown): v is WebPreviewViewport => VIEWPORTS.includes(v as WebPreviewViewport);
const startHistory = (url: string | null): UrlHistory => (url ? { entries: [url], index: 0 } : { entries: [], index: -1 });

export const webPreviewWidget: Widget<WebPreviewProps, Config, State> = {
  root: "z-web-preview",
  configure: (p) => ({
    url: p.url === undefined ? undefined : normalizeUrl(p.url),
    defaultUrl: p.defaultUrl ? normalizeUrl(p.defaultUrl) : null,
    title: p.title,
    sandbox: sandboxValue(p.sandbox),
    allow: p.allow ?? "",
    viewport: isViewport(p.viewport) ? p.viewport : undefined,
    defaultViewport: isViewport(p.defaultViewport) ? p.defaultViewport : "desktop",
    viewports: Boolean(p.viewports),
    editable: p.editable !== false,
    labels: { ...WEB_PREVIEW_LABELS, ...p.labels },
  }),
  initial: (c) => {
    const url = c.url === undefined ? c.defaultUrl : c.url;
    return { history: startHistory(url), prop: c.url, loading: Boolean(url), invalid: false, reloads: 0, viewport: c.viewport ?? c.defaultViewport };
  },
  control(c, s) {
    let next = s;
    if (c.url !== undefined && c.url !== s.prop) {
      next = { ...next, prop: c.url, loading: Boolean(c.url), invalid: false, history: c.url ? visit(s.history, c.url) : s.history };
    }
    if (c.viewport && c.viewport !== next.viewport) next = { ...next, viewport: c.viewport };
    return next;
  },
  tree(c, s, uid) {
    const { labels } = c;
    const current = s.history.entries[s.history.index] ?? null;
    const secure = current?.startsWith("https:");
    const errorId = `${uid}-error`;
    const tool = (cls: string, label: string, name: string, disabled?: boolean) =>
      h(
        "button",
        { type: "button", class: `z-btn z-btn--ghost z-btn--icon ${cls}`, "data-size": "sm", "aria-label": label, title: label, disabled: disabled || undefined },
        icon(name, 16),
      );
    return h(
      "div",
      { class: "z-web-preview", "data-viewport": s.viewport, "data-loading": on(s.loading) },
      h(
        "form",
        { class: "z-web-preview__bar", key: "bar", "aria-label": labels.preview },
        h(
          "div",
          { class: "z-web-preview__nav", role: "group", "aria-label": labels.preview },
          tool("z-web-preview__back", labels.back, "arrow-left", !canTravel(s.history, -1)),
          tool("z-web-preview__forward", labels.forward, "arrow-right", !canTravel(s.history, 1)),
          tool("z-web-preview__reload", labels.reload, "arrow-path", !current),
        ),
        h(
          "span",
          { class: "z-input z-web-preview__address", "data-size": "sm", "data-invalid": on(s.invalid) },
          h("span", { class: "z-input__icon" }, icon(secure ? "lock-closed" : "globe-alt", 14)),
          h("input", {
            class: "z-input__control z-web-preview__input",
            // Texto con teclado de direcciones: `type="url"` haría que el navegador rechazara «example.com» sin esquema
            // antes de que la barra lo complete con https://.
            type: "text",
            inputmode: "url",
            autocomplete: "off",
            spellcheck: "false",
            "aria-label": labels.address,
            value: current ? displayUrl(current) : "",
            readonly: !c.editable || undefined,
            "aria-invalid": s.invalid ? "true" : undefined,
            "aria-describedby": s.invalid ? errorId : undefined,
          }),
        ),
        c.viewports
          ? h(
              "div",
              { class: "z-web-preview__viewports", role: "group", "aria-label": labels.viewports },
              ...VIEWPORTS.map((v) =>
                h(
                  "button",
                  {
                    type: "button",
                    class: "z-btn z-btn--ghost z-btn--icon z-web-preview__viewport",
                    "data-size": "sm",
                    "data-viewport": v,
                    "aria-pressed": String(v === s.viewport),
                    "aria-label": labels[v],
                    title: labels[v],
                    key: v,
                  },
                  icon(VIEWPORT_ICON[v], 16),
                ),
              ),
            )
          : null,
        current
          ? h(
              "a",
              {
                class: "z-btn z-btn--ghost z-btn--icon z-web-preview__open",
                "data-size": "sm",
                href: current,
                target: "_blank",
                rel: "noopener noreferrer",
                "aria-label": labels.open,
                title: labels.open,
              },
              icon("arrow-top-right-on-square", 16),
            )
          : null,
      ),
      s.invalid ? h("p", { class: "z-web-preview__error", id: errorId, key: "error", role: "alert" }, labels.invalid) : null,
      h(
        "div",
        { class: "z-web-preview__stage", key: "stage" },
        current
          ? h(
              "div",
              { class: "z-web-preview__viewport-frame", key: "frame" },
              h("iframe", {
                class: "z-web-preview__frame",
                key: `${current}#${s.reloads}`,
                src: current,
                title: c.title || labels.preview,
                sandbox: c.sandbox,
                allow: c.allow,
                referrerpolicy: "no-referrer",
                loading: "lazy",
              }),
              h("span", { class: "z-web-preview__progress", "aria-hidden": "true" }),
            )
          : h("p", { class: "z-web-preview__empty", key: "empty" }, labels.empty),
      ),
    );
  },
  attach(root, host) {
    const navigate = (url: string) => {
      const c = host.config();
      if (c.url !== undefined) {
        host.update({ invalid: false });
        host.emit("url-change", { url });
        return;
      }
      host.update({ history: visit(host.state().history, url), loading: true, invalid: false });
      host.emit("url-change", { url });
    };
    const onSubmit = (event: Event) => {
      if (!(event.target as Element).classList?.contains("z-web-preview__bar")) return;
      event.preventDefault();
      const input = root.querySelector<HTMLInputElement>(".z-web-preview__input");
      if (!input || !host.config().editable) return;
      const url = normalizeUrl(input.value);
      if (!url) {
        host.update({ invalid: true });
        return;
      }
      input.value = displayUrl(url);
      navigate(url);
    };
    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element).closest?.<HTMLElement>("button");
      if (!button || !root.contains(button)) return;
      const s = host.state();
      const move = (delta: -1 | 1) => {
        const history = travel(s.history, delta);
        const url = history.entries[history.index];
        if (history === s.history || !url) return;
        const input = root.querySelector<HTMLInputElement>(".z-web-preview__input");
        if (input) input.value = displayUrl(url);
        if (host.config().url !== undefined) host.update({ history, prop: url });
        else host.update({ history, loading: true });
        host.emit("url-change", { url });
      };
      if (button.classList.contains("z-web-preview__back")) move(-1);
      else if (button.classList.contains("z-web-preview__forward")) move(1);
      else if (button.classList.contains("z-web-preview__reload")) host.update({ reloads: s.reloads + 1, loading: true });
      else if (button.classList.contains("z-web-preview__viewport")) {
        const v = button.dataset.viewport;
        if (!isViewport(v) || v === s.viewport) return;
        if (host.config().viewport === undefined) host.update({ viewport: v });
        host.emit("viewport-change", { viewport: v });
      }
    };
    // `load` no burbujea: en captura.
    const onLoad = (event: Event) => {
      if ((event.target as Element).classList?.contains("z-web-preview__frame") && host.state().loading) host.update({ loading: false });
    };
    const onInput = (event: Event) => {
      if ((event.target as Element).classList?.contains("z-web-preview__input") && host.state().invalid) host.update({ invalid: false });
    };
    root.addEventListener("submit", onSubmit);
    root.addEventListener("click", onClick);
    root.addEventListener("load", onLoad, true);
    root.addEventListener("input", onInput);
    return () => {
      root.removeEventListener("submit", onSubmit);
      root.removeEventListener("click", onClick);
      root.removeEventListener("load", onLoad, true);
      root.removeEventListener("input", onInput);
    };
  },
  after(root, host) {
    // La barra muestra la dirección actual salvo mientras se escribe en ella (el campo no es controlado).
    const input = root.querySelector<HTMLInputElement>(".z-web-preview__input");
    const s = host.state();
    const current = s.history.entries[s.history.index];
    if (input && current && input !== root.ownerDocument.activeElement && !s.invalid) input.value = displayUrl(current);
  },
  fromDom(el) {
    const d = el.dataset;
    return {
      defaultUrl: d.url,
      title: d.title,
      sandbox: d.sandbox,
      allow: d.allow,
      defaultViewport: isViewport(d.viewport) ? d.viewport : undefined,
      viewports: yes(d.viewports),
      editable: d.editable === "false" ? false : undefined,
    };
  },
};
