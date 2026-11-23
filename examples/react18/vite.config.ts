import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// La aplicación de ejemplo (examples/app) servida con React 18. Ni el código de la aplicación ni el fuente de los
// paquetes del workspace se copian: Vite toma la raíz de examples/app y cada importación de `react` o `react-dom`
// (también las de zui, zout y zicon, que en el workspace resolverían su React 19 de desarrollo) se dirige a la copia
// de React 18 de este paquete. La suite de navegador la arranca con REACT=18 (tests/browser/run.mjs).
const underTest = process.env.ZUIX_TEST_SERVER === "1";
const modules = fileURLToPath(new URL("./node_modules/", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("../app/", import.meta.url)),
  plugins: [react()],
  resolve: { alias: [{ find: /^(react|react-dom)(\/.*)?$/, replacement: `${modules}$1$2` }] },
  server: { host: "127.0.0.1", strictPort: true, ...(underTest ? { hmr: false, watch: null } : {}) },
  clearScreen: false,
});
