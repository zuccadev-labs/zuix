# Cambiar de marca

Una marca es un archivo: `tokens/brands/<nombre>.json`. Los componentes no se tocan.

## Reglas

1. La marca define primitivos, fuentes y los tokens semánticos de cada tema. No define componentes.
2. Cada tema (`dark` y `light`) define todos los tokens obligatorios. Un token que solo aparece en un tema es
   un error.
3. El contraste no se negocia: si `pnpm tokens` falla, se ajusta la marca, no la validación.
4. No se edita `tokens/dist/`: se regenera.

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

## Qué se deriva solo

Estos tokens salen de los que define la marca; solo se escriben si el derivado no llega al contraste.

| Token | Sale de |
|---|---|
| `accent-hover`, `accent-soft` | `accent` |
| `accent-solid`, `accent-solid-hover` | `accent`, oscurecido al pasar el puntero |
| `accent-text`, `success-text`, `warning-text`, `danger-text`, `info-text` | El color mezclado con `fg` |
| `success-solid`, `warning-solid`, `danger-solid`, `info-solid` | El color mezclado con negro |
| `accent-ring`, `focus-ring` | `accent-text` |
| `success-soft`, `warning-soft`, `danger-soft`, `info-soft` | El color al 18 o 20 % |

Si el acento de la marca no da contraste con texto blanco, se define `accent-solid` con un tono más oscuro,
como hacen las tres marcas incluidas en su tema oscuro.

## Qué valida `pnpm tokens`

| Comprobación | Mínimo |
|---|---|
| La marca cumple `schema/brand.schema.json`; sin referencias circulares; mismos tokens en los dos temas | — |
| Cada token de texto (`fg`, `fg-muted`, `fg-subtle`, los `-text`) sobre cada superficie | 4.5:1 |
| Texto sobre los fondos `-solid` y sobre el acento sólido | 4.5:1 |
| Cada par de color que usan las hojas de `zui` y `zout` | 4.5:1 en texto; 3:1 en iconos e indicadores |
| Borde de los controles y anillo de foco frente a lo que los rodea | 3:1 |

Las superficies translúcidas se componen sobre el lienzo y sobre los extremos de su degradado. Un degradado
con manchas claras en tema oscuro baja el contraste del texto que va sobre el cristal: si falla, se atenúa
el degradado o se sube la opacidad de `glass-bg`.

## Usar la marca

| Dónde | Cómo |
|---|---|
| Una aplicación con una sola marca | Importar `@zuccadev-labs/zuix-tokens/css/<nombre>.css` |
| Varias marcas a la vez | Importar `@zuccadev-labs/zuix-tokens/tokens.css` y poner `data-brand="<nombre>"` en `<html>` |
| El sitio de documentación | `"brand": "<nombre>"` en `zudocs/zudocs.config.json`, y sus fuentes en `fonts` |
| Marca por defecto de la suite | `tokens/config.json` |

El tema se elige con `data-theme="dark"` o `"light"` en `<html>`.

Una marca nueva que deba salir por el paraguas necesita además su entrada en `suite/`
(`tokens-<nombre>.css` y `exports`) y su entrada explícita en `tokens/package.json`.

## Lo que una marca puede cambiar además del color

- **Escala** (`scale`): radios, espaciado, medidas de layout como `sidebar-width`.
- **Tokens de componente** (`component`): por ejemplo `button-radius` para botones rectos.

## Verificación

| Comando | Objetivo |
|---|---|
| `pnpm tokens` | Sin fallos en los dos temas |
| `pnpm style-audit` | 0 |
| `pnpm test:unit tokens` | Sin fallos |
