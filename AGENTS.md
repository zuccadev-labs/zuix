      • Zuix (Suite de UI/UX): Conjunto de paquetes para armar una suite de
      funcionalidades para automatizar componentes y UI (raíz de este repositorio).
      • Zout: Paquete estándar para layouts y ventanas dinámicas de
      proyectos (`zout/`).
      • Zui: Paquete estándar en sistema de componentes, con creador de
      componentes y páginas (`zui/`).
      • Zicon: Estándar iconográfico de la suite.

      
## Trabajar en este repositorio

- La suite no es solo para React: el estándar es HTML + CSS + tokens (`zui/html.json`), con comportamiento
  sin framework en `@zuccadev-labs/zuix-zui/dom` e iconos `<z-icon>`. React es un binding. Ver `docs/agents/04-otros-frameworks.md`.
- Workspace de pnpm: `tokens/`, `zicon/`, `zui/`, `zout/`, `suite/`, `zudocs/`, `examples/*`.
- Se publican cinco paquetes, con la misma versión: `@zuccadev-labs/zuix-tokens`, `@zuccadev-labs/zuix-zicon`,
  `@zuccadev-labs/zuix-zui`, `@zuccadev-labs/zuix-zout` y el paraguas `@zuccadev-labs/zuix` (`suite/`), que solo
  reexporta a los otros cuatro: una entrada nueva en un paquete que deba verse por el paraguas se añade también
  en `suite/` (`.js`, `.d.ts` y `exports`). `zudocs/` y `examples/app` son privados.
- Entre paquetes publicables se depende con `workspace:^`. `@zuccadev-labs/zuix-zicon` es `peerDependency` de `zui`
  y `zout` (una sola copia del registro de iconos), nunca `dependency`.
- Guías por paquete: `zui/AGENTS.md`, `zicon/AGENTS.md`. Guía general: `docs/agents/README.md`.
- Verificación: `pnpm check` (tokens, iconos, auditoría de estilo, manifiestos, contrato HTML, tipos) y
  `pnpm --filter @zuccadev-labs/zuix-zudocs build`. Un cambio está terminado cuando ambos pasan. Si toca interacción:
  `pnpm test:html` (sin React) y `pnpm test:browser` (aplicación de ejemplo de React). Si toca lo que se
  publica (`package.json`, entradas de `exports`, archivos nuevos en `src/`, `tools/build.mjs`):
  `pnpm build` y `pnpm test:pack` (empaqueta y consume los paquetes fuera del workspace). Ver `docs/package/`.
- Antes de una release: `pnpm verify` encadena todo lo anterior (suites de navegador en Chromium). Los
  runners de CI no ofrecen WebGL en Firefox: `NO_WEBGL=1 BROWSER=firefox pnpm test:browser` lo reproduce.
- Publicación: los cinco paquetes están en npmjs.com. Publica `.github/workflows/release.yml`, solo, cuando
  llega a `main` una versión de `package.json` que no está en el registro (`pnpm bump` → pull request →
  fusión); también crea la etiqueta `vX.Y.Z` y el GitHub Release. Ver `docs/package/02-publicacion.md`. Por
  eso la versión solo se toca en el pull request de la subida. Un agente no publica ni crea etiquetas:
  `pnpm publish` y `npm publish` solo con `--dry-run` o contra un registro local.
- El repositorio es público: sin rutas absolutas, nombres de proyectos privados ni credenciales en archivos
  versionados. Una herramienta que lee de fuera recibe la ruta por argumento o variable de entorno. Ver
  `docs/package/04-apertura-del-repositorio.md`. Contribución: `CONTRIBUTING.md`.
- Cada `package.json` publicable tiene dos mapas: `exports` (fuente, para el workspace) y
  `publishConfig.exports` (`dist/`, para el paquete publicado). Una entrada nueva va en los dos.
- Un componente con hooks, contexto, Radix o manejadores de eventos propios empieza por `"use client";`.
- Un cambio visible se anota en "Sin publicar" del `CHANGELOG.md` de su paquete.
- No se editan a mano: `tokens/dist/`, `zicon/src/icons/`, `zicon/src/names.ts`, `zicon/src/all.ts`,
  los `manifest.json` y `html.json` de la raíz de cada paquete, `*/dist/`, `zicon/sprite.svg`,
  `examples/html/index.html` ni `zudocs/static/llms.txt`.
- Las capas de compatibilidad salen de `tokens/compat/*.json`; no se edita `tokens/dist/compat/`. El piloto de zudocs sobre Zenith (`examples/zenith-docs/`) no se versiona: Zenith es privado.
- Documentación en `docs/`, en español, por áreas (`users`, `agents`, `investigations`, `package`).
