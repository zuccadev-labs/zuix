import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Los paquetes del workspace se consumen desde su código fuente (exports → src), sin paso de build.
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", strictPort: true },
  clearScreen: false,
});
