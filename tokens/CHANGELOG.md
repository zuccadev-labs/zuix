# Cambios de @zuccadev-labs/zuix-tokens

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

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
