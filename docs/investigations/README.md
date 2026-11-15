# Investigaciones de Zuix

Registro de lo que se analizó antes de construir la suite y de las decisiones que salen de ahí.
Última actualización: 2026-11-13.

Las rutas de otros proyectos se escriben relativas a la raíz de cada proyecto. Los proyectos privados o de
terceros se citan con una descripción neutra ("proyecto de origen", "design system base"), sin nombre ni ruta.

## Lectura en orden

| # | Documento | Qué responde |
|---|---|---|
| 00 | [00-investigacion-inicial.md](00-investigacion-inicial.md) | Arquitectura de un sistema de diseño corporativo: tokens, headless, Tailwind con variables CSS, CSS nativo moderno |
| 01 | [01-estado-y-problematica.md](01-estado-y-problematica.md) | Qué existe hoy en zuix y qué problema resuelve la suite |
| 02 | [02-fuentes-de-estilo.md](02-fuentes-de-estilo.md) | De dónde sale el estilo: liquid glass de zutool, el design system base y el manual de marca |
| 03 | [03-zicon-dazicon.md](03-zicon-dazicon.md) | Qué contiene `Dazicon.fig` y cómo se extrae sin Figma |
| 04 | [04-componentes-de-referencia.md](04-componentes-de-referencia.md) | Carousel con efecto lente, bibliotecas de `stack.txt` y kits de Figma |
| 05 | [05-zudocs-docusaurus.md](05-zudocs-docusaurus.md) | Estado de Docusaurus, estándar documental de facto y modelo tipo Mintlify |
| 06 | [06-arquitectura-y-decisiones.md](06-arquitectura-y-decisiones.md) | Paquetes de la suite, orden de construcción y decisiones |
| 07 | [07-estado-de-construccion.md](07-estado-de-construccion.md) | Qué se construyó, cómo se verificó y qué falta |

## Estado

- Los paquetes existen y pasan su verificación (documento 07). Desde el 2026-11-14 están publicados en
  npmjs.com en `0.1.0`; el procedimiento está en `docs/package/02-publicacion.md`.
- Los documentos 01 a 06 se escribieron antes de construir: describen el análisis y el plan. Donde la
  construcción se apartó del plan, manda el documento 07.
- Los documentos de usuario en [`../users/`](../users/README.md) describen lo construido.

## Convención

- Un documento por tema, con prefijo numérico de dos dígitos.
- Cada afirmación sobre otro proyecto dice de qué proyecto sale y, si el proyecto es propio, la ruta dentro de él.
- Lo que no se verificó se dice explícitamente.
