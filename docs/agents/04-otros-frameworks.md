# Usar o extender zuix fuera de React

Cómo se escribe marcado del contrato y cómo se añade comportamiento sin framework. La guía de uso para
personas está en [Frameworks](../users/06-frameworks.md).

## Reglas

1. **El contrato es HTML + CSS + tokens.** La apariencia de un componente vive en su hoja de estilos,
   por clases `z-*` y atributos (`data-state`, `data-size`, `aria-*`). Nunca en lógica de un framework.
2. **El marcado se copia del contrato.** Fuente: `zui/html.json` y `zout/html.json`. No se inventan
   clases ni estructura.
3. **Iconos con `<z-icon name="…">`**, `iconElement()` en código que construye el DOM, o `iconSvg()` cuando
   hace falta una cadena. Sin SVG a mano ni emojis.
4. **Comportamiento con `@zuccadev-labs/zuix-zui/dom` y, en layouts, `@zuccadev-labs/zuix-zout/dom`.** No se reimplementa un diálogo, un
   menú, un cajón del `Shell` ni un divisor en la aplicación.
5. **Un componente nuevo se diseña primero como marcado.** Si su aspecto solo funciona con React, está
   mal hecho. El binding de React se escribe después y debe producir ese marcado.
6. **`behavior` dice la verdad.** `none`, `dom` o `react` en el manifiesto, según lo que hoy funciona.
7. **Una sola lógica.** Un cálculo que necesitan React y el modo DOM vive en `zui/src/core/` y lo consumen los
   dos. No se escribe dos veces.
8. **El texto de la aplicación entra por `textContent` o `setAttribute`.** Nunca concatenado en marcado. El
   marcado propio del módulo pasa por `setMarkup` (`zui/src/dom/shared.ts`), el único punto que escribe HTML.
9. **Un atributo que nombra otro elemento se resuelve con `byRef`**, no con `querySelector` sobre el valor.
10. **Plataforma primero.** `<dialog>` con `showModal()` para lo modal, `popover="manual"` para lo flotante.
    Sin `z-index` ni portales.

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

- Entradas: `zui/src/dom/core.ts` (núcleo, `init`, `use` y el registro de piezas), una por familia en
  `zui/src/dom/families/` (`@zuccadev-labs/zuix-zui/dom/<familia>`) y `zui/src/dom/index.ts`, que lo reexporta todo
  y registra todas las familias en `init()` y `hydrate()`. Un módulo por grupo al lado. Sin dependencias; solo APIs
  del navegador y la lógica de `zui/src/core/`.
- Un módulo nuevo es una pieza (`DomPart`: `rank`, `setup`, `hydrate`, `teardown`) del núcleo (`coreModule` en
  `core.ts`) o de una familia. `rank` fija el orden de listeners y de preparación. Ningún archivo hace nada al
  importarse salvo registrar sus iconos (`registerIcons`) o sus piezas de árbol: `sideEffects` de `zui` ya no
  incluye `src/dom` ni `dist/esm/dom`, y una llamada de nivel superior sin `/* @__PURE__ */` arrastraría su
  módulo a quien solo toma `toast()` (lo comprueba `pnpm test:pack`). Una familia nueva va en los dos mapas de
  `exports`, en `suite/` y en `everything()` de `index.ts`.
- Los listeners del documento se registran con la señal de `init()`, para que `destroy()` los retire.
- Código pesado que casi nadie usa (los shaders del Carousel): módulo aparte cargado con `import()`
  (`zui/src/dom/carousel-gl.ts`). Necesita su entrada en `exports` y `publishConfig.exports`, su bundle en
  `tools/dist.mjs` (lista `targets` y mapa `LAZY`) y una caída sin él.
- Los mismos atributos de estado que el binding de React, y el mismo teclado, también en `dir="rtl"`
  (`core/dir`).
- Compatible con `require-trusted-types-for 'script'` y con `style-src 'self'`: las medidas se escriben por
  la API de estilos, no con atributos `style` en cadenas.
- Lo que cambia solo con un clic se activa dentro de `[data-z-dom]`, para no chocar con React en la
  misma página.
- Reglas de estilo que neutralizan el navegador: `zui/src/styles/native.css`.

## Verificación

| Comando | Comprueba |
|---|---|
| `pnpm html` | El contrato se regenera sin errores |
| `pnpm dist` | CSS y módulos empaquetados; `examples/html` regenerado |
| `pnpm test:unit` | La lógica de `core/` y de los módulos DOM cubiertos |
| `pnpm test:html` | `examples/html` en Chrome, sin React: capas, teclado, tema, marca, móvil, RTL, CSP y Trusted Types |
| `pnpm check` | Incluye `html` y `dist` |

Un componente con `behavior: "dom"` no está terminado hasta que tiene un caso en `tests/html/cases/`.
