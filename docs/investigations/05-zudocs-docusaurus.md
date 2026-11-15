# 05 · Zudocs: Docusaurus y estándar documental

Fecha: 2026-11-12.

## Intención

De `zudocs/description.md`: una plantilla estándar de documentación con Docusaurus y la marca, basada
en los componentes de Zuix, con herramientas para que un agente la adapte a otra marca o sistema de
componentes de forma tan sencilla como en Mintlify.

## Estado de Docusaurus

Versión publicada: 3.10.2. Según las notas de la 3.10, es la última versión menor de v3.

| Tema | Situación | Qué hacer |
|---|---|---|
| Preparación para v4 | `future.v4: true` activa todos los cambios de v4 | Activarlo desde el inicio |
| Compilación | Docusaurus Faster (Rspack, SWC, LightningCSS) es estable: `future.faster: true` | Activarlo |
| MDX estricto | `.md` será CommonMark y `.mdx` será MDX | Escribir en `.mdx` |
| Admonitions | El título pasa a `:::note[Título]` | Usar la sintaxis nueva |
| Comentarios e ids | `{/* comentario */}` y `{/* #id */}` | Usar la sintaxis nueva |
| React | React 18 se retira en v4 | React 19 |
| Almacenamiento | `storage` con `namespace: true` | Activarlo |
| Node | Requiere 20 o superior | El equipo tiene Node 26 |

Las notas recomiendan además una ventana mínima de antigüedad para dependencias nuevas
(`minimumReleaseAge` en pnpm).

## Estilos en Docusaurus

- El tema clásico usa Infima y sus variables `--ifm-*`.
- El modo oscuro se selecciona con `[data-theme='dark']`, igual que en zutool.
- Existen nombres de clase estables `theme-*` (por ejemplo `theme-layout-navbar`,
  `theme-doc-sidebar-container`) pensados para CSS propio.
- El corte entre móvil y escritorio es 996 px.
- Personalizar componentes se hace por "swizzle": envolver (recomendado) o expulsar (copia el
  componente y dificulta las actualizaciones).

### Estrategia prevista

1. Mapear los tokens de zuix a las variables `--ifm-*`.
2. Aplicar el material liquid glass sobre las clases `theme-*`.
3. Envolver componentes solo cuando el CSS no alcance. No expulsar.

### Regla de legibilidad

El cristal va en navbar, sidebar, índice, tarjetas y buscador. La superficie de lectura queda casi
opaca. Viene de la regla de zutool de no aplicar `backdrop-filter` sobre texto denso.

### Sin verificar

- La convivencia de Tailwind v4 con Infima. La documentación oficial de estilos no la cubre.
- El coste de rendimiento de `backdrop-filter` en páginas largas.

Ambas se comprueban con un prototipo antes de fijar el diseño del tema.

## Estándar documental de facto

Ver la tabla del documento 01. Lo que se repite y vale como base:

- Áreas: usuarios, desarrollo, investigaciones, publicación del paquete, agentes.
- Prefijos numéricos para el orden de lectura.
- Decisiones de arquitectura como ADR numerados (Zenith).
- Sección de archivo para lo no vigente (Zenith).
- Contexto para modelos: `llms.txt` y `context7.json` (otro paquete propio).

Lo que falta unificar: nombres de carpeta, manejo de idiomas y herramienta de publicación.

## Modelo tipo Mintlify

Mintlify configura el sitio con un único `docs.json` con esquema. Sus campos obligatorios son `name`,
`theme`, `colors.primary` y `navigation`; admite dividir la configuración con `$ref`.

Para zudocs: un archivo de configuración con esquema JSON que define marca, colores, fuentes, logo y
navegación, y un preset de Docusaurus que lo lee. Un agente cambia de marca editando ese archivo.

## Piezas previstas de zudocs

1. El estándar escrito: taxonomía, tipos de documento, frontmatter, nombres, idiomas, plantilla de ADR
   y guía de voz.
2. Tema y preset de Docusaurus.
3. Plantillas de página.
4. Sitio que documenta zudocs con zudocs.
5. Kit de agente: comandos de inicio, cambio de marca y verificación; `AGENTS.md`; generación de `llms.txt`.

## Piloto

Zenith es el mejor candidato para la primera migración: ya tiene navegación definida en
`site/mkdocs.yml` (repositorio de Zenith).
