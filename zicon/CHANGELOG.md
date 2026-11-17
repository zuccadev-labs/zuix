# Cambios de @zuccadev-labs/zuix-zicon

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

### Añadido

- `iconElement(name, opciones)` en `@zuccadev-labs/zuix-zicon/dom`: el icono como elemento SVG construido con el
  DOM, sin `innerHTML`.
- `onIconsRegistered(fn)`: avisa cuando se registran iconos.

### Corregido

- `<z-icon>` funciona con Trusted Types (`require-trusted-types-for 'script'`): dibuja con el DOM, no con
  `innerHTML`.
- `<z-icon>` conectado antes de registrar su icono se dibuja al registrarlo (antes quedaba vacío para siempre).
- `<z-icon hidden>` se oculta (el `display: contents` en línea ganaba al atributo).
- `iconSvg()` reduce `variant` a `outline` o `solid` y escapa los trazados: ningún valor llega al marcado sin
  escapar.
- `Icon` con `aria-label` o `aria-labelledby` (sin `label`) ya no lleva `aria-hidden`.
- `sprite.svg` oculta su raíz con el atributo `display="none"` en lugar de `style`: incrustado en una página con
  una política de seguridad de contenido sin estilos en línea, sigue oculto.
- La generación valida cada icono (trazados dentro de la caja, identificador de módulo único y no reservado,
  categoría existente) y que el sprite no repita ids.

## [0.1.0] - 2026-11-14

Primera versión publicada.

### Añadido

- 346 iconos en dos variantes (`outline`, `solid`), caja de 24 × 24, color heredado con `currentColor`.
- `@zuccadev-labs/zuix-zicon`: componente `Icon` de React con el set completo registrado.
- `@zuccadev-labs/zuix-zicon/core`: `Icon` y el registro (`registerIcons`, `getIcon`, `registeredIconNames`) sin datos, para
  incluir solo los iconos que se usen.
- `@zuccadev-labs/zuix-zicon/icons/<nombre>`: un módulo por icono. `@zuccadev-labs/zuix-zicon/all` registra el set completo.
- `@zuccadev-labs/zuix-zicon/dom`: `iconSvg()`, `iconPaths()` y `defineIconElement()`, sin React.
- `@zuccadev-labs/zuix-zicon/element`: define `<z-icon name variant size label>` con el set completo.
- `sprite.svg` (`#nombre` y `#nombre-solid`) y un archivo por icono en `svg/outline/` y `svg/solid/`.
- `manifest.json`: nombre, categoría y palabras clave en inglés y español de cada icono, y 152 emojis
  mapeados a su icono.
- `dist/zicon.element.js`: `<z-icon>` listo para enlazar sin bundler.
- Tipo `IconName`: un nombre que no existe no compila.
- Salida de publicación: ESM compilado módulo a módulo con declaraciones en `dist/esm/`.
- `README.md` en el paquete publicado.
