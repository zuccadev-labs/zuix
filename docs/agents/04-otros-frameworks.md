# Usar o extender zuix fuera de React

Formato: reglas → patrones → verificación. Guía de uso en [Frameworks](../users/06-frameworks.md).

## Reglas

1. **El contrato es HTML + CSS + tokens.** La apariencia de un componente vive en su hoja de estilos,
   por clases `z-*` y atributos (`data-state`, `data-size`, `aria-*`). Nunca en lógica de un framework.
2. **El marcado se copia del contrato.** Fuente: `zui/html.json` y `zout/html.json`. No se inventan
   clases ni estructura.
3. **Iconos con `<z-icon name="…">`** o `iconSvg()`. Sin SVG a mano ni emojis.
4. **Comportamiento con `@zuccadev-labs/zuix-zui/dom` y, en layouts, `@zuccadev-labs/zuix-zout/dom`.** No se reimplementa un diálogo, un
   menú, un cajón del `Shell` ni un divisor en la aplicación.
5. **Un componente nuevo se diseña primero como marcado.** Si su aspecto solo funciona con React, está
   mal hecho. El binding de React se escribe después y debe producir ese marcado.
6. **`behavior` dice la verdad.** `none`, `dom` o `react` en el manifiesto, según lo que hoy funciona.

## Patrones

### Página sin framework

```html
<body class="z-root z-canvas" data-z-dom>
  …marcado del contrato…
  <script type="module">
    import "@zuccadev-labs/zuix-zicon/element";
    import { init } from "@zuccadev-labs/zuix-zui/dom";
    init();
  </script>
</body>
```

### Componente en otro framework (ejemplo Svelte)

```svelte
<script>
  export let variant = "secondary";
  export let size = "md";
  export let icon;
</script>

<button type="button" class="z-btn z-btn--{variant}" data-size={size} {...$$restProps}>
  {#if icon}<z-icon name={icon} size="16"></z-icon>{/if}
  <slot />
</button>
```

### Marcado escrito a mano en un manifiesto

Lo que React monta por portal no aparece en el render estático. Su contrato se fija en el manifiesto:

```json
{
  "behavior": "dom",
  "html": [{ "title": "Modal con pie", "code": "<button data-z-open=\"#m\">…</button>\n<dialog id=\"m\" class=\"z-liquid z-modal\">…</dialog>", "script": "opcional" }]
}
```

### Añadir comportamiento a `zui/dom`

- Entrada: `zui/src/dom/index.ts`, con un módulo por grupo al lado. Sin dependencias; solo APIs del navegador.
- Código pesado que casi nadie usa (los shaders del Carousel): módulo aparte cargado con `import()`
  (`zui/src/dom/carousel-gl.ts`). Necesita su entrada en `exports` y `publishConfig.exports`, su bundle en
  `tools/dist.mjs` (lista `targets` y mapa `LAZY`) y una caída sin él.
- Los mismos atributos de estado que el binding de React.
- Lo que cambia solo con un clic se activa dentro de `[data-z-dom]`, para no chocar con React en la
  misma página.
- Reglas de estilo que neutralizan el navegador: `zui/src/styles/native.css`.

## Verificación

| Comando | Comprueba |
|---|---|
| `pnpm html` | El contrato se regenera sin errores |
| `pnpm dist` | CSS y módulos empaquetados; `examples/html` regenerado |
| `pnpm test:html` | `examples/html` en Chrome, sin React: overlays, teclado, tema, marca, móvil |
| `pnpm check` | Incluye `html` y `dist` |

Un componente con `behavior: "dom"` no está terminado hasta que tiene un caso en `tests/html/run.mjs`.
