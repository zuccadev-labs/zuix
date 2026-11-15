// WebGL en las dos suites (tests/html y tests/browser).
//   Los runners de CI no siempre ofrecen WebGL: el Firefox sin interfaz de los runners de GitHub lo niega
//   («AllowWebgl2:false restricts context creation on this system»), mientras que en un equipo de escritorio
//   suele haber un rasterizador por software. `NO_WEBGL=1` reproduce en local un motor sin WebGL:
//     firefox   preferencia `webgl.disabled` (el mismo camino que en el runner: getContext devuelve null y avisa)
//     chromium  `--disable-3d-apis`
//     webkit    no tiene interruptor: se sustituye `HTMLCanvasElement.prototype.getContext` antes de cargar la página
//   Sin WebGL el Carousel cae a modo css y los casos del modo gl quedan como no verificables.

export const noWebgl = /^(1|true|yes)$/i.test(process.env.NO_WEBGL ?? "");

/** Opciones de lanzamiento que apagan WebGL en el motor (se mezclan con las del runner). */
export function noWebglLaunch(browserName) {
  if (!noWebgl) return {};
  if (browserName === "firefox") return { firefoxUserPrefs: { "webgl.disabled": true } };
  if (browserName === "chromium") return { args: ["--disable-3d-apis"] };
  return {};
}

const NO_WEBGL_SCRIPT = `(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    return /^(webgl2?|experimental-webgl)$/.test(String(type)) ? null : original.call(this, type, ...rest);
  };
})()`;

/** WebKit no tiene preferencia para apagar WebGL: cada contexto nuevo del navegador recibe el sustituto de getContext. */
export function applyNoWebgl(browser, browserName) {
  if (!noWebgl || browserName !== "webkit") return browser;
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (options) => {
    const context = await newContext(options);
    await context.addInitScript(NO_WEBGL_SCRIPT);
    return context;
  };
  return browser;
}

/**
 * Aviso del propio navegador, no de la suite: Firefox escribe en la consola cada vez que `getContext("webgl2")`
 * no entrega contexto. No hay forma de preguntar por WebGL2 sin provocarlo (la interfaz WebGL2RenderingContext existe
 * aunque el contexto no se pueda crear), así que los runners ignoran exactamente este mensaje y ninguno más.
 */
export const WEBGL_UNAVAILABLE_WARNING = /^\[JavaScript Warning: "Failed to create WebGL context: /;
