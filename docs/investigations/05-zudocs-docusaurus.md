# Zudocs: Docusaurus y estándar documental

Notas del 2026-11-12, antes de construir zudocs. Lo que quería era una plantilla de documentación con la
marca, hecha con los componentes de zuix, que un agente pudiera adaptar a otra marca o a otro proyecto con la
misma facilidad con la que se configura un sitio de Mintlify.

## Por qué Docusaurus, y en qué estado estaba

Partí de Docusaurus: es lo que quería usar desde el principio, es React, como el binding de la suite, y su
tema se puede vestir con CSS sin copiar sus componentes. La versión publicada era la 3.10.2; según sus
[notas de versión](https://docusaurus.io/blog/releases/3.10), la 3.10 es la última menor de la rama 3.

| Tema | Situación | Qué hice |
|---|---|---|
| Preparación para la 4 | `future.v4: true` activa todos los cambios de la 4 | Activado desde el principio |
| Compilación | Docusaurus Faster (Rspack, SWC, LightningCSS) es estable: `future.faster: true` | Activado |
| MDX estricto | `.md` será CommonMark y `.mdx` será MDX | Los documentos son `.md`; `.mdx` solo donde hace falta un componente |
| React | React 18 se retira en la 4 | React 19 |
| Node | Requiere 20 o superior | Uso Node 26 |

Las mismas notas recomiendan una antigüedad mínima para dependencias nuevas. Entonces lo apunté; hoy es una
política del repositorio ([Node, dependencias y cadena de suministro](./10-node-dependencias-y-cadena-de-suministro.md)).

## Estilos en Docusaurus

- El tema clásico usa Infima y sus variables `--ifm-*`.
- El modo oscuro se selecciona con `[data-theme='dark']`, igual que en zutool.
- Existen nombres de clase estables `theme-*` pensados para CSS propio.
- Personalizar un componente se hace por "swizzle": envolverlo, que es lo recomendado, o expulsarlo, que
  copia el componente y dificulta las actualizaciones.

### La estrategia

1. Mapear los tokens de zuix a las variables `--ifm-*`. Es la salida `docusaurus.css` del paquete de tokens.
2. Aplicar el material liquid glass sobre las clases `theme-*`.
3. Envolver componentes solo cuando el CSS no alcance. No expulsar ninguno.

La cumplí. Los únicos componentes del tema que envuelvo son `Root`, `MDXComponents` y los dos del buscador,
y los del buscador solo para traducir una etiqueta y añadir una región `main` que le faltaba.

### La regla de legibilidad

El cristal va en navbar, sidebar, índice, tarjetas y buscador. La superficie de lectura queda opaca. Viene
de la regla de zutool de no aplicar `backdrop-filter` sobre texto denso.

### Dos dudas que tenía

| Duda | Cómo acabó |
|---|---|
| Si Tailwind 4 convive con Infima | No hizo falta saberlo: `zui` es CSS plano sobre tokens y el sitio no usa Tailwind |
| El coste de `backdrop-filter` en páginas largas | Lo medí con Lighthouse al auditar el sitio ([El sitio, medido](./12-el-sitio-medido.md)). En hardware real sigue sin medir |

## El estándar documental que ya usaba

Al repasar mis proyectos vi que repetía la misma taxonomía sin haberla escrito
([Estado de partida](./01-estado-y-problematica.md)). Lo que se repetía y vale como base:

- Áreas: usuarios, desarrollo, investigaciones, publicación del paquete y agentes.
- Prefijos numéricos para el orden de lectura.
- Decisiones de arquitectura como documentos numerados.
- Una sección de archivo para lo no vigente.
- Contexto para modelos: `llms.txt` y `context7.json`, como en Barrits.

Lo que faltaba unificar: nombres de carpeta, manejo de idiomas y herramienta de publicación. Fijé nombres en
inglés y en plural (`users`, `agents`, `development`, `package`, `investigations`). El idioma lo dejé en uno
por sitio: no he montado el i18n de Docusaurus.

## El modelo de Mintlify

Mintlify configura un sitio con un único `docs.json` con esquema, y admite dividirlo con referencias.

Para zudocs copié la idea, no el formato: un `zudocs.config.json` con esquema JSON que define marca, logo,
áreas y navegación, y una configuración de Docusaurus que lo lee. Un agente cambia de marca editando ese
archivo, y el esquema le dice qué campos valen.

## Qué piezas preví y cuáles existen

| Pieza | Estado |
|---|---|
| El estándar escrito: áreas, tipos de documento, nombres, voz | [Zudocs](../users/05-zudocs.md) y [Documentar con zudocs](../agents/03-documentacion.md) |
| Tema de Docusaurus | Hecho, como CSS sobre el tema clásico |
| Plantillas de página | Ocho tipos, en `zudocs/templates/` |
| Un sitio que documenta zudocs con zudocs | Es este |
| Kit de agente: comandos de alta, cambio de marca y verificación; generación de `llms.txt` | Hecho: `new`, `verify`, `llms` |
| Usar la plantilla en otro proyecto sin copiarla | Hecho, con `--config`. No estaba en el plan inicial |

## El piloto

Probé la plantilla con la documentación de Zenith, un proyecto privado. El piloto vive solo en mi máquina y
no se versiona aquí. Para él creé la marca `zenith` de los tokens, y la plantilla lo compila con `--config`,
sin copiarse.
