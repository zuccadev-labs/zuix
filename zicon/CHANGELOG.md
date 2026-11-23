# Cambios de @zuccadev-labs/zuix-zicon

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

### Añadido

- 20 iconos propios, dibujados por mí con el mismo lenguaje de línea que Dazicon y publicados bajo MIT:
  `anchor`, `car`, `cloud-rain`, `cloud-sun`, `compass`, `first-aid`, `fish`, `fuel`, `gauge`, `navigation`,
  `shield`, `ship`, `siren`, `snowflake`, `sunset`, `target`, `tv`, `utensils`, `waves` y `wind`. El set pasa
  de 346 a 366 iconos.
- Categorías `weather` (Clima) y `transport` (Transporte).
- 25 emojis más en la tabla de sustitución (⚓, 🚢, 🧭, 🌊, 🚨, 🎯, 📺…) y alias de uso para los iconos nuevos.
- `manifest.json`: `source` pasa de `"Dazicon"` a `"Dazicon y dibujos propios"`.

## [0.3.0] - 2026-11-21

Sin cambios en este paquete. La versión sube para seguir alineada con la suite.

## [0.2.0] - 2026-11-18

### Cambios incompatibles

- Node 22.12 o posterior (antes, 20). Node 20 terminó su soporte el 2026-04-30.

### Añadido

- `iconElement(name, opciones)` en `@zuccadev-labs/zuix-zicon/dom`: el icono como elemento SVG construido con
  el DOM, sin `innerHTML`.
- `onIconsRegistered(fn)`: avisa cuando se registran iconos.

### Corregido

- `iconSvg` no lanza con un `label` o un `className` que no se puede convertir a texto (un objeto sin
  prototipo): lo trata como vacío.
- `<z-icon>` funciona con Trusted Types (`require-trusted-types-for 'script'`): dibuja con el DOM, no con
  `innerHTML`.
- `<z-icon>` conectado antes de registrar su icono se dibuja al registrarlo. Antes quedaba vacío para
  siempre.
- `<z-icon hidden>` se oculta: el `display: contents` en línea ganaba al atributo.
- `iconSvg()` reduce `variant` a `outline` o `solid` y escapa los trazados: ningún valor llega al marcado sin
  escapar.
- `Icon` con `aria-label` o `aria-labelledby`, sin `label`, ya no lleva `aria-hidden`.
- `size` en `iconSvg()`, `iconElement()` y `<z-icon>` se valida en tiempo lineal. La expresión anterior
  retrocedía de forma cuadrática con una cadena larga de cifras seguida de un carácter inválido: 80 000
  caracteres en el atributo `size` bloqueaban la página unos doce segundos. Un `size` de más de 32 caracteres, o
  que no es número ni cadena, vale 16.
- `iconSvg()` escapa también la comilla simple (`&#39;`) y el valor de `width` y `height`, y no lanza si
  `name`, `label` o `className` llegan sin ser cadenas desde JavaScript sin tipos.
- `sprite.svg` oculta su raíz con el atributo `display="none"` en lugar de `style`: incrustado en una página
  con una política de seguridad de contenido sin estilos en línea, sigue oculto.
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
