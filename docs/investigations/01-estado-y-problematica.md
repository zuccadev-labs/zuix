# 01 · Estado actual y problemática

Fecha: 2026-11-12.

## Qué hay en zuix

| Ruta | Contenido |
|---|---|
| `AGENTS.md` | Definición de la suite: Zuix, Zout, Zui, Zicon |
| `stack.txt` | Seis enlaces de referencia (ver documento 04) |
| `zudocs/description.md` | Intención de zudocs: plantilla Docusaurus con la marca, adaptable por un agente a otra marca, al estilo Mintlify |
| `docs/investigations/` | Estas investigaciones |
| `docs/Manual de Marca - DAZLABS.pptx` | Manual de marca (ver documento 02) |
| `zui/`, `zout/`, `zicon/`, `repo-integrations/`, `docs/agents/`, `docs/users/` | Vacías al inicio del análisis |

Zuix no es un repositorio git.

## Objetivo de la suite

Un estándar de UI/UX que:

1. sea completo: componentes (`zui`), layouts y ventanas dinámicas (`zout`), iconografía (`zicon`) y
   documentación (`zudocs`);
2. permita a otra marca replicarlo cambiando solo los estilos;
3. sea fácil de operar por agentes de IA, no solo por personas.

## Problemas encontrados

### 1. El estilo existe en varias copias que divergen

El lenguaje liquid glass nació en una aplicación propia anterior, se copió a zutool (escritorio y móvil) y a
`ui-glass` (paquete de analizador-trafico). Las copias ya difieren entre sí. Detalle en el documento 02.

### 2. Los tokens mezclan sistema y aplicación

Los `tokens.css` de zutool incluyen tipos de nodo, cromo de ventana y tarjetas KPI junto a los tokens
generales. El design system base mantiene los mismos valores dos veces, en `tokens.ts` y en `:root` de `index.css`.

### 3. La marca y los productos no coinciden

| Fuente | Acento | Tipografía |
|---|---|---|
| Manual DAZLABS | `#E74327`, `#B6ACD5`, `#0B0C0D` | Poppins, DM Sans |
| zutool | `#ff6118` | Plus Jakarta Sans, Inter, JetBrains Mono |
| Design system base | `#0066CC`, `#D4A574`, `#008489` | Plus Jakarta Sans, Inter |

Esto no es un defecto: confirma que el estándar debe separar la estructura de la marca.

### 4. La documentación sigue un estándar de facto con deriva

| Proyecto | Carpetas | Idioma | Publicación |
|---|---|---|---|
| Otro paquete propio | `users`, `development`, `investigations`, `package`, `agents` | EN/ES por carpeta, prefijos numéricos | ninguna; tiene `llms.txt` y `context7.json` |
| Zenith | arquitectura, ADR, runbooks, seguridad, API generada | ES | MkDocs Material (`site/mkdocs.yml`) |
| zutool | `investigation`, `development` | ES | ninguna |
| Una CLI propia de documentación | `agentes`, `desarrollo`, `investigacion` | ES | ninguna |

La taxonomía se repite, pero cambian los nombres, el manejo de idiomas y la herramienta.

### 5. No hay componentes propios reutilizables

Cada proyecto tiene sus primitivos: `apps/zutool/apps/desktop/src/ui/primitives` (738 líneas),
`@trafico/ui-glass` (cuatro componentes) y el design system base (47 archivos de componente). Ninguno se comparte.

## Consecuencia

zudocs no puede "basarse en el sistema de componentes de Zuix" porque ese sistema no existe aún.
El orden de construcción tiene que empezar por los tokens y seguir por `zicon`, `zui` y `zout`;
zudocs es el primer consumidor. Ver documento 06.
