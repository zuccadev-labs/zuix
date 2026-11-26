// PerpetualYear como pieza independiente (core/widget): la lámina del año (core/agenda-year) y su buscador. El
// buscador es un `<input type="date">`: la respuesta sale en texto en una región `status` (la tabla no es la única
// vía). Sin documento al importar.
import { localize } from "./locale";

import { PERPETUAL_LABELS, perpetualTree, type PerpetualLabels } from "./agenda-year";
import { localeWeekInfo, todayISO, valid } from "./date";
import { h } from "./vnode";
import { num, type Widget } from "./widget";

export interface PerpetualYearProps {
  /** Año de la lámina. Por defecto, el de la fecha resaltada o el actual. */
  year?: number;
  /** Fecha resaltada (cruz en la tabla y respuesta del buscador), `YYYY-MM-DD`. */
  highlight?: string | null;
  defaultHighlight?: string | null;
  weekStartsOn?: number;
  locale?: string;
  today?: string;
  labels?: Partial<PerpetualLabels>;
}

export interface PerpetualConfig {
  year: number | null;
  highlight: string | null | undefined;
  weekStart: number;
  locale?: string;
  today: string;
  labels: PerpetualLabels;
}

export interface PerpetualState {
  highlight: string | null;
}

export const perpetualWidget: Widget<PerpetualYearProps, PerpetualConfig, PerpetualState> = {
  root: "z-perpetual",
  configure(p) {
    return {
      year: Number.isInteger(p.year) ? p.year! : null,
      highlight: p.highlight === undefined ? undefined : valid(p.highlight) ? p.highlight : null,
      weekStart: (((p.weekStartsOn ?? localeWeekInfo(p.locale).firstDay) % 7) + 7) % 7,
      locale: p.locale,
      today: valid(p.today) ? p.today : todayISO(),
      labels: { ...localize("perpetual", PERPETUAL_LABELS), ...p.labels },
      // El valor inicial no controlado lo lee `initial`.
      ...(p.defaultHighlight !== undefined ? { defaultHighlight: p.defaultHighlight } : {}),
    } as PerpetualConfig;
  },
  initial(config) {
    const d = (config as PerpetualConfig & { defaultHighlight?: string | null }).defaultHighlight;
    return { highlight: config.highlight !== undefined ? config.highlight : valid(d) ? d : null };
  },
  control(config, state) {
    return config.highlight !== undefined && config.highlight !== state.highlight ? { ...state, highlight: config.highlight } : state;
  },
  tree(config, state, uid) {
    const year = config.year ?? Number((state.highlight ?? config.today).slice(0, 4));
    return h(
      "div",
      { class: "z-perpetual", "data-shown-year": year },
      perpetualTree({
        uid,
        year,
        weekStart: config.weekStart,
        locale: config.locale,
        highlight: state.highlight,
        today: config.today,
        labels: config.labels,
      }),
    );
  },
  attach(root, host) {
    const onChange = (event: Event) => {
      const input = event.target as HTMLInputElement;
      if (!input.matches?.(".z-perpetual__input")) return;
      const value = valid(input.value) ? input.value : null;
      if (value === host.state().highlight) return;
      host.update({ highlight: value });
      host.emit("highlight-change", { date: value });
    };
    root.addEventListener("change", onChange);
    return () => root.removeEventListener("change", onChange);
  },
  after() {},
  fromDom(el, json) {
    const d = el.dataset;
    return {
      year: d.year ? num(d.year, Number.NaN) : undefined,
      defaultHighlight: d.highlight ?? null,
      weekStartsOn: d.weekStart !== undefined ? num(d.weekStart, 1) : undefined,
      locale: d.locale,
      today: d.today,
      labels: (json.labels as Partial<PerpetualLabels>) ?? undefined,
    };
  },
};
