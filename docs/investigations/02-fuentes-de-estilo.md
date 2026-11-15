# 02 · Fuentes de estilo

Fecha: 2026-11-12.

Tres fuentes alimentan el estándar: el material liquid glass de zutool, el design system empaquetado del
proyecto de origen y el manual de marca DAZLABS.

## A. Liquid glass (zutool)

### Origen y copias

| Copia | Ruta | Diferencias |
|---|---|---|
| Origen | Una aplicación propia anterior a zutool | referencia de estilo |
| zutool escritorio | `apps/desktop/src/styles/tokens.css` en zutool (231 líneas) | añade cromo de ventana, tema claro, sidebar de 224 px |
| zutool móvil | `apps/mobile/src/styles/tokens.css` en zutool | idéntica a la de escritorio |
| ui-glass | `packages/ui-glass/src/tokens.css` en analizador-trafico | sidebar de 264 px, tokens de gráficos propios, sin tema claro |

Referencia escrita: `docs/investigation/ui/liquid-glass-reference.md` en zutool.

### El material

Clase `.liquid`:

- fondo `--glass-bg: rgba(44, 38, 40, 0.66)`;
- borde `rgba(255, 255, 255, 0.10)`;
- `backdrop-filter: blur(36px) saturate(160%)`;
- brillo superior `inset 0 1px 0 rgba(255, 255, 255, 0.14)`;
- destello especular radial en `::before`;
- sombra `0 30px 80px -30px rgba(0, 0, 0, 0.75)`;
- radio de panel de 24 px.

Detrás va un fondo cálido difuminado (`--canvas-gradient`) sobre `#2a2422`.

### Estructura de tokens

Tres niveles: primitivos (`--orange-500`), semánticos (`--accent`, `--surface`, `--fg`, `--line`) y de
componente (`--card-bg`, `--rail-active-bg`). El puente a Tailwind v4 se hace con `@theme inline` en
`app.css`, que expone cada token como utilidad.

### Reglas que se heredan

1. Nunca `backdrop-filter` sobre texto denso. En zutool el cuerpo del terminal es opaco y solo el marco es cristal.
2. Movimiento de 120 a 200 ms; pulso solo para estados.
3. El tema claro redefine los tokens semánticos y conserva el acento.

### Qué no se hereda

Los tokens de aplicación: `--node-*`, `--edge-*`, `--chrome-*`, `--kpi-*`, `--pane-*`.

## B. Design system base: un design system en paquete

Es el paquete de interfaz del proyecto de origen (un proyecto privado; no se cita su nombre ni su ruta). Es el que ya
funciona como paquete modificable y operable por agentes, y sirve de base para el modelo de `zui`.

### Qué tiene

| Pieza | Detalle |
|---|---|
| Paquete | `packages/ui` (en zuix no conserva el nombre del proyecto de origen), consumido por las cuatro aplicaciones del proyecto de origen |
| Tokens | `src/tokens.ts`: color, tipografía, espaciado, radios, sombras, transiciones, breakpoints, z-index, efectos |
| Estilos | 8.331 líneas de CSS: núcleo en `styles/index.css` y paneles en `styles/app/*.css` |
| Componentes | 47 archivos en `src/components`, más carpetas `chat`, `extras` y `fields` |
| Iconos | 89 iconos en `src/components/icons.tsx`, con `currentColor` |
| Guía para agentes | `SOFT-UI-GUIDE.md`: reglas, patrones copiables, tabla emoji → icono y verificación |
| Auditoría | `tools/e2e/audit-styles.mjs`: mide por archivo estilos en línea, clases compartidas, colores literales y emojis |
| Skill | `.claude/skills/design-system`: genera y valida tokens desde JSON (`generate-tokens.cjs`, `validate-tokens.cjs`) |

### Por qué funciona con agentes

- **Reglas cortas y comprobables.** "Sin colores literales", "sin emojis como iconos", "estilos en línea
  solo para maquetación". Un agente puede cumplirlas sin interpretar.
- **Patrones para copiar.** Cada patrón de la guía es un bloque JSX completo con sus clases.
- **Verificación mecánica.** La guía termina con dos comandos y un objetivo numérico por archivo
  ("emoji 0, hex 0"). El agente sabe cuándo terminó.
- **Tabla de sustitución.** Convierte una decisión de diseño (qué icono usar) en una búsqueda.

### Qué no se copia

- **Tokens duplicados.** `tokens.ts` y `:root` de `index.css` repiten los mismos valores a mano.
- **Dominio mezclado.** `StripeCheckout`, `SOSButton`, `GaussianSplatViewer`, `ListingCard` y similares
  conviven con `Button` e `Input`. En `zui` solo entra lo genérico.
- **Estilos en línea desde tokens.** `Button.tsx` aplica `fontFamily` por `style`, lo que impide cambiar
  de marca solo con CSS.
- **Sin tema oscuro.** No hay `data-theme` ni `prefers-color-scheme` en los estilos.
- **Dependencias pesadas.** `three` es dependencia directa del paquete de UI.
- **React 18.** La suite parte de React 19.

### Lo que se adopta en zuix

1. Guía para agentes por paquete, con el formato reglas → patrones → verificación.
2. Auditoría como comando de la suite, con salida por archivo.
3. Generación y validación de tokens desde un único JSON.
4. Tabla de sustitución de iconos, generada desde el manifiesto de `zicon`.

## C. Manual de marca DAZLABS

Archivo: `docs/Manual de Marca - DAZLABS.pptx`, 49 diapositivas.

### Lo que está completo

- Identidad empresarial y personal (diapositivas 5 a 21).
- Voz: visionaria, experta, educativa, accesible, con buenas y malas prácticas (23 a 26).
- "Esto pero no esto": innovador pero no impulsivo; confidente pero no arrogante; educativo pero no
  condescendiente; apasionado pero no fanático; visionario pero no imprudente; accesible pero no básico.

### Lo que está sin rellenar

La sección de identidad visual (34 a 49) conserva la plantilla original: dice "MODERN STUDIO",
"LT.XYZ" y "2028 V1.03", con Lorem ipsum. No hay reglas de logo, tipografía ni fotografía.

### Lo aprovechable

| Elemento | Valor |
|---|---|
| Paleta | `#B6ACD5` (lavanda), `#E74327` (rojo anaranjado), `#0B0C0D` (casi negro) |
| Tipografía del documento | Poppins y DM Sans |
| Logo | PNG blanco sobre transparente, 714 × 145 |
| Principios | disciplina, ejecución, enfoque |

La voz del manual es la base de la guía de redacción de zudocs.
