# Montar una pantalla

Una pantalla se compone con layouts de `zout` y componentes de `zui`. No define medidas de estructura ni
apariencia propia.

## Reglas

1. Una pantalla usa un solo `Shell`.
2. El contenido va en `Page` con `PageHeader` y `PageSection`.
3. Las rejillas usan `Grid` con ancho mínimo de celda, sin cortes por tamaño de pantalla.
4. La separación se pide por paso de la escala (`gap={4}`), no en píxeles.
5. Texto denso: `surface="solid"` en el `Shell` o un `Pane`.

## Patrón: aplicación con sidebar

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

## Patrón: espacio de trabajo con paneles

```tsx
<Shell titlebar={<TitleBar><TabStrip tabs={tabs} activeId={active} onSelect={setActive} /></TitleBar>} surface="none">
  <SplitPane defaultSizes={[0.6, 0.4]}>
    <Pane header="Editor" focused>…</Pane>
    <Pane header="Preview" focused={false}>…</Pane>
  </SplitPane>
</Shell>
```

## Comportamiento responsive

No hay que programarlo. Con `mode: "auto"` (por defecto) la sidebar pasa a cajón cuando el shell mide
menos de 880 px y el inspector cuando mide menos de 1180 px. La pantalla solo gestiona si están abiertos
y pasa `onCloseOverlay`.

## Terminado cuando

`node tools/audit.mjs <carpeta de la pantalla>` da cero y `pnpm typecheck` pasa.

## Paneles en cajón

`Shell` avisa con `onModeChange({ sidebar, inspector })` cuando un panel pasa de acoplado a cajón. La
aplicación lo usa para no arrancar con cajones abiertos en pantallas estrechas y para cerrar uno al
abrir otro.

