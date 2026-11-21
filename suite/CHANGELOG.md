# Cambios de @zuccadev-labs/zuix

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

## [0.3.0] - 2026-11-21

### Añadido

- Subrutas `./zui/dom/core`, `./zui/dom/dates`, `./zui/dom/data`, `./zui/dom/content`, `./zui/dom/agenda`,
  `./zui/dom/charts`, `./zui/dom/color`, `./zui/dom/media` y `./zui/dom/effects`: el comportamiento sin framework
  de `@zuccadev-labs/zuix-zui` por familias.

### Cambiado

- `./zui/dom` deja de figurar en `sideEffects`: como `@zuccadev-labs/zuix-zui/dom`, no hace nada al importarse.

## [0.2.0] - 2026-11-18

El paraguas no tiene código propio: los cambios de esta versión, incluidos los incompatibles, están en el
`CHANGELOG.md` de cada paquete y reunidos en la [guía de actualización](https://github.com/zuccadev-labs/zuix/blob/main/docs/users/08-actualizar-de-0-1-a-0-2.md).

### Cambios incompatibles

- Node 22.12 o posterior (antes, 20). Node 20 terminó su soporte el 2026-04-30.
- Deja de instalarse `radix-ui`, que llegaba por `@zuccadev-labs/zuix-zui`. Un proyecto que solo usa las
  subrutas sin framework ya no instala React.

### Añadido

- Entradas `/zui/dom/carousel-gl`, `/tokens/dazlabs.css`, `/tokens/zutool.css`, `/tokens/zenith.css` (una sola
  marca en `:root`), `/tailwind.css` y `/docusaurus.css`.

## [0.1.0] - 2026-11-14

Primera versión publicada.

### Añadido

- Paquete paraguas: instala `@zuccadev-labs/zuix-tokens`, `@zuccadev-labs/zuix-zicon`,
  `@zuccadev-labs/zuix-zui` y `@zuccadev-labs/zuix-zout` y los reexporta bajo subrutas (`/zui`, `/zui/dom`, `/zout`,
  `/zout/dom`, `/zicon`, `/zicon/core`, `/zicon/dom`, `/zicon/element`, `/zicon/all`, `/styles.css`,
  `/tokens.css`). La entrada raíz exporta los espacios de nombres `zui`, `zout` y `zicon`.
- `react` y `react-dom` 19 son peers opcionales: solo los necesitan `/zui`, `/zout`, `/zicon`, `/zicon/core` y
  la entrada raíz.
