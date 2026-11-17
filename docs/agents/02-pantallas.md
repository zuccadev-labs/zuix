# Montar una pantalla

Una pantalla se compone con layouts de `zout` y componentes de `zui`. No define medidas de estructura ni
apariencia propia.

## Reglas

1. Una pantalla usa un `Shell` principal. Un `Shell` anidado lleva `mainAs="div"` para no repetir `<main>`.
2. El `Shell` principal lleva `skipLinkLabel`: es el enlace para saltar al contenido.
3. El contenido va en `Page` con `PageHeader` y `PageSection`. Un solo `h1` por pantalla; `headingLevel`
   ajusta el nivel cuando una página vive dentro de otra.
4. Las rejillas usan `Grid` con ancho mínimo de celda, sin cortes por tamaño de pantalla.
5. La separación se pide por paso de la escala (`gap={4}`), no en píxeles.
6. Texto denso: `surface="solid"` en el `Shell` o un `Pane`.
7. Todo control sin texto visible lleva nombre: `label` en `IconButton` y `RailItem`, `label` o
   `aria-labelledby` en `Popover`.
8. Nada de `left` o `right` en estilos propios de la pantalla: `inline-start` e `inline-end`.

## Patrones

### Aplicación con sidebar

```tsx
import "@zuccadev-labs/zuix-tokens/tokens.css";
import "@zuccadev-labs/zuix-zui/styles.css";
import "@zuccadev-labs/zuix-zout/styles.css";
import "@zuccadev-labs/zuix-zicon/all";

import { Shell, Rail, RailItem, Sidebar, SidebarSection, Page, PageHeader, PageSection, Grid } from "@zuccadev-labs/zuix-zout";
import { Button, NavList, NavLink, StatTile, ToastProvider } from "@zuccadev-labs/zuix-zui";

export function App() {
  return (
    <ToastProvider>
      <Shell
        skipLinkLabel="Skip to content"
        rail={<Rail><RailItem icon="home" label="Home" active /><RailItem icon="gear" label="Settings" /></Rail>}
        sidebar={{
          label: "Navigation",
          content: (
            <Sidebar>
              <SidebarSection title="Workspace">
                <NavList label="Workspace">
                  <NavLink href="/" icon="home" active>Overview</NavLink>
                  <NavLink href="/projects" icon="folder">Projects</NavLink>
                </NavList>
              </SidebarSection>
            </Sidebar>
          ),
        }}
      >
        <Page header={<PageHeader title="Overview" actions={<Button variant="primary" icon="plus">New</Button>} />}>
          <PageSection title="Metrics">
            <Grid min={200}>
              <StatTile label="Users" value="1,284" />
              <StatTile label="Revenue" value="$12.4k" />
            </Grid>
          </PageSection>
        </Page>
      </Shell>
    </ToastProvider>
  );
}
```

El `Shell` necesita un contenedor con alto definido (por ejemplo `html, body, #root { height: 100% }`).

### Espacio de trabajo con paneles

```tsx
<Shell titlebar={<TitleBar><TabStrip tabs={tabs} activeId={active} onSelect={setActive} /></TitleBar>} surface="none">
  <SplitPane defaultSizes={[0.6, 0.4]}>
    <Pane header="Editor" focused>…</Pane>
    <Pane header="Preview" focused={false}>…</Pane>
  </SplitPane>
</Shell>
```

### Comportamiento responsive

No hay que programarlo. Con `mode: "auto"` (por defecto) la sidebar pasa a cajón cuando el shell mide
menos de 880 px y el inspector cuando mide menos de 1180 px. La pantalla solo gestiona si están abiertos
y pasa `onCloseOverlay`.

### Paneles en cajón

`Shell` avisa con `onModeChange({ sidebar, inspector })` cuando un panel pasa de acoplado a cajón. La
aplicación lo usa para no arrancar con cajones abiertos en pantallas estrechas y para cerrar uno al
abrir otro.

### Acción con carga

```tsx
<Button variant="primary" loading={saving} onClick={save}>Save</Button>
```

Con `loading` el botón lleva `aria-disabled` y conserva el foco. No lo sustituyas por `disabled`.

## No hacer

| En lugar de | Usa |
|---|---|
| Un ancho fijo para la sidebar o el inspector | Los tokens `--z-sidebar-width` e `--z-inspector-width` y el tirador del `Shell` |
| Una media query para apilar tarjetas | `Grid min={…}` |
| `color: var(--z-danger)` para un texto de error | `var(--z-danger-text)` |
| Un `div` con `onClick` | `Button`, `Link` o `NavLink` |
| Un diálogo hecho a mano | `Modal`, `Drawer` o `ConfirmDialog` |

## Verificación

| Comando | Objetivo |
|---|---|
| `node tools/audit.mjs <carpeta de la pantalla>` | 0 en todo |
| `pnpm typecheck` | Sin errores |
| `pnpm lint` | 0 errores y 0 avisos |
| `pnpm test:browser` | Si la pantalla está en `examples/app` |
