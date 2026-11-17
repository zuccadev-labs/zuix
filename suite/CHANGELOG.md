# Cambios de @zuccadev-labs/zuix

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado: semver, con la misma
versión en toda la suite ([Versionado](https://github.com/zuccadev-labs/zuix/blob/main/docs/package/01-versionado.md)).

## [Sin publicar]

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
