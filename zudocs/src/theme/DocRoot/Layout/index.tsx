// Raíz de la documentación: el armazón del sitio (barra lateral de cristal con todas las secciones) en lugar de
// la barra lateral del tema clásico.
import type { ReactNode } from "react";
import { DocsShell } from "../../../components/Shell";

export default function DocRootLayout({ children }: { children: ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
