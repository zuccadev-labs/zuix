# 04 · Componentes de referencia

Fecha: 2026-11-12.

## A. Carousel con efecto lente

Origen: la página de presentación del proyecto de origen (privado; no se cita su nombre ni su ruta).

| Archivo | Líneas | Papel |
|---|---|---|
| Componente principal (`.tsx`) | 953 | Componente: estado, gestos, animación, accesibilidad |
| `lensRenderer.ts` | 396 | Dibujo WebGL2 de las zonas curvas |
| `cardRaster.ts` | 216 | Copia cada tarjeta HTML a una textura |
| `lens.ts` | 146 | Geometría pura de la lente |

### Comportamiento

- Tira infinita con tres copias del contenido.
- El centro queda plano y los bordes se curvan en S, con ampliación horizontal y refracción.
- Arrastre con inercia y avance ligado al scroll de la página.
- Cursor propio "Ver" y apertura de la tarjeta a pantalla de sección con "Cerrar".
- Flechas, contador y anuncio para lectores de pantalla.

### Modos de dibujo

| Modo | Cuándo | Cómo |
|---|---|---|
| `gl` | Hay WebGL2 y las texturas cargaron | Centro en HTML real; bordes en WebGL |
| `css` | Sin WebGL2 o mientras carga | Cada tarjeta se deforma con `matrix3d` |
| `flat` | `prefers-reduced-motion` | Tira plana sin animación |

### Acoplamientos con el proyecto de origen

- `animejs` para animación, inercia y scroll.
- Iconos del design system base.
- Un tipo de datos y textos propios del dominio del proyecto.
- Clases propias dentro de la hoja global de esa aplicación (1.994 líneas).
- React 18.

### Extracción prevista

1. `Carousel` base en `zui`: pista, bucle, arrastre, ajuste, teclado y anuncios. Sin efecto.
2. Efecto lente como capa opcional sobre el `Carousel`. `lens.ts` se reutiliza tal cual.
3. Contenido por slots: la tarjeta la define quien lo usa.
4. Estilos movidos a tokens de la suite.

Pendiente: confirmar que el código de este proyecto de cliente puede reutilizarse en la suite.

## B. Referencias de `stack.txt`

| Referencia | Qué es | Distribución | Aporte a zuix |
|---|---|---|---|
| [Shark UI](https://shark-ui.com/) | 90+ componentes con tokens semánticos; React, Solid, Vue y Svelte | no indicada en la portada | Lista de control de "sistema completo" |
| [NeonBlade UI](https://neonbladeui.neuronrush.com/) | 41+ componentes React + Tailwind, estética neón | CLI o copiar y pegar | Efectos y variantes |
| [Dot Matrix](https://dotmatrix.zzzzshawn.cloud/) | unos 87 loaders de matriz de puntos | registro shadcn | Paquete de loaders |
| [remocn](https://remocn.dev/) | 932 componentes de movimiento para Remotion; MIT | registro shadcn | Motion para video, no UI de aplicación |
| [ArrowJS](https://arrow-js.com/) | framework reactivo de menos de 5 KB, sin build, con sandbox para agentes; MIT | npm | Alternativa a React |
| [Radix Primitives](https://github.com/radix-ui/primitives) | primitivos headless accesibles | npm | Capa de lógica de `zui` |

### Observaciones

- Dot Matrix y remocn usan un registro estilo shadcn: el código se copia al proyecto y se edita.
  NeonBlade ofrece CLI o copiar y pegar.
- Solo remocn y ArrowJS declaran licencia MIT en su página. El resto dice "open source" sin nombrarla.
- La portada de NeonBlade y la de Shark UI no listan el catálogo completo; se revisó solo lo visible.

### Criterio de uso

Las referencias sirven como catálogo y comportamiento a igualar. Los componentes se reimplementan sobre
los tokens de zuix. Copiar código fuente requiere revisar antes la licencia de cada una.

## C. Kits de Figma

- `Dazicon.fig` contiene botones, campos y chips (documento 03).
- `SISTEMAS DE DISEÑO.fig` y `Design System - Proyectos Regulares (…).fig`, en la misma carpeta,
  son candidatos a fuente de diseño de componentes. No se abrieron.

## D. Componentes propios ya escritos

| Fuente | Qué aporta |
|---|---|
| zutool: `apps/desktop/src/ui/primitives` | Primitivos liquid glass y `Popover` |
| zutool: `apps/desktop/src/ui/layout` | Shell: rail, sidebar, main, inspector, cajones |
| zutool: `apps/desktop/src/styles/zutool.css` | Pestañas, paneles divididos, divisores, cabecera de panel |
| analizador-trafico: `packages/ui-glass` | `GlassPanel`, `StatTile`, `Badge`, `DataTable` |
| Design system base | `Button`, `Input`, `Select`, `DateInput`, `Card`, `Avatar`, `Badge`, `Modal`, `Spinner`, `Tooltip`, `Toast`, `Skeleton`, `EmptyState`, `ErrorState`, `Rating`, `DataViz` |
