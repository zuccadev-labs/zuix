# Arquitectura de la suite y decisiones

El plan que escribí el 2026-11-12, antes de construir, y cómo acabó cada decisión. Lo mantengo porque el
contraste entre lo que planeé y lo que hice explica varias cosas de la suite.

## Principio

La estructura es común y la marca es un archivo. Una marca replica el estándar cambiando tokens, sin
tocar la lógica de los componentes.

## Paquetes que planeé

| Paquete | Papel | Fuente principal |
|---|---|---|
| tokens | Fuente única de valores; genera variables CSS, tema de Tailwind y mapa para Docusaurus | Las hojas de tokens de zutool y el design system del proyecto de origen |
| `zicon` | Iconos, manifiesto y tabla de sustitución | `Dazicon.fig` |
| `zui` | Componentes: una capa de lógica y una de estilo | Una biblioteca headless, el design system del proyecto de origen y los primitivos de zutool |
| `zout` | Layouts y ventanas dinámicas | El shell y los paneles de zutool |
| `zudocs` | Estándar documental, tema de Docusaurus, plantillas | [Zudocs](./05-zudocs-docusaurus.md) |
| Kit de agente | Guías, auditoría, comandos y manifiestos legibles por máquina | El modelo del design system del proyecto de origen |

Después añadí un sexto paquete publicable que no estaba en el plan: el paraguas `@zuccadev-labs/zuix`, para
instalar la suite con una sola dependencia.

## Capas

```
marca (un archivo de tokens)
        ↓
tokens: primitivos → semánticos → componente
        ↓
zicon      zui      zout
        ↓
zudocs y aplicaciones
```

## Qué hace al estándar operable por agentes

Lo tomé de lo que ya funcionaba en el design system del proyecto de origen
([Fuentes de estilo](./02-fuentes-de-estilo.md)):

1. **Una guía por paquete** con el formato reglas → patrones copiables → verificación.
2. **Un manifiesto por componente**: props, variantes, tokens que usa y ejemplos.
3. **Auditoría por comando**, con resultado por archivo y objetivo numérico.
4. **Un único archivo de marca**, con esquema, que el agente edita.
5. **Contexto para modelos**: `AGENTS.md` y `llms.txt` generado.

## Orden de construcción

1. Base del repositorio.
2. Tokens.
3. `zicon`: la fuente estaba lista y la extracción ya la había probado.
4. `zui`: primitivos y primeros componentes.
5. `zout`: a partir del shell de zutool.
6. Carousel con efecto lente.
7. `zudocs`: prototipo del tema, estándar escrito, plantillas.
8. Piloto con la documentación de otro proyecto.

## Decisiones

| # | Decisión | Lo que planeé | Lo que hice |
|---|---|---|---|
| 1 | Framework | React 19 con una biblioteca headless (Radix): zutool y Docusaurus son React | **Ninguno obligatorio.** Al día siguiente lo corregí: la suite no es solo para React. El estándar es HTML + CSS + tokens, `zui/dom` da el comportamiento sin framework y React es un binding. En la `0.2.0` quité además la biblioteca headless ([Primitivas propias](./08-primitivas-propias.md)) |
| 2 | Distribución | npm para tokens, `zicon` y primitivos; un registro copiable para los componentes con estilo | Todo por npm. Paquetes de workspace que exportan su fuente dentro del workspace y `dist/` compilado al empaquetar. No monté un registro copiable |
| 3 | Referencias externas | Reimplementar sobre tokens propios | Así fue: no copié código de las bibliotecas de referencia ([Componentes de referencia](./04-componentes-de-referencia.md)) |
| 4 | Marca por defecto | El material de zutool con la paleta de DAZLABS; el naranja de zutool como segunda marca | Así fue: `dazlabs` por defecto y `zutool` como segunda. Después añadí `zenith` |
| 5 | Taxonomía documental | Nombres en inglés y en plural; idiomas con el i18n de Docusaurus | Nombres en inglés y en plural. Sin i18n: un idioma por sitio |
| 6 | Repositorio | Un repositorio con workspace de pnpm | Workspace de pnpm, público en `github.com/zuccadev-labs/zuix` desde el 2026-11-14 ([Apertura](../package/04-apertura-del-repositorio.md)) |
| 7 | Reutilizar el código del proyecto de origen | Confirmar antes que podía hacerlo | Confirmado. El código extraído no conserva su nombre ni su dominio |

## Dónde me aparté del plan

| Plan | Lo que hice | Motivo |
|---|---|---|
| Tailwind 4 en el tema de Docusaurus | Sin Tailwind | `zui` es CSS plano sobre tokens. Desaparece el riesgo de convivencia con Infima |
| Una herramienta de tokens de terceros | Un script propio de Node sin dependencias | El contrato es pequeño y la validación de contraste es propia |
| 348 iconos | 346 | Dos dibujos estaban rotos en ambas variantes y los sustituí por su versión corregida |
| El token `accent` para los botones | Un token aparte, `accent-solid` | El acento de las marcas no da contraste 4.5:1 con texto blanco en tema oscuro |
| `zicon` con una sola entrada | Además `zicon/core` y un registro de iconos | El set completo pesa unos 580 kB; las bibliotecas no deben arrastrarlo |
| Una biblioteca headless debajo de React | Primitivas propias sobre la plataforma | Una sola lógica para React y para el modo sin framework, y ninguna dependencia |

## Riesgos que apunté, y qué pasó

| Riesgo | Qué pasó |
|---|---|
| Tailwind 4 e Infima no conviven bien | No llegó a plantearse |
| `backdrop-filter` degrada el rendimiento o la legibilidad | La legibilidad sí: el texto sobre cristal no llegaba al contraste mínimo y subí la opacidad. El rendimiento en hardware real sigue sin medir |
| `zui` y los componentes de zudocs se convierten en dos sistemas | No: zudocs consume `zui` y no define componentes propios |
| Los tokens vuelven a divergir por copia | Un solo paquete de tokens, con capas de compatibilidad para migrar las copias antiguas |
| La identidad visual del manual de marca está incompleta | Sigue incompleta. La marca `dazlabs` usa la paleta y las fuentes del propio documento |
| Erratas y duplicados en el archivo de iconos | Resueltos con una tabla de renombrado revisada a mano |
