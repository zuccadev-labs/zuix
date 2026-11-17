# Cambios de @zuccadev-labs/zuix-tokens

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

### Añadido

- Tokens de texto accesible `--z-accent-text`, `--z-success-text`, `--z-warning-text`, `--z-danger-text` y
  `--z-info-text`: el color de marca o de estado mezclado con `--z-fg` hasta llegar a 4.5:1 sobre todas las
  superficies y sobre su propio fondo suave (`-soft`). `--z-accent`, `--z-success`… quedan para rellenos, bordes,
  iconos e indicadores (3:1).
- Tokens de fondo sólido `--z-success-solid`, `--z-warning-solid`, `--z-danger-solid` y `--z-info-solid`: fondos
  sobre los que `--z-fg-on-accent` llega a 4.5:1 en los dos temas (como ya hacía `--z-accent-solid`).
- `prefers-contrast: more`: `fg-muted` pasa a `fg`, líneas y bordes de control se refuerzan y el cristal y el
  degradado del fondo se vuelven opacos (sección `moreContrast` de `src/base.json`, también en `tokens.json`).
- `forced-colors: active`: se retiran el degradado del fondo y el destello del cristal, que el sistema no fuerza
  (sección `forcedColors`).
- Salida en formato Design Tokens (DTCG 2025.10): `@zuccadev-labs/zuix-tokens/dtcg/<marca>.<tema>.tokens.json`,
  un archivo autocontenido por marca y tema. Lo que el formato no expresa (`clamp()`, `max()`, degradados,
  unidades `em` y `ch`) va con su valor CSS en `$extensions`.
- Validación: cada marca se comprueba contra `schema/brand.schema.json` al generar; se detectan referencias
  circulares, tokens que solo define un tema y claves de `scale` que no existen. El contraste se mide sobre los
  pares reales de las hojas de `zui` y `zout` (texto 4.5:1, gráficos y bordes de control 3:1), componiendo las
  superficies translúcidas sobre los extremos del degradado del fondo. Los pares que debe corregir otra hoja se
  anotan en `src/contrast-baseline.json`.
- `tailwind.css`: utilidades para los tokens nuevos (`text-accent-text`, `bg-success-solid`…).
- Entradas `./css/dazlabs.css`, `./css/zenith.css` y `./css/zutool.css` explícitas (además del comodín).

### Cambiado

- `--z-fg-subtle` sube de opacidad en todas las marcas y temas para llegar a 4.5:1 como texto (oscuro: 0.48 →
  0.52–0.60; claro: 0.50 → 0.59–0.64).
- `--z-control-border` pasa de `--z-line` (1.2:1) a `--z-fg` al 50 % (3:1, WCAG 1.4.11) y
  `--z-control-border-hover` a `--z-fg-muted`: los campos de formulario tienen un borde más marcado.
- `--z-accent-ring` (y con él `--z-focus-ring`) pasa de `--z-accent` al 45 % (1.4–2.2:1) a `--z-accent-text`,
  opaco: el anillo de foco llega a 3:1 sobre cualquier superficie.
- `--z-accent-solid-hover` oscurece en lugar de aclarar, para conservar 4.5:1 con el texto blanco.
- Marca `zutool`, tema oscuro: el degradado del fondo se atenúa (el texto blanco de la barra de título quedaba a
  2.5:1 sobre sus manchas claras; ahora 6.6:1), `canvas-fg-muted` 0.72 → 0.80, `fg-muted` 0.70 → 0.74 y el cristal
  0.66 → 0.82 de opacidad. Marca `dazlabs`, tema oscuro: cristal 0.66 → 0.72.
- `tailwind.css`: la variante `dark:` sigue al tema de los tokens también sin `data-theme` (sistema).

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
