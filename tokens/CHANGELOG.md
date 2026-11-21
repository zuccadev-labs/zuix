# Cambios de @zuccadev-labs/zuix-tokens

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

Base visual nueva, «liquid glass»: escala tipográfica en `rem`, radios concéntricos, capas de material y foco
por contorno. Ningún token se elimina ni se renombra; cambian valores y se añaden tokens.

### Añadido

- ColorPicker: `colorpicker-spectrum` (paradas del espectro de tono para el deslizador), `colorpicker-white` y
  `colorpicker-black` (extremos del área de saturación y brillo y anillo de los tiradores). Son colores de la
  propia escala de color, no de marca: iguales en todas las marcas y temas.
- QRCode: `qrcode-dark` y `qrcode-light`. Un código QR se lee oscuro sobre claro en cualquier tema.
- Gráficos: series `chart-1…8` (nivel component, mezclas de `info`, `warning`, `danger`, `success`, `fg` y
  `surface-solid`), validadas a ≥ 3:1 contra todas las superficies en `contrast.nonText` y ordenadas para que las
  series vecinas se distingan con daltonismo (ΔE OKLab de pares adyacentes ≥ 8 con protanopía/deuteranopía salvo
  un par de 7,6 en dazlabs claro, que cubren marcadores y tramas); `chart-grid`, `chart-baseline`, `chart-height`,
  `chart-bar-max`, `chart-bar-radius`, `chart-area-opacity` y `chart-line-width`.
- `space-0-5` (2 px): el paso más pequeño de la escala de espacio, para los huecos entre opciones de una pista
  (segmentado, pestañas) y los rellenos finos que antes eran `2px` literales.
- Agenda: rampa del mapa de calor `heatmap-hue` (`accent-text`) y `heatmap-0…4`, y `perpetual-side-bg`
  (panel del año perpetuo). El validador mide `fg-on-accent` sobre `perpetual-side-bg` (y al revés) y los
  niveles 3 y 4 como indicadores; los niveles 1 y 2 no llegan a 3:1, como cualquier rampa de cinco pasos de un
  tono, y el componente lo compensa (valor en el nombre, tabla, tamaño y filo con contraste alto).
- Agenda (nivel component): paleta de calendarios `calendar-color-1…6` (derivada de los semánticos), evento
  (`event-tint`, `event-radius`, `event-bar-width`, `event-fg`, `event-fg-muted`, `event-solid-1…6` para el
  seleccionado), rejilla de horas (`timegrid-hour`, 64 px con puntero grueso; `timegrid-gutter`) y estados
  (`calendar-now`, `calendar-now-label-bg`, `calendar-weekend-bg`, `calendar-drop-bg`). El validador mide
  `fg-on-accent` sobre `event-solid-1…6` y los colores de calendario como no texto (3:1).
- Tipografía: `text-code` (13 px), `text-reading` (16 px), `text-lead` (fluido, 18–20 px), `weight-display`,
  `leading-ui` (1.43), `leading-code` (1.7), `tracking-display` (−0.03em) y `tracking-snug` (−0.01em).
- Espaciado: `space-3-5` (14 px), `space-7` (28), `space-9` (36) y `space-14` (56).
- Movimiento: `duration-press` (90 ms) para la pulsación, `ease-emphasized` para entradas y `ease-exit` para
  salidas.
- Foco: `focus-width` y `focus-offset` (2 px y 2 px; `focus-width` sube a 3 px con `prefers-contrast: more`).
- Controles: `control-height-xl` (48 px) y `control-radius-xl` (14 px) para el botón `xl`.
- Controles: `control-height-xs` (24 px), `control-radius-sm` (8 px), `control-radius-lg` (12 px),
  `control-bg-hover`, `field-radius-multiline` e `item-radius`.
- Material: `glass-blur-elevated` (48 px), `popup-blur`, `popup-shadow`, `glass-rim`, `fg-prose` (texto de
  lectura, `fg` al 88 %), `code-radius` y `code-bar-bg`.
- Calendario: `calendar-cell`, `calendar-cell-radius`, `calendar-range-bg` y `calendar-today-ring`.
- Sitio de documentación: `docs-navbar-height`, `docs-sidebar-width`, `docs-rail-width`, `docs-article-max`,
  `docs-gutter` y `docs-gap`.
- El validador de contraste mide además las superficies de lectura, de código sobre lectura y de control
  sobre cristal, y el texto `fg-prose`.

### Cambiado

- Los tamaños de texto pasan de `px` a `rem` y respetan el tamaño de letra de la persona: `text-body` de
  13.5 a 14 px (`0.875rem`), `text-small` de 12 a 13, `text-caption` de 11 a 12, `text-fine` de 10 a 11,
  `text-title` de 14 a 16, `text-heading` de 15 a 18 y `text-heading-lg` de 18 a 20. `text-display-sm`,
  `text-display` y `text-display-lg` son fluidos (22–26, 28–36 y 36–48 px).
- Interlineado: `leading-tight` de 1.15 a 1.1, `leading-snug` de 1.3 a 1.25 y `leading-relaxed` de 1.7 a
  1.625.
- Alturas de control: `control-height-sm` de 30 a 28 px, `md` de 36 a 34 y `lg` de 44 a 40 (el mínimo táctil
  sigue en 40).
- `button-radius` pasa de `radius-full` (píldora) a `control-radius` (10 px): botones y controles son
  rectángulos de esquinas redondeadas.
- `radius-xl` de 22 a 20 px; `card-radius` de `radius-lg` a `radius-xl`; `card-shadow` de `shadow-md` a
  `shadow-sm`; `popup-radius` de `radius-md` a `radius-lg`.
- `reading-bg` pasa de `surface-solid` a `surface-solid` al 94 %; con `prefers-contrast: more` vuelve a ser
  opaco.
- `focus-ring` es doble (`0 0 0 2px canvas, 0 0 0 4px accent-ring`); los componentes dibujan el foco con
  contorno.
- `duration-fast` de 120 a 150 ms; `glass-saturate` de 160 % a 180 %.
- `overlay` más translúcido para el cristal elevado: 0.88 en oscuro y 0.90 en claro (antes 0.94 y 0.96), en
  las tres marcas.
- `danger-text` en tema claro sube de contraste: `dazlabs` 70 %, `zutool` 64 % y `zenith` 68 % de `danger`.
- Fuentes: `dazlabs` usa DM Sans también en los titulares (antes Poppins); `zenith` pasa a la familia base de
  la suite, Geist y Geist Mono (antes Inter y JetBrains Mono). Los paquetes no incluyen archivos de fuente.
- Capas de compatibilidad `zutool` y `ui-glass`: notas nuevas para `card-radius`, `card-shadow`, `radius-xl` y
  `overlay`.
- `success-text` en claro más oscuro en `zutool` (62 % de `success`, antes 68 %) y `zenith` (68 %, antes 74 %):
  sobre `success-soft` compuesto en una tarjeta quedaba en 4,42–4,45:1 (axe en `examples/html`).


## [0.2.0] - 2026-11-18

Ningún token se elimina ni se renombra. Cambian valores para cumplir el contraste de WCAG 2.2 AA, que ahora
se mide sobre los pares de color que las hojas usan de verdad. Qué revisar en una aplicación está en la
[guía de actualización](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/08-actualizar-de-0-1-a-0-2.md).

### Cambios incompatibles

- Node 22.12 o posterior (antes, 20). Node 20 terminó su soporte el 2026-04-30.
- `--z-fg-subtle` sube de opacidad en todas las marcas y temas para llegar a 4.5:1 como texto (oscuro: de
  0.48 a entre 0.52 y 0.60; claro: de 0.50 a entre 0.59 y 0.64).
- `--z-control-border` pasa de `--z-line` (1.2:1) a `--z-fg` al 50 % (3:1, WCAG 1.4.11) y
  `--z-control-border-hover` a `--z-fg-muted`: los campos de formulario tienen un borde más marcado.
- `--z-accent-ring` (y con él `--z-focus-ring`) pasa de `--z-accent` al 45 % (entre 1.4 y 2.2:1) a
  `--z-accent-text`, opaco: el anillo de foco llega a 3:1 sobre cualquier superficie.
- `--z-accent-solid-hover` oscurece en lugar de aclarar, para conservar 4.5:1 con el texto blanco.
- Marca `zutool`, tema oscuro: el degradado del fondo se atenúa (el texto blanco de la barra de título
  quedaba a 2.5:1 sobre sus manchas claras; ahora 6.6:1), `canvas-fg-muted` pasa de 0.72 a 0.80, `fg-muted` de
  0.70 a 0.74 y el cristal de 0.66 a 0.82 de opacidad. Marca `dazlabs`, tema oscuro: cristal de 0.66 a 0.72.

Son ajustes de valor dentro de la intención de cada token, pero cambian el aspecto de forma visible: por eso
van aquí.

### Añadido

- Tokens de texto `--z-accent-text`, `--z-success-text`, `--z-warning-text`, `--z-danger-text` y
  `--z-info-text`: el color de marca o de estado mezclado con `--z-fg` hasta llegar a 4.5:1 sobre todas las
  superficies y sobre su propio fondo suave (`-soft`). `--z-accent`, `--z-success`… quedan para rellenos,
  bordes, iconos e indicadores (3:1).
- Tokens de fondo sólido `--z-success-solid`, `--z-warning-solid`, `--z-danger-solid` y `--z-info-solid`:
  fondos sobre los que `--z-fg-on-accent` llega a 4.5:1 en los dos temas, como ya hacía `--z-accent-solid`.
- Tokens de escala `--z-space-1-5` (6 px) y `--z-space-2-5` (10 px), y de capa `--z-layer-below` y
  `--z-layer-raised`, para el apilamiento local dentro de un componente.
- `prefers-contrast: more`: `fg-muted` pasa a `fg`, líneas y bordes de control se refuerzan y el cristal y el
  degradado del fondo se vuelven opacos (sección `moreContrast` de `src/base.json`, también en
  `tokens.json`).
- `forced-colors: active`: se retiran el degradado del fondo y el destello del cristal, que el sistema no
  fuerza (sección `forcedColors`).
- Salida en formato Design Tokens (DTCG 2025.10): `@zuccadev-labs/zuix-tokens/dtcg/<marca>.<tema>.tokens.json`,
  un archivo autocontenido por marca y tema. Lo que el formato no expresa (`clamp()`, `max()`, degradados,
  unidades `em` y `ch`) va con su valor CSS en `$extensions`.
- Validación al generar: cada marca se comprueba contra `schema/brand.schema.json`; se detectan referencias
  circulares, tokens que solo define un tema y claves de `scale` que no existen. El contraste se mide sobre
  la matriz completa de texto por superficie, sobre los pares reales de las hojas de `zui` y `zout` (texto
  4.5:1; gráficos y bordes de control 3:1) y sobre el foco, componiendo las superficies translúcidas sobre
  los extremos del degradado del fondo. Un par que no se puede resolver es un error.
- `tailwind.css`: utilidades para los tokens nuevos (`text-accent-text`, `bg-success-solid`…).
- Entradas `./css/dazlabs.css`, `./css/zenith.css` y `./css/zutool.css` explícitas, además del comodín.

### Corregido

- Validación de contraste: un color con un número que no lo es (`rgb(0 0 1e999)`, un porcentaje `..%` en
  `color-mix()`) se rechaza como valor ilegible. Antes daba un contraste `NaN`, que no es menor que ningún
  umbral y pasaba. Un valor llamado `constructor` o `__proto__` ya no lanza una excepción.
- `tailwind.css`: la variante `dark:` sigue al tema de los tokens también sin `data-theme`, cuando manda el
  sistema.
- El umbral de la luminancia relativa usa el valor de WCAG 2.2 (0,04045).

## [0.1.0] - 2026-11-14

Primera versión publicada.

### Añadido

- Contrato de tokens `--z-*` en tres niveles: escala, semánticos y de componente.
- Marcas como archivos en `brands/` (una marca es un archivo), validadas con `schema/brand.schema.json`, y
  dos temas (`dark`, `light`).
- Salidas generadas en `dist/`: `tokens.css` (todas las marcas, elegidas con `data-brand` y `data-theme`),
  `brands/<marca>.css` (una sola marca), `tailwind.css`, `docusaurus.css` y `tokens.json`.
- Validación al generar: tokens obligatorios por marca y tema, y contraste WCAG.
- Token de escala `--z-touch-target`: objetivo táctil mínimo. Vale `0px` y pasa a `40px` bajo
  `@media (pointer: coarse)` (sección `coarse` de `src/base.json`, que también sale en `tokens.json`).
  `--z-control-height-sm` y `--z-control-height-md` valen `max(30px, …)` y `max(36px, …)` sobre ese token: con
  ratón, 30 y 36 px; con el dedo como puntero principal, 40 px. Para desactivarlo:
  `:root { --z-touch-target: 0px }` después de `tokens.css`.
- Capas de compatibilidad (`@zuccadev-labs/zuix-tokens/compat/<proyecto>.css`): las variables antiguas de un
  proyecto como alias de tokens, generadas desde un mapa declarativo `compat/<proyecto>.json` validado con
  `schema/compat.schema.json`. `source.env` del mapa es el nombre de una variable de entorno
  (`ZUIX_COMPAT_<PROYECTO>_ROOT`) con la ruta del proyecto: el mapa no contiene rutas de la máquina de quien
  lo escribió. Sin la variable se usa la instantánea `compat/<proyecto>.inventory.json`, que no se publica.
- `README.md` en el paquete publicado.
