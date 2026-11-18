# Estado de partida y problemática

Notas del 2026-11-12, antes de construir nada. Qué tenía y qué problema quería resolver.

## Qué había

La carpeta de zuix tenía una definición de cuatro nombres (Zuix, Zout, Zui, Zicon), una nota con la
intención de zudocs, una lista de enlaces de referencia, el manual de marca de DAZLABS y las carpetas de los
paquetes vacías. No era todavía un repositorio de git.

## Qué quería

Un estándar de UI que:

1. fuera completo: componentes (`zui`), layouts y ventanas dinámicas (`zout`), iconografía (`zicon`) y
   documentación (`zudocs`);
2. permitiera a otra marca replicarlo cambiando solo los estilos;
3. fuera fácil de operar por agentes de IA, no solo por personas.

## Los problemas que encontré en mis propios proyectos

### 1. El estilo existía en varias copias que ya divergían

El lenguaje liquid glass nació en una aplicación mía anterior, lo copié a zutool (escritorio y móvil) y de
ahí a `ui-glass`, un paquete de analizador-trafico. Las copias ya no eran iguales
([Fuentes de estilo](./02-fuentes-de-estilo.md)).

### 2. Los tokens mezclaban sistema y aplicación

Las hojas de tokens de zutool llevaban tipos de nodo, cromo de ventana y tarjetas KPI junto a los tokens
generales. El design system del proyecto de origen mantenía los mismos valores dos veces, en un módulo de
TypeScript y en `:root`.

### 3. La marca y los productos no coincidían

| Fuente | Acento | Tipografía |
|---|---|---|
| Manual de DAZLABS | `#E74327`, `#B6ACD5`, `#0B0C0D` | Poppins, DM Sans |
| zutool | `#ff6118` | Plus Jakarta Sans, Inter, JetBrains Mono |
| Design system del proyecto de origen | Azul, arena y verde azulado | Plus Jakarta Sans, Inter |

No lo vi como un defecto: confirma que el estándar tiene que separar la estructura de la marca.

### 4. Mi documentación seguía un estándar de facto, con deriva

| Proyecto | Carpetas | Idioma | Publicación |
|---|---|---|---|
| Barrits | `users`, `development`, `investigations`, `package`, `agents` | EN y ES por carpeta, prefijos numéricos | Ninguna; tiene `llms.txt` y `context7.json` |
| zutool | `investigation`, `development` | ES | Ninguna |
| Una herramienta de línea de comandos mía | `agentes`, `desarrollo`, `investigacion` | ES | Ninguna |

La taxonomía se repetía, pero cambiaban los nombres, el manejo de idiomas y la herramienta.

### 5. No tenía componentes reutilizables

Cada proyecto tenía sus primitivos: los de zutool (`apps/desktop/src/ui/primitives`), los cuatro componentes
de `ui-glass` y los del design system del proyecto de origen. Ninguno se compartía.

## Consecuencia

zudocs no podía "basarse en el sistema de componentes de zuix" porque ese sistema no existía. El orden de
construcción tenía que empezar por los tokens y seguir por `zicon`, `zui` y `zout`, con zudocs como primer
consumidor ([Arquitectura y decisiones](./06-arquitectura-y-decisiones.md)).
