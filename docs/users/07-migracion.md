# Migrar zutool y ui-glass a @zuccadev-labs/zuix-tokens

zutool y `ui-glass` llevan cada uno su copia de los tokens liquid glass. Esta guía explica cómo pasan a
leerlos de `@zuccadev-labs/zuix-tokens` sin tocar sus componentes: se importa la marca, se importa una **capa de
compatibilidad** que conserva los nombres antiguos y se retira la hoja propia.

> **Estado (2026-11-14):** las capas están generadas y validadas dentro de zuix. **No se ha aplicado
> nada en zutool ni en `analizador-trafico`**: esos proyectos solo se leyeron. Aplicar la migración es
> una decisión del responsable.

## Qué es una capa de compatibilidad

Un archivo CSS generado que declara cada variable antigua como alias de un token:

```css
:root {
  --accent: var(--z-accent);
  --surface-2: var(--z-surface-2);
  --orange-500: var(--zp-orange-500);
}
```

El código del proyecto sigue escribiendo `var(--accent)`. El valor, el tema y la marca los pone zuix.

| Archivo | Qué contiene | De quién es |
|---|---|---|
| `@zuccadev-labs/zuix-tokens/compat/<proyecto>.css` | Alias de las variables antiguas con equivalente | De zuix. Se importa, no se copia |
| `tokens/dist/compat/<proyecto>.app.css` | Las variables sin equivalente, con su valor original | Del proyecto. Se copia una vez y pasa a ser suya |
| `tokens/dist/compat/<proyecto>.report.md` | Diferencias de valor, renombres y variables sin equivalente | Informe generado |

Los tres salen de un mapa declarativo, `tokens/compat/<proyecto>.json`, al ejecutar `pnpm tokens`.

### Qué valida el build

`pnpm tokens` falla si:

- una variable que declara la hoja antigua no está en `map` (tiene token), `rename` (hay que cambiarla
  en el código) ni `keep` (sin equivalente, con motivo). El error lista las que faltan y sus usos;
- un token destino no existe en la marca;
- una variable antigua se llama igual que un token de zuix y no está en `rename`;
- una variable que se queda en la app depende de otra que desaparece.

Las fuentes de cada proyecto viven fuera de este repositorio y su ruta no se escribe en el mapa. El build
usa la instantánea `tokens/compat/<proyecto>.inventory.json`. Para releer las fuentes se pasa la ruta del
proyecto en la variable de entorno que nombra `source.env`:

```
ZUIX_COMPAT_ZUTOOL_ROOT=<ruta a zutool> ZUIX_COMPAT_UI_GLASS_ROOT=<ruta a analizador-trafico> \
  pnpm --filter @zuccadev-labs/zuix-tokens compat:scan
```

Con la variable definida, `pnpm tokens` también lee las fuentes y avisa si difieren de la instantánea.

## Antes de empezar

1. Trabajar en una rama del proyecto que migra. Revertir es deshacer esa rama.
2. Consumir `@zuccadev-labs/zuix-tokens`. Con el paquete publicado se instala por versión:
   `pnpm add @zuccadev-labs/zuix-tokens`. Antes de la primera publicación se enlazaba por ruta
   (`pnpm add @zuccadev-labs/zuix-tokens@link:<ruta a zuix>/tokens`) o con una copia versionada en `vendor/`
   si el CI del proyecto no tenía zuix en disco (ver [Estado de la migración](#estado-de-la-migración-2026-11-14)).
3. Comprobar que `<html>` lleva `data-theme`. Los dos proyectos ya ponen `data-theme="dark"` en su
   `index.html`. Sin ese atributo, zuix sigue la preferencia del sistema.

## zutool

Hojas: `apps/desktop/src/styles/tokens.css` y `apps/mobile/src/styles/tokens.css` (la de móvil es la de
escritorio sin las capas `--z-*`). Marca: `zutool`.

- Variables que declara la hoja antigua: 126
- Con alias a un token: 74
- Sin equivalente (se quedan en la app): 51
- A renombrar en el código: 1
- Comparaciones de valor iguales: 113; con diferencia visible: 37 (oscuro y claro)

### Pasos

1. Copiar `tokens/dist/compat/zutool.app.css` a `src/styles/app-tokens.css` en escritorio y en móvil.
   Desde ese momento el archivo es de zutool: se edita allí.
2. En `src/styles/app.css` de cada aplicación, cambiar la importación de la hoja:

   ```css
   /* antes */
   @import "./tokens.css";

   /* después */
   @import "@zuccadev-labs/zuix-tokens/css/zutool.css";
   @import "@zuccadev-labs/zuix-tokens/compat/zutool.css";
   @import "./app-tokens.css";
   ```

   El orden importa: marca, capa y variables de la aplicación.
3. Renombrar en el código las variables de la tabla «A renombrar».
4. Borrar `src/styles/tokens.css`.
5. Verificar: compilar, abrir la aplicación en oscuro y en claro, y repasar la tabla de diferencias.

El bloque `@theme inline` de Tailwind no cambia: sigue leyendo los nombres antiguos.

### A renombrar

| Variable | Sustituir por | Motivo | Dónde |
|---|---|---|---|
| `--z-overlay` | `--z-layer-overlay` | En zuix `--z-overlay` es el color de las capas flotantes, no un z-index. La capa no puede redefinirlo sin romper `zui`. | `apps/desktop/src/styles/workspace.css:38`, `apps/desktop/src/styles/workspace.css:93`, `apps/desktop/src/styles/workspace.css:137`, `apps/desktop/src/styles/zutool.css:365`, `apps/desktop/src/styles/zutool.css:748`, `apps/desktop/src/styles/zutool.css:1028` |

`--z-menu`, `--z-dialog`, `--z-popover`, `--z-toast` y `--z-top` no hay que tocarlos: la capa los apunta a
`--z-layer-*`, que valen lo mismo.

### Diferencias visibles

Valor antiguo resuelto frente al valor del token, por tema. Lo que no aparece aquí se ve igual.

| Variable | Usos | Token | Tema | Antes | Después | Nota |
|---|---|---|---|---|---|---|
| `--sky-500` | 3 | `{p.sky-500}` | ambos | `#60a5fa` | `#74b0fb` | El primitivo se aclaró en zuix para que el Badge informativo llegue a 4.5:1. |
| `--canvas` | 10 | `{canvas}` | claro | `#2a2422` | `#efeae6` | La hoja antigua no redefinía el lienzo en claro: lo fijaba el preset de tema en tiempo de ejecución. La marca trae un lienzo claro. |
| `--canvas-gradient` | 2 | `{canvas-gradient}` | claro | `radial-gradient(1000px 560px at 12% 18%, rgba(224, 190, 160, …` | `radial-gradient(1000px 560px at 12% 18%, rgba(224, 190, 160, …` | Igual que `--canvas`: la marca trae un degradado claro. |
| `--fg-subtle` | 40 | `{fg-subtle}` | claro | `rgba(29, 26, 25, 0.46)` | `rgba(29, 26, 25, 0.5)` | El texto sutil sube de 0.46 a 0.50 de opacidad en claro para llegar a 3:1. |
| `--accent` | 94 | `{accent}` | claro | `#ff6118` | `#c2410c` | En claro el acento baja a `orange-700` para dar contraste 3:1 como texto sobre blanco. |
| `--accent-hover` | 13 | `{accent-hover}` | claro | `#ff7a3d` | `#cb5c2e` | En claro se deriva del acento nuevo (86 % + blanco). |
| `--accent-soft` | 30 | `{accent-soft}` | claro | `rgba(255, 97, 24, 0.18)` | `rgba(194, 65, 12, 0.18)` | Derivado del acento del tema (18 %). |
| `--accent-ring` | 21 | `{accent-ring}` | claro | `rgba(255, 97, 24, 0.45)` | `rgba(194, 65, 12, 0.45)` | Derivado del acento del tema (45 %). |
| `--success` | 38 | `{success}` | claro | `#22c55e` | `#15803d` | En claro, verde más oscuro para texto sobre blanco. |
| `--success-soft` | 9 | `{success-soft}` | claro | `rgba(34, 197, 94, 0.18)` | `rgba(21, 128, 61, 0.18)` | Derivado de `success` (18 %). |
| `--warning` | 58 | `{warning}` | claro | `#f5a524` | `#b45309` | En claro, ámbar más oscuro para texto sobre blanco. |
| `--warning-soft` | 17 | `{warning-soft}` | claro | `rgba(245, 165, 36, 0.18)` | `rgba(180, 83, 9, 0.18)` | Derivado de `warning` (18 %). |
| `--danger` | 72 | `{danger}` | claro | `#ff2d78` | `#d11a5b` | En claro, rosa más oscuro para texto sobre blanco. |
| `--danger-soft` | 16 | `{danger-soft}` | claro | `rgba(255, 45, 120, 0.2)` | `rgba(209, 26, 91, 0.2)` | Derivado de `danger` (20 %). |
| `--info` | 14 | `{info}` | oscuro | `#60a5fa` | `#74b0fb` | Sigue a `sky-500`: azul más claro en oscuro; en claro pasa a un azul con contraste sobre blanco. |
| `--info` | 14 | `{info}` | claro | `#60a5fa` | `#1d4ed8` | Sigue a `sky-500`: azul más claro en oscuro; en claro pasa a un azul con contraste sobre blanco. |
| `--info-soft` | 4 | `{info-soft}` | oscuro | `rgba(96, 165, 250, 0.18)` | `rgba(116, 176, 251, 0.18)` | Derivado de `info` (18 %). |
| `--info-soft` | 4 | `{info-soft}` | claro | `rgba(96, 165, 250, 0.18)` | `rgba(29, 78, 216, 0.18)` | Derivado de `info` (18 %). |
| `--card-bg` | 1 | `{card-bg}` | oscuro | `rgba(255, 255, 255, 0.07)` | `rgba(255, 255, 255, 0.06)` | La tarjeta usa `surface`: un punto menos de opacidad. |
| `--card-border` | 2 | `{card-border}` | oscuro | `rgba(255, 255, 255, 0.1)` | `rgba(255, 255, 255, 0.09)` | La tarjeta usa `line`: un punto menos de opacidad. |
| `--card-border` | 2 | `{card-border}` | claro | `rgba(0, 0, 0, 0.1)` | `rgba(0, 0, 0, 0.09)` | La tarjeta usa `line`: un punto menos de opacidad. |
| `--card-shadow` | 2 | `{card-shadow}` | oscuro | `0 14px 34px -22px rgba(0, 0, 0, 0.55)` | `0 8px 24px -10px rgba(0, 0, 0, 0.6)` | La tarjeta usa `shadow-md`: sombra más corta y algo más densa. |
| `--card-shadow` | 2 | `{card-shadow}` | claro | `0 14px 34px -22px rgba(0, 0, 0, 0.55)` | `0 8px 24px -10px rgba(0, 0, 0, 0.22)` | La tarjeta usa `shadow-md`: sombra más corta y algo más densa. |
| `--shadow-sm` | 4 | `{shadow-sm}` | claro | `0 1px 2px rgba(0, 0, 0, 0.4)` | `0 1px 2px rgba(0, 0, 0, 0.10)` | La hoja antigua conservaba la sombra del tema oscuro. En claro la marca la aligera. |
| `--shadow-md` | 3 | `{shadow-md}` | claro | `0 8px 24px -10px rgba(0, 0, 0, 0.6)` | `0 8px 24px -10px rgba(0, 0, 0, 0.22)` | Igual que `--shadow-sm`. |
| `--shadow-lg` | 6 | `{shadow-lg}` | claro | `0 28px 70px -28px rgba(0, 0, 0, 0.75)` | `0 28px 70px -28px rgba(0, 0, 0, 0.35)` | Igual que `--shadow-sm`. |
| `--card-muted` | 1 | `{fg-muted}` | oscuro | `rgba(255, 255, 255, 0.62)` | `rgba(255, 255, 255, 0.7)` | Se une a `fg-muted`: texto algo más opaco. |
| `--card-muted` | 1 | `{fg-muted}` | claro | `rgba(29, 26, 25, 0.6)` | `rgba(29, 26, 25, 0.68)` | Se une a `fg-muted`: texto algo más opaco. |
| `--brand-primary-bg` | 3 | `{button-primary-bg}` | ambos | `#ff6118` | `#c2410c` | El botón primario usa `accent-solid` (`orange-700`): el naranja 500 no da 4.5:1 con texto blanco. |
| `--rail-active-bg` | 1 | `{accent-solid}` | ambos | `#ff6118` | `#c2410c` | El elemento activo del rail lleva texto blanco: usa `accent-solid` por el mismo motivo. |
| `--progress-track` | 5 | `{surface-3}` | claro | `rgba(0, 0, 0, 0.12)` | `rgba(0, 0, 0, 0.1)` | Se une a `surface-3`: en claro, 0.10 en vez de 0.12. |
| `--progress-fill` | 2 | `{accent}` | claro | `#ff6118` | `#c2410c` | Sigue al acento del tema. |
| `--chrome-close-fg` | 1 | `se queda en la app` | claro | `#ff2d78` | `#d11a5b` | Hereda el cambio de `--danger`. |
| `--chrome-close-hover` | 1 | `se queda en la app` | claro | `rgba(255, 45, 120, 0.2)` | `rgba(209, 26, 91, 0.2)` | Hereda el cambio de `--danger-soft`. |

### Sin equivalente

Se quedan en `app-tokens.css` con su valor de hoy.

| Variables | Usos | Motivo |
|---|---|---|
| `--amber-500` | 0 | Primitivo que solo alimenta tokens de dominio (`--node-data`, `--edge-variable`); el ámbar de la marca es otro tono y es el de `warning`. |
| `--teal-500` | 0 | Primitivo que solo alimenta `--node-component`. No está en la paleta de la marca. |
| `--violet-500` | 0 | Primitivo que solo alimenta `--node-layout`. No está en la paleta de la marca. |
| `--canvas-dot` | 0 | Trama de puntos del lienzo de la aplicación. |
| `--rail-bg` | 2 | Fondo propio del rail, más opaco que el cristal. zout usa el material del panel. |
| `--search-bg`, `--search-fg`, `--search-placeholder` | 6 | Campo de búsqueda de la cabecera de la aplicación. |
| `--header-icon`, `--header-icon-hover` | 4 | Iconos de la cabecera de la aplicación. |
| `--kpi-soft`, `--kpi-soft-fg`, `--kpi-soft-muted`, `--kpi-solid` | 7 | Tarjetas KPI de la aplicación (documento 02 de investigación: no se heredan). |
| `--node-component`, `--node-component-soft`, `--node-data`, `--node-data-soft`, `--node-document`, `--node-document-soft`, `--node-folder`, `--node-folder-soft`, `--node-layout`, `--node-layout-soft`, `--node-render`, `--node-render-soft` | 30 | Tipos de nodo del grafo: dominio de la aplicación. |
| `--edge-import`, `--edge-link`, `--edge-variable` | 0 | Aristas del grafo: dominio de la aplicación. |
| `--shadow-node` | 2 | Sombra de los nodos del grafo. |
| `--z-menu-scrim` | 1 | Capa propia (59) entre `layer-overlay` y `layer-menu`. |
| `--z-popup` | 3 | Capa propia (70) entre `layer-menu` y `layer-dialog`. |
| `--z-tour`, `--z-tour-ring` | 2 | Capas del recorrido guiado (74 y 75). |
| `--z-onboarding` | 1 | Capa de la bienvenida (95). |
| `--z-drag` | 1 | Capa del arrastre (1000), por encima de `layer-top`. |
| `--brand-dot-1`, `--brand-dot-2`, `--brand-dot-3` | 3 | Los tres puntos del logotipo. |
| `--chrome-btn-hover`, `--chrome-chip-bg`, `--chrome-chip-hover`, `--chrome-close-fg`, `--chrome-close-hover`, `--chrome-fg`, `--chrome-fg-muted`, `--chrome-height` | 12 | Cromo de la ventana sin marco (barra de título propia). |
| `--window-border`, `--window-radius` | 2 | Borde y radio de la ventana sin marco. |
| `--body-pad-top` | 2 | Relleno bajo la barra de título; lo ajusta `app.css`. |
| `--drawer-shadow` | 1 | Sombra del cajón lateral. |

## ui-glass (analizador-trafico)

Hoja: `packages/ui-glass/src/tokens.css`. Marca: `zutool` (misma paleta; `ui-glass` no tiene marca
propia). Solo tiene tema oscuro.

- Variables que declara la hoja antigua: 102
- Con alias a un token: 66
- Sin equivalente (se quedan en la app): 36
- A renombrar en el código: 0
- Comparaciones de valor iguales: 57; con diferencia visible: 9 (oscuro)

### Pasos

1. Copiar `tokens/dist/compat/ui-glass.app.css` a `packages/ui-glass/src/app-tokens.css` y exportarlo
   en `packages/ui-glass/package.json` (`"./app-tokens.css": "./src/app-tokens.css"`).
2. Añadir el alias en `apps/dashboard/farm.config.ts`, junto a los de `tokens.css` y `glass.css`:
   `"@trafico/ui-glass/app-tokens.css": pkg("ui-glass", "app-tokens.css")`.
3. En `apps/dashboard/src/main.tsx`, cambiar la importación de la hoja:

   ```ts
   // antes
   import "@trafico/ui-glass/tokens.css";
   import "@trafico/ui-glass/glass.css";

   // después
   import "@zuccadev-labs/zuix-tokens/css/zutool.css";
   import "@zuccadev-labs/zuix-tokens/compat/ui-glass.css";
   import "@trafico/ui-glass/app-tokens.css";
   import "@trafico/ui-glass/glass.css";
   ```

4. Borrar `packages/ui-glass/src/tokens.css`, su entrada en `exports` y su alias en `farm.config.ts`.
5. Verificar: compilar el dashboard y repasar la tabla de diferencias.

No hay nada que renombrar.

### Diferencias visibles

| Variable | Usos | Token | Tema | Antes | Después | Nota |
|---|---|---|---|---|---|---|
| `--sky-500` | 0 | `{p.sky-500}` | oscuro | `#60a5fa` | `#74b0fb` | El primitivo se aclaró en zuix para que el Badge informativo llegue a 4.5:1. |
| `--info` | 1 | `{info}` | oscuro | `#60a5fa` | `#74b0fb` | Sigue a `sky-500`: azul más claro en oscuro; en claro pasa a un azul con contraste sobre blanco. |
| `--info-soft` | 1 | `{info-soft}` | oscuro | `rgba(96, 165, 250, 0.18)` | `rgba(116, 176, 251, 0.18)` | Derivado de `info` (18 %). |
| `--card-bg` | 0 | `{card-bg}` | oscuro | `rgba(255, 255, 255, 0.07)` | `rgba(255, 255, 255, 0.06)` | La tarjeta usa `surface`: un punto menos de opacidad. |
| `--card-border` | 0 | `{card-border}` | oscuro | `rgba(255, 255, 255, 0.1)` | `rgba(255, 255, 255, 0.09)` | La tarjeta usa `line`: un punto menos de opacidad. |
| `--card-shadow` | 0 | `{card-shadow}` | oscuro | `0 14px 34px -22px rgba(0, 0, 0, 0.55)` | `0 8px 24px -10px rgba(0, 0, 0, 0.6)` | La tarjeta usa `shadow-md`: sombra más corta y algo más densa. |
| `--card-muted` | 0 | `{fg-muted}` | oscuro | `rgba(255, 255, 255, 0.62)` | `rgba(255, 255, 255, 0.7)` | Se une a `fg-muted`: texto algo más opaco. |
| `--brand-primary-bg` | 0 | `{button-primary-bg}` | oscuro | `#ff6118` | `#c2410c` | El botón primario usa `accent-solid` (`orange-700`): el naranja 500 no da 4.5:1 con texto blanco. |
| `--rail-active-bg` | 0 | `{accent-solid}` | oscuro | `#ff6118` | `#c2410c` | El elemento activo del rail lleva texto blanco: usa `accent-solid` por el mismo motivo. |

### Sin equivalente

| Variables | Usos | Motivo |
|---|---|---|
| `--amber-500` | 0 | Primitivo que solo alimenta tokens de dominio (`--node-data`, `--edge-variable`); el ámbar de la marca es otro tono y es el de `warning`. |
| `--teal-500` | 0 | Primitivo que solo alimenta `--node-component`. No está en la paleta de la marca. |
| `--violet-500` | 0 | Primitivo que solo alimenta `--node-layout`. No está en la paleta de la marca. |
| `--canvas-dot` | 0 | Trama de puntos del lienzo de la aplicación. |
| `--rail-bg` | 0 | Fondo propio del rail, más opaco que el cristal. zout usa el material del panel. |
| `--search-bg`, `--search-fg`, `--search-placeholder` | 0 | Campo de búsqueda de la cabecera de la aplicación. |
| `--header-icon`, `--header-icon-hover` | 0 | Iconos de la cabecera de la aplicación. |
| `--kpi-soft`, `--kpi-soft-fg`, `--kpi-soft-muted`, `--kpi-solid` | 0 | Tarjetas KPI de la aplicación (documento 02 de investigación: no se heredan). |
| `--node-component`, `--node-component-soft`, `--node-data`, `--node-data-soft`, `--node-document`, `--node-document-soft`, `--node-folder`, `--node-folder-soft`, `--node-layout`, `--node-layout-soft`, `--node-render`, `--node-render-soft` | 0 | Tipos de nodo del grafo: dominio de la aplicación. |
| `--edge-import`, `--edge-link`, `--edge-variable` | 0 | Aristas del grafo: dominio de la aplicación. |
| `--shadow-node` | 0 | Sombra de los nodos del grafo. |
| `--chart-4xx`, `--chart-5xx`, `--chart-axis`, `--chart-grid`, `--chart-ok` | 5 | Paleta de gráficos de tráfico, validada para esa superficie. zuix no tiene tokens de gráficos. |
| `--sidebar-width` | 1 | El dashboard usa 264 px; el token de zuix vale 224 px. Se queda con su medida. |

## Riesgos

| Riesgo | A quién afecta | Qué hacer |
|---|---|---|
| `--z-overlay` significa cosas distintas: z-index en zutool, color en zuix | zutool escritorio | Renombrar los 6 usos antes de borrar la hoja. Si se olvida uno, ese `z-index` queda sin valor |
| zutool usa el prefijo `--z-` para sus capas; es el espacio de nombres de zuix | zutool | Las que se quedan (`--z-popup`, `--z-tour`, `--z-drag`…) funcionan hoy. Conviene renombrarlas a otro prefijo para que un token futuro no choque |
| El botón primario y el elemento activo del rail pasan de naranja 500 a naranja 700 | Los dos | Es intencionado: el 500 no da contraste 4.5:1 con texto blanco. Para conservar el tono antiguo, redefinir `--brand-primary-bg` y `--rail-active-bg` en `app-tokens.css` |
| El tema claro de zutool cambia de acento, colores de estado, lienzo y sombras | zutool | La hoja antigua conservaba en claro los valores del tema oscuro. Revisar el tema claro completo; lo que se quiera como antes se redefine en `app-tokens.css` bajo `:root[data-theme="light"]` |
| `ui-glass` no tenía tema claro y la marca sí | ui-glass | Mantener `data-theme="dark"` en `<html>`. Si se quita, los tokens pasan a claro y las variables de `app-tokens.css` (gráficos, cabecera) siguen en oscuro |
| Sin `data-theme`, zuix sigue la preferencia del sistema; las hojas antiguas eran oscuras por defecto | Los dos | No quitar el atributo de `<html>` |
| Los presets de tema de zutool escriben variables antiguas en `<html>` en tiempo de ejecución | zutool | Siguen funcionando: pisan el alias. Un componente de `zui`, que lee `--z-*`, no vería ese preset |
| Los alias se resuelven en `:root` | Los dos | Si una zona de la página redefine un token `--z-*`, las variables antiguas no lo siguen dentro de esa zona. Hoy ninguno de los dos lo hace |
| El azul informativo es más claro (`sky-500`) | Los dos | Cambio de accesibilidad heredado de zuix. Ningún paso |

## Cómo revertir

1. Restaurar `tokens.css` desde el control de versiones.
2. Devolver las importaciones a su forma anterior y borrar `app-tokens.css`.
3. En zutool, deshacer el renombre de `--z-overlay`.
4. Quitar la dependencia `@zuccadev-labs/zuix-tokens`.

Mientras no se borre la hoja antigua (paso 4 de cada proyecto) revertir es solo cambiar las
importaciones.

## Mantener la capa

- Si el proyecto añade una variable a su hoja antes de migrar, `pnpm tokens` falla hasta que se
  clasifique en `tokens/compat/<proyecto>.json`.
- Después de migrar, las variables nuevas del proyecto van a su `app-tokens.css`; la capa no crece.
- La capa es un puente. El final del camino es que el código escriba `var(--z-accent)` directamente y
  la capa se retire.

Las tablas de esta página se copian de `tokens/dist/compat/<proyecto>.report.md`. Si cambia el mapa o
una marca, hay que volver a copiarlas.

## Estado de la migración (2026-11-14)

Aplicada en ambos proyectos, en una rama `chore/zuix-tokens` y una carpeta de trabajo aparte
(un worktree de git), con commits locales y sin integrar. Las ramas principales no se tocaron.

| | zutool | ui-glass |
|---|---|---|
| Rama de partida | `feat/mobile-companion` (`ec3e169`) | `main` (`b2f12b1`) |
| Commits | 7 | 5 |
| Tipos, tests y build | Igual que antes: 532 y 90 tests pasan | Igual que antes |
| Tema oscuro | 10 de 11 pantallas idénticas al píxel | 7 vistas idénticas salvo datos de reloj |
| Cambio visible | Botón primario y rail activo más oscuros; tema claro entero | Azul del Badge informativo |

### Consumo: copia versionada, no enlace

Los dos proyectos descartaron `link:` y usan una copia de los CSS en `vendor/zuix-tokens/` con un
script de sincronización y comprobación. El último commit de cada rama (2026-11-14) adopta el nombre
`@zuccadev-labs/zuix-tokens` y resincroniza la copia con el `0.1.0` que se publica, que añade
`--z-touch-target`; tipos, tests y build siguen pasando. Motivos: su CI instala sobre un checkout que no contiene
zuix, `tokens/dist/` no está en git, y la ruta relativa cambia entre carpetas de trabajo. Con
`@zuccadev-labs/zuix-tokens` publicado, se instala por versión y se borra `vendor/` y el script.

- zutool usa npm, Farm y Tauri; importa los CSS por ruta relativa.
- El dashboard de ui-glass necesita dos alias en `farm.config.ts` para `@zuccadev-labs/zuix-tokens/*`.

### Al integrar

- zutool: si la rama destino cambió `tokens.css`, habrá conflicto de modificación contra borrado;
  las variables nuevas van a `app-tokens.css`. Un `var(--z-overlay)` nuevo usado como z-index debe
  ser `--z-layer-overlay`: si no, queda sin valor y no da error.
- zutool: `apps/engine-hub/web/signin.html` lleva una copia en línea de los tokens antiguos, sin migrar.

## Sin verificar

- Ninguno de los dos proyectos se ha compilado con la capa: no se aplicó nada en ellos.
- La resolución de `@import "@zuccadev-labs/zuix-tokens/…"` desde el CSS de zutool (Tailwind v4 con Vite) y los alias
  de Farm en el dashboard no se han probado.
- La app real de escritorio (Tauri) y la de Android de zutool, y el dashboard de ui-glass con datos
  reales: solo se probó el renderer en Chrome y el modo demo.
- El tema claro de móvil de zutool, que es el que más cambia.
- Sí se comprobó en Chrome que, con la marca, la capa y `app-tokens.css`, cada variable antigua (126 de zutool,
  102 de `ui-glass`) resuelve a un valor, y que los colores que cambian son exactamente los de las tablas.
- La búsqueda de usos reconoce `var(--x)`, nombres entre comillas y la forma corta de Tailwind
  (`bg-(--x)`). Un nombre construido en tiempo de ejecución no se detecta.
