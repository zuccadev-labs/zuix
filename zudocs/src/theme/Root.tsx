import type { ReactNode } from "react";
import { ToastProvider } from "@zuccadev-labs/zuix-zui";

// Envoltorio global del sitio: proveedores que los componentes de zui necesitan en cualquier página.
export default function Root({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
