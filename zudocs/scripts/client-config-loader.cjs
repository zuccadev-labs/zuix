// Cargador del empaquetador para `@generated/docusaurus.config.mjs`, la copia de la configuración del sitio que
// Docusaurus mete entera en el paquete del navegador. Lleva los presets, plugins y temas con sus opciones, los
// módulos de cliente y las carpetas de estáticos: rutas absolutas de la máquina que compila (la plantilla, la
// documentación, las hojas de estilo). El navegador no usa ninguno de esos campos; se vacían aquí, y la
// configuración que usa Node para compilar no cambia.
// Lo registra el plugin del sitio (scripts/site-plugin.mjs). CommonJS: es lo que cargan webpack y Rspack.
const BUILD_ONLY = ["presets", "plugins", "themes", "clientModules", "staticDirectories"];

module.exports = function clientConfig(source) {
  const start = source.indexOf("export default ");
  if (start < 0) throw new Error("zudocs: @generated/docusaurus.config no tiene el formato esperado (export default {…})");
  const config = JSON.parse(
    source
      .slice(start + "export default ".length)
      .trim()
      .replace(/;$/, ""),
  );
  for (const key of BUILD_ONLY) if (key in config) config[key] = [];
  return `export default ${JSON.stringify(config, null, 2)};\n`;
};
