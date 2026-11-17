# CSP y Trusted Types

Cómo usar la suite en una página con una política de seguridad de contenido estricta, y qué hace la suite
con los datos que recibe.

## Qué política admite

El modo sin framework se prueba en cada cambio con esta política, sin ninguna violación:

```
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:;
  connect-src 'self'; require-trusted-types-for 'script'; trusted-types zuix-zui
```

| Directiva | Qué necesita la suite |
|---|---|
| `script-src` | Solo el origen que sirve los módulos. No hay `eval`, ni scripts en línea, ni carga desde terceros |
| `style-src` | `'self'` basta para el comportamiento: las posiciones y medidas calculadas se escriben por la API de estilos del DOM, que la política no bloquea |
| `style-src-attr` | `'unsafe-inline'` solo si el HTML que llega del servidor trae atributos `style`. Algunos ejemplos del contrato los usan para fijar una variable (`style="--z-grid-min:200px"`), y React los emite al renderizar en servidor |
| `img-src` | `data:` no hace falta para los iconos: son SVG en línea |
| `trusted-types` | `zuix-zui`, la política que crea `@zuccadev-labs/zuix-zui/dom` |
| `font-src`, `connect-src` | Nada: la suite no carga fuentes ni hace peticiones |

## Trusted Types

Con `require-trusted-types-for 'script'` el navegador rechaza cualquier asignación de una cadena a
`innerHTML` que no pase por una política.

| Pieza | Cómo escribe en el DOM |
|---|---|
| `@zuccadev-labs/zuix-zui/dom` | Su marcado propio (la estructura de un aviso, de un calendario) pasa por un único punto y por la política `zuix-zui`. La política no filtra: solo recibe marcado fijo del paquete |
| `@zuccadev-labs/zuix-zout/dom` | Crea sus elementos y sus iconos con el DOM. No necesita política |
| `<z-icon>`, `iconElement()` | Construyen el SVG con el DOM. No necesitan política |
| `iconSvg()` | Devuelve una cadena. Si tu código la asigna a `innerHTML`, necesita tu propia política |
| Binding de React | React escribe con la API del DOM |

Si la política `zuix-zui` no está permitida en la cabecera `trusted-types`, el navegador bloquea la creación
y `zui/dom` no puede dibujar avisos ni calendarios.

## Qué pasa con los datos de la aplicación

- **El texto es texto.** Títulos, descripciones, etiquetas y nombres de archivo que recibe `zui/dom`
  (`toast({ title })`, `confirm({ description })`, opciones de un Combobox) se escriben con `textContent` o
  `setAttribute`. Un título con marcado HTML se ve tal cual.
- **Los atributos que nombran otro elemento** (`data-z-open="#id"`, `data-z-context`, `data-z-submenu`,
  `data-raster`, `data-z-shell`) se resuelven por id. Un valor que no es un id válido no hace nada: no lanza
  ni se interpreta como selector arbitrario.
- **`iconSvg()` escapa lo que interpola** y reduce `variant` a `outline` o `solid`.
- **React.** Los componentes no insertan HTML a partir de props.

Lo que la suite no puede hacer por la aplicación: si tu plantilla de servidor escribe datos de un usuario
dentro del marcado del contrato sin escaparlos, eso es una inyección en tu plantilla, no en zuix.

## El sitio de documentación

`zudocs build --headers` genera un archivo `_headers` con una política que autoriza por su hash solo los
scripts en línea de la plantilla, y `markdown.untrusted` rechaza el contenido activo en documentos escritos
por terceros ([Zudocs](./05-zudocs.md#documentos-escritos-por-terceros)). La política del sitio lleva
`style-src 'unsafe-inline'`, porque los componentes del catálogo fijan variables con el atributo `style`.

## Lo que no he comprobado

- El binding de React bajo `require-trusted-types-for 'script'`: la prueba con esa política es la del modo
  sin framework.
- Una política con `nonce` en lugar de `'self'`.
- Trusted Types fuera de Chromium y del WebKit y el Firefox que trae Playwright en su versión actual.

Para reportar un problema de seguridad: [`SECURITY.md`](https://github.com/zuccadev-labs/zuix/blob/main/SECURITY.md).
