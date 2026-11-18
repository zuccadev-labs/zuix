import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Las suites de navegador (tests/browser/run.mjs) arrancan este servidor con ZUIX_TEST_SERVER=1: sin vigilancia de
// archivos ni HMR. Un archivo que cambia a mitad de una ejecución (otra herramienta, un editor, `pnpm check`
// regenerando fuentes) haría que Vite recargase la página que se está probando: el control «se desmonta durante el
// clic» y Firefox avisa «Loading failed for the module». La suite prueba el código tal como estaba al arrancar.
const underTest = process.env.ZUIX_TEST_SERVER === "1";

// Los paquetes del workspace se consumen desde su código fuente (exports → src), sin paso de build.
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", strictPort: true, ...(underTest ? { hmr: false, watch: null } : {}) },
  clearScreen: false,
});
