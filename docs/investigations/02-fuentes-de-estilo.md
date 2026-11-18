# Fuentes de estilo

Notas del 2026-11-12. Tres fuentes alimentan el estándar: el material liquid glass de zutool, el design
system empaquetado de un proyecto anterior y el manual de marca de DAZLABS. De cada una apunté qué heredo y
qué no.

## A. Liquid glass (zutool)

### Origen y copias

| Copia | Ruta | Diferencias |
|---|---|---|
| Origen | Una aplicación mía anterior a zutool | Referencia de estilo |
| zutool escritorio | `apps/desktop/src/styles/tokens.css` en zutool | Añade cromo de ventana, tema claro, sidebar de 224 px |
| zutool móvil | `apps/mobile/src/styles/tokens.css` en zutool | Igual que la de escritorio |
| `ui-glass` | `packages/ui-glass/src/tokens.css` en analizador-trafico | Sidebar de 264 px, tokens de gráficos propios, sin tema claro |

### El material

La clase `.liquid` de zutool:

- fondo `--glass-bg: rgba(44, 38, 40, 0.66)`;
- borde `rgba(255, 255, 255, 0.10)`;
- `backdrop-filter: blur(36px) saturate(160%)`;
- brillo superior `inset 0 1px 0 rgba(255, 255, 255, 0.14)`;
- destello especular radial en `::before`;
- sombra `0 30px 80px -30px rgba(0, 0, 0, 0.75)`;
- radio de panel de 24 px.

Detrás va un fondo cálido difuminado (`--canvas-gradient`) sobre `#2a2422`.

Ese 0.66 de opacidad no sobrevivió a la medición de contraste: sobre las manchas claras del degradado, el
texto encima del cristal no llegaba al mínimo. En zuix el cristal de la marca `zutool` está a 0.82
([Accesibilidad medida](./09-accesibilidad-medida.md)).

### Estructura de tokens

Tres niveles: primitivos (`--orange-500`), semánticos (`--accent`, `--surface`, `--fg`, `--line`) y de
componente (`--card-bg`, `--rail-active-bg`). El puente a Tailwind 4 se hacía con `@theme inline`, que expone
cada token como utilidad. Me quedé con los tres niveles y con el puente como salida opcional.

### Reglas que heredo

1. Nunca `backdrop-filter` sobre texto denso. En zutool el cuerpo del terminal es opaco y solo el marco es
   cristal.
2. Movimiento de 120 a 200 ms; pulso solo para estados.
3. El tema claro redefine los tokens semánticos y conserva el acento.

### Qué no heredo

Los tokens de aplicación: `--node-*`, `--edge-*`, `--chrome-*`, `--kpi-*`, `--pane-*`.

## B. Un design system en paquete

Es el paquete de interfaz de un proyecto privado en el que trabajé y cuyo código puedo reutilizar. Al ser
privado no cito su nombre ni sus rutas; lo llamo "proyecto de origen". Me interesó porque ya funcionaba como
paquete modificable y operable por agentes, y lo tomé como modelo para `zui`.

### Qué tenía

| Pieza | Detalle |
|---|---|
| Paquete | Un paquete de interfaz consumido por las cuatro aplicaciones del proyecto |
| Tokens | Un módulo con color, tipografía, espaciado, radios, sombras, transiciones, puntos de corte y capas |
| Estilos | Unas 8.300 líneas de CSS |
| Componentes | 47 archivos de componente, más carpetas de chat, extras y campos |
| Iconos | 89 iconos con `currentColor` |
| Guía para agentes | Reglas, patrones copiables, tabla de emoji a icono y verificación |
| Auditoría | Un script que mide por archivo estilos en línea, colores literales y emojis |

### Por qué funcionaba con agentes

- **Reglas cortas y comprobables.** "Sin colores literales", "sin emojis como iconos", "estilos en línea
  solo para maquetación". Un agente puede cumplirlas sin interpretar.
- **Patrones para copiar.** Cada patrón de la guía era un bloque completo con sus clases.
- **Verificación mecánica.** La guía terminaba con dos comandos y un objetivo numérico por archivo. El agente
  sabe cuándo ha terminado.
- **Tabla de sustitución.** Convierte una decisión de diseño (qué icono usar) en una búsqueda.

### Qué no copié

- **Tokens duplicados**, mantenidos a mano en dos sitios.
- **Dominio mezclado**: componentes de pagos, reservas o mapas junto a `Button` e `Input`. En `zui` solo
  entra lo genérico.
- **Estilos en línea desde tokens**: aplicar la fuente por `style` impide cambiar de marca solo con CSS.
- **Sin tema oscuro.**
- **Dependencias pesadas** dentro del paquete de interfaz.
- **React 18.** La suite parte de React 19.

### Lo que adopté

1. Una guía para agentes por paquete, con el formato reglas → patrones → verificación.
2. Auditoría como comando de la suite, con salida por archivo y objetivo cero.
3. Generación y validación de tokens desde un único origen.
4. Tabla de sustitución de iconos, generada desde el manifiesto de `zicon`.

## C. Manual de marca de DAZLABS

Un documento de 49 diapositivas, que no está en el repositorio.

### Lo que está completo

- Identidad empresarial y personal.
- Voz: visionaria, experta, educativa y accesible, con buenas y malas prácticas.
- Los contrastes que la acotan: innovador pero no impulsivo; confidente pero no arrogante; educativo pero no
  condescendiente; accesible pero no básico.

### Lo que falta

La sección de identidad visual conserva la plantilla original, con texto de relleno. No hay reglas de logo,
de tipografía ni de fotografía.

### Lo aprovechable

| Elemento | Valor |
|---|---|
| Paleta | `#B6ACD5` (lavanda), `#E74327` (rojo anaranjado), `#0B0C0D` (casi negro) |
| Tipografía del documento | Poppins y DM Sans |
| Principios | Disciplina, ejecución, enfoque |

De ahí sale la marca `dazlabs` de los tokens. Como la identidad visual está incompleta, la paleta y las
fuentes de esa marca son las del propio documento; cuando el manual tenga reglas definitivas, se cambia un
archivo.
