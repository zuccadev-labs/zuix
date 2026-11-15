## Qué cambia

<!-- Qué hace el cambio y por qué. Enlaza el issue si existe. -->

## Paquetes afectados

- [ ] `@zuccadev-labs/zuix` (paraguas, `suite/`)
- [ ] `@zuccadev-labs/zuix-tokens`
- [ ] `@zuccadev-labs/zuix-zicon`
- [ ] `@zuccadev-labs/zuix-zui`
- [ ] `@zuccadev-labs/zuix-zout`
- [ ] `@zuccadev-labs/zuix-zudocs`
- [ ] Solo documentación, pruebas o herramientas

## Verificación

Marca lo que ejecutaste. Las dos primeras son obligatorias.

- [ ] `pnpm check`
- [ ] `pnpm --filter @zuccadev-labs/zuix-zudocs build`
- [ ] `pnpm test:html` y `pnpm test:browser` (si toca interacción)
- [ ] `pnpm build` y `pnpm test:pack` (si toca `package.json`, `exports`, archivos nuevos en `src/` o `tools/build.mjs`)

## Lista

- [ ] Los archivos generados (`manifest.json`, `html.json`, `examples/html/index.html`, `zudocs/static/llms.txt`…) salen de `pnpm check`, no de una edición a mano.
- [ ] El cambio visible está en "Sin publicar" del `CHANGELOG.md` de su paquete.
- [ ] Una entrada nueva de paquete está en `exports` y en `publishConfig.exports`.
- [ ] Un componente con hooks, contexto, Radix o manejadores propios empieza por `"use client";`.
- [ ] Sin colores, radios ni sombras literales, ni emojis como iconos (`pnpm style-audit` en 0).
- [ ] La documentación en `docs/` refleja el cambio.
- [ ] Sin rutas absolutas, nombres de proyectos privados, credenciales ni dominios de despliegue.

## Contrato público

Definido en `docs/package/03-contrato-publico.md`. Marca una:

- [ ] No cambia el contrato público.
- [ ] Lo amplía sin romper (componente, prop, variante, token, icono o evento nuevo).
- [ ] **Incompatible.** Está anotado con `**Incompatible:**` en el `CHANGELOG.md` y explica cómo migrar.
