# Cambios de @zuccadev-labs/zuix-tokens

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

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
