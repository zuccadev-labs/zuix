import type { ReactNode } from "react";
import { ToastProvider } from "@zuccadev-labs/zuix-zui";
import { ChromeProvider } from "../components/Chrome";

// Envoltorio global del sitio: proveedores que los componentes de zui y el cromo necesitan en cualquier página.
export default function Root({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ChromeProvider>{children}</ChromeProvider>
    </ToastProvider>
  );
}
