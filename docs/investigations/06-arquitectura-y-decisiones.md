# 06 · Arquitectura de la suite y decisiones

Fecha: 2026-11-12. Estado: plan previo a la construcción. Lo construido y las decisiones tomadas están en
[07-estado-de-construccion.md](07-estado-de-construccion.md).

## Principio

La estructura es común y la marca es un archivo. Una marca replica el estándar cambiando tokens, sin
tocar la lógica de los componentes.

## Paquetes

| Paquete | Papel | Fuente principal |
|---|---|---|
| tokens | Fuente única de valores; genera variables CSS, tema Tailwind y mapa para Docusaurus | `tokens.css` de zutool, `tokens.ts` del design system base |
| `zicon` | Iconos, manifiesto y tabla de sustitución | `Dazicon.fig` |
| `zui` | Componentes: capa headless y capa con estilo | Radix, el design system base, primitivos de zutool, referencias de `stack.txt` |
| `zout` | Layouts y ventanas dinámicas | Shell y paneles de zutool |
| `zudocs` | Estándar documental, tema Docusaurus, plantillas | Documento 05 |
| kit de agente | Guías, auditoría, comandos y manifiestos legibles por máquina | Modelo del design system base |

## Capas

```
marca (un archivo de tokens)
        ↓
tokens: primitivos → semánticos → componente
        ↓
zicon      zui (headless + estilo)      zout
        ↓
zudocs y aplicaciones
```

## Qué hace al estándar operable por agentes

Tomado de lo que ya funciona en el design system base (documento 02):

1. **Una guía por paquete** con el formato reglas → patrones copiables → verificación.
2. **Un manifiesto por componente**: props, variantes, tokens que usa y ejemplos.
3. **Auditoría por comando**, con resultado por archivo y objetivo numérico.
4. **Un único archivo de marca**, con esquema, que el agente edita.
5. **Contexto para modelos**: `AGENTS.md` y `llms.txt` generados.

## Orden de construcción

1. Base del repositorio.
2. Tokens.
3. `zicon`: la fuente está lista y la extracción ya se probó.
4. `zui`: primitivos y primeros componentes.
5. `zout`: a partir del shell de zutool.
6. Carousel con efecto lente.
7. `zudocs`: prototipo del tema, estándar escrito, plantillas.
8. Piloto: migrar la documentación de Zenith.

## Decisiones (como se plantearon)

Cómo quedó cada una: documento 07.

| # | Decisión | Recomendación | Alternativa |
|---|---|---|---|
| 1 | Framework | React 19 con Radix: zutool, Docusaurus y Radix son React. **Corregido el 2026-11-13 por el responsable: la suite no es solo para React.** El estándar pasa a ser HTML + CSS + tokens y React queda como un binding (ver documento 07) | ArrowJS en el núcleo |
| 2 | Distribución | npm para tokens, `zicon` y primitivos; registro copiable para componentes con estilo | Todo por npm, o todo por registro |
| 3 | Referencias externas | Reimplementar sobre tokens propios | Copiar código donde la licencia lo permita |
| 4 | Marca por defecto | Material de zutool con paleta DAZLABS; naranja de zutool como segundo tema | Naranja de zutool como tema base |
| 5 | Taxonomía documental | Nombres en inglés plural e idiomas con el i18n de Docusaurus | Carpetas `EN/ES` como en otro paquete propio |
| 6 | Repositorio | `git init` en zuix con workspace de pnpm | Un repositorio por paquete |
| 7 | Reutilización del proyecto de origen | Confirmar permiso antes de extraer el carousel y los patrones | — |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Tailwind v4 e Infima no conviven bien | Prototipo antes de fijar el tema |
| `backdrop-filter` degrada el rendimiento o la legibilidad | Cristal solo en el cromo; superficie de lectura opaca |
| `zui` y los componentes de zudocs se convierten en dos sistemas | zudocs consume `zui`; no define componentes propios |
| Los tokens vuelven a divergir por copia | Un solo paquete de tokens; las aplicaciones lo importan |
| La identidad visual del manual está incompleta | Paleta y tipografía se confirman con el responsable de marca |
| Erratas y duplicados en Dazicon | Tabla de renombrado revisada a mano antes de publicar |
