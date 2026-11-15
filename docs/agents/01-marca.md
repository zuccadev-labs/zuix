# Cambiar de marca

Una marca es un archivo: `tokens/brands/<nombre>.json`. Los componentes no se tocan.

## Pasos

1. Copiar `tokens/brands/dazlabs.json` a `tokens/brands/<nombre>.json`.
2. Cambiar `name` y `label`.
3. Definir los **primitivos**: la paleta en bruto de la marca.
4. Definir las **fuentes**: `display`, `sans` y `mono`.
5. Asignar los **semánticos** de cada tema (`dark` y `light`) con `{p.nombre}`.
6. Ejecutar `pnpm tokens`.

```json
{
  "$schema": "../schema/brand.schema.json",
  "name": "acme",
  "label": "Acme",
  "primitives": { "blue-500": "#2563EB", "blue-700": "#1D4ED8", "ink": "#0B1220" },
  "fonts": { "display": "\"Sora\", sans-serif", "sans": "\"Inter\", sans-serif", "mono": "\"JetBrains Mono\", monospace" },
  "themes": {
    "dark": { "accent": "{p.blue-500}", "accent-solid": "{p.blue-700}", "canvas": "{p.ink}" },
    "light": { "accent": "{p.blue-700}" }
  }
}
```

El ejemplo está recortado: cada tema debe definir todos los tokens obligatorios. `pnpm tokens` lista los
que falten.

## Qué valida `pnpm tokens`

| Comprobación | Mínimo |
|---|---|
| Texto principal y atenuado sobre la superficie de lectura | 4.5 |
| Texto sutil sobre la superficie de lectura | 3 |
| Texto sobre cristal y sobre capas flotantes | 4.5 |
| Texto sobre el acento sólido (botón primario) | 4.5 |
| Acento como texto o icono sobre la superficie de lectura | 3 |

Si el acento de la marca no da contraste con texto blanco, se define `accent-solid` con un tono más
oscuro. `accent` se queda para texto, iconos y enlaces.

## Usar la marca

| Dónde | Cómo |
|---|---|
| Una aplicación con una sola marca | Importar `@zuccadev-labs/zuix-tokens/css/<nombre>.css` |
| Varias marcas a la vez | Importar `@zuccadev-labs/zuix-tokens/tokens.css` y poner `data-brand="<nombre>"` en `<html>` |
| El sitio de documentación | `"brand": "<nombre>"` en `zudocs/zudocs.config.json` |
| Marca por defecto de la suite | `tokens/config.json` |

El tema se elige con `data-theme="dark"` o `"light"` en `<html>`.

## Lo que una marca puede cambiar además del color

- **Escala** (`scale`): radios, espaciado, medidas de layout como `sidebar-width`.
- **Tokens de componente** (`component`): por ejemplo `button-radius` para botones rectos.

## Terminado cuando

`pnpm tokens` pasa sin fallos en ambos temas y `pnpm style-audit` sigue en cero.
