// Carga asíncrona de opciones (Select, Combobox, Listbox): búsqueda con antirrebote, cancelación de la petición
// anterior con AbortController, estados de carga, vacío y error, reintento y paginación infinita. Sin documento ni
// efectos al importar: lo usan el binding de React (primitives/async-options) y el modo DOM (dom/forms-listbox).

/** Una página de resultados: las opciones y si hay más. Un array a secas es la última página. */
export interface AsyncPage<T> {
  options: T[];
  hasMore?: boolean;
}

export interface AsyncContext {
  /** Se aborta si llega otra búsqueda o se cierra la lista: pásala a `fetch`. */
  signal: AbortSignal;
  /** Página pedida, desde 1. */
  page: number;
}

export type AsyncLoader<T> = (query: string, context: AsyncContext) => Promise<AsyncPage<T> | T[]>;

export type AsyncStatus = "idle" | "loading" | "ready" | "error";

export interface AsyncState<T> {
  status: AsyncStatus;
  /** Consulta de los resultados que hay (o de la que se está cargando). */
  query: string;
  options: T[];
  page: number;
  hasMore: boolean;
  /** Cargando la página siguiente (los resultados anteriores siguen a la vista). */
  loadingMore: boolean;
  error: unknown;
}

export interface AsyncOptionsConfig<T> {
  load: AsyncLoader<T>;
  /** Espera tras la última tecla antes de pedir (ms). Por defecto 250. */
  debounce?: number;
  /** Consulta mínima para pedir; por debajo, sin resultados y en reposo. Por defecto 0. */
  minLength?: number;
  onChange(state: AsyncState<T>): void;
  /** Temporizador (inyectable en las pruebas). */
  timers?: { set(fn: () => void, ms: number): unknown; clear(id: unknown): void };
}

export interface AsyncOptions<T> {
  state(): AsyncState<T>;
  /** Nueva consulta: espera el antirrebote (o no, con `immediate`) y cancela lo que hubiera en curso. */
  search(query: string, immediate?: boolean): void;
  /** Página siguiente, si la hay y no se está cargando ya. */
  more(): void;
  /** Repite la última petición que falló (o la consulta actual). */
  retry(): void;
  /** Cancela lo pendiente (al cerrar la lista o desmontar). */
  abort(): void;
}

export const INITIAL_ASYNC: AsyncState<never> = {
  status: "idle",
  query: "",
  options: [],
  page: 0,
  hasMore: false,
  loadingMore: false,
  error: null,
};

const isAbort = (e: unknown) => typeof e === "object" && e !== null && (e as { name?: string }).name === "AbortError";

/** Controlador de carga asíncrona: una petición viva como mucho; la que llega tarde de una búsqueda vieja se descarta. */
export function createAsyncOptions<T>(config: AsyncOptionsConfig<T>): AsyncOptions<T> {
  const timers = config.timers ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) };
  let s: AsyncState<T> = { ...INITIAL_ASYNC };
  let timer: unknown = null;
  let controller: AbortController | null = null;
  let ticket = 0;
  let failed: { query: string; page: number } | null = null;
  const set = (patch: Partial<AsyncState<T>>) => {
    s = { ...s, ...patch };
    config.onChange(s);
  };
  const cancel = () => {
    if (timer !== null) timers.clear(timer);
    timer = null;
    controller?.abort();
    controller = null;
  };
  const run = (query: string, page: number) => {
    controller?.abort();
    const mine = ++ticket;
    const ctrl = new AbortController();
    controller = ctrl;
    failed = null;
    let result: Promise<AsyncPage<T> | T[]>;
    try {
      result = Promise.resolve(config.load(query, { signal: ctrl.signal, page }));
    } catch (error) {
      result = Promise.reject(error);
    }
    result.then(
      (res) => {
        if (mine !== ticket || ctrl.signal.aborted) return;
        controller = null;
        const pageOptions = Array.isArray(res) ? res : (res?.options ?? []);
        const hasMore = Array.isArray(res) ? false : Boolean(res?.hasMore);
        set({
          status: "ready",
          query,
          page,
          hasMore,
          loadingMore: false,
          error: null,
          options: page > 1 ? [...s.options, ...pageOptions] : pageOptions,
        });
      },
      (error) => {
        if (mine !== ticket || ctrl.signal.aborted || isAbort(error)) return;
        controller = null;
        failed = { query, page };
        // Si falla la primera página, lo que había era de otra consulta: no se deja a la vista con el error.
        set(
          page > 1
            ? { status: "error", loadingMore: false, error }
            : { status: "error", loadingMore: false, error, query, options: [], hasMore: false },
        );
      },
    );
  };
  return {
    state: () => s,
    search(query, immediate = false) {
      cancel();
      ticket++;
      if (query.trim().length < (config.minLength ?? 0)) {
        set({ ...INITIAL_ASYNC, query });
        return;
      }
      // Mientras espera, los resultados anteriores siguen a la vista con el estado de carga.
      set({ status: "loading", query, loadingMore: false, error: null, hasMore: false });
      const wait = Math.max(0, config.debounce ?? 250);
      if (immediate || wait === 0) run(query, 1);
      else
        timer = timers.set(() => {
          timer = null;
          run(query, 1);
        }, wait);
    },
    more() {
      if (s.status !== "ready" || !s.hasMore || s.loadingMore) return;
      set({ loadingMore: true });
      run(s.query, s.page + 1);
    },
    retry() {
      const last = failed ?? { query: s.query, page: 1 };
      if (last.page > 1) {
        set({ status: "ready", loadingMore: true, error: null });
        run(last.query, last.page);
      } else {
        set({ status: "loading", error: null });
        run(last.query, 1);
      }
    },
    abort() {
      cancel();
      ticket++;
      if (s.status === "loading" || s.loadingMore) set({ status: s.options.length ? "ready" : "idle", loadingMore: false });
    },
  };
}
