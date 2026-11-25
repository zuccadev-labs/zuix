# Investigaciones de zuix

Mis notas de investigación y las decisiones que salieron de ellas. Cada documento cuenta qué me planteé, qué
comparé, qué medí, qué decidí y qué descarté. Sirven para entender por qué la suite es como es, y para no
repetir una discusión que ya tuve conmigo mismo.

## Lectura en orden

| # | Documento | Qué responde |
|---|---|---|
| 00 | [Investigación inicial](./00-investigacion-inicial.md) | Cómo se separan tokens, lógica y estilos en un sistema de diseño, y cuánto puede hacer ya el CSS sin JavaScript |
| 01 | [Estado de partida y problemática](./01-estado-y-problematica.md) | Qué había antes de zuix y qué problema resuelve la suite |
| 02 | [Fuentes de estilo](./02-fuentes-de-estilo.md) | De dónde sale el estilo: el liquid glass de zutool, un design system anterior y el manual de marca |
| 03 | [Zicon: extracción de Dazicon](./03-zicon-dazicon.md) | Qué contiene el archivo de Figma de los iconos y cómo se extrae sin Figma |
| 04 | [Componentes de referencia](./04-componentes-de-referencia.md) | El Carousel con efecto lente, las bibliotecas que miré como referencia y el código propio que ya existía |
| 05 | [Zudocs: Docusaurus y estándar documental](./05-zudocs-docusaurus.md) | Por qué Docusaurus, qué estándar documental ya usaba sin haberlo escrito y qué copié de Mintlify |
| 06 | [Arquitectura de la suite y decisiones](./06-arquitectura-y-decisiones.md) | Qué paquetes planeé, en qué orden y cómo acabó cada decisión |
| 07 | [Construcción de la 0.1.0](./07-construccion-de-la-0-1-0.md) | Qué construí, cómo lo verifiqué y qué fallos encontré por el camino |
| 08 | [Primitivas propias](./08-primitivas-propias.md) | Por qué quité la biblioteca de UI que había debajo del binding de React y qué medí al hacerlo |
| 09 | [Accesibilidad medida](./09-accesibilidad-medida.md) | Cómo pasé de afirmar WCAG AA a medirlo: contraste, RTL, colores forzados y táctil |
| 10 | [Node, dependencias y cadena de suministro](./10-node-dependencias-y-cadena-de-suministro.md) | Qué versiones admito, cómo protejo la instalación y cómo publico sin tokens |
| 11 | [Lint, pruebas y por qué no Barrits](./11-lint-pruebas-y-barrits.md) | Por qué Biome y no ESLint, por qué `node:test`, y por qué no uso aquí mi propio Barrits |
| 12 | [El sitio de documentación, medido](./12-el-sitio-medido.md) | Qué encontré al auditar zudocs: seguridad, fuentes, rendimiento, `llms.txt` y despliegue |
| 13 | [Rendimiento de la agenda, medido](./13-rendimiento-de-la-agenda.md) | Dónde iba el tiempo con 5000 eventos, qué cambié y cómo evito que vuelva a subir |
| 14 | [El conector de editores visuales](./14-conector-de-editores.md) | Por qué JSON Schema, por qué `postMessage` con un puerto, y qué dejé para cuando llegue el editor real |

## Cómo leerlas

- Los documentos 00 a 06 son anteriores a la construcción: describen el análisis y el plan. Donde la
  construcción se apartó del plan, lo digo en el propio documento.
- El 07 es el registro de la `0.1.0`. Del 08 al 12, lo que investigué y cambié para la `0.2.0`; el 13, para la siguiente.
- La guía de uso está en [`../users/`](../users/README.md): describe lo que hay, no cómo llegué a ello.

## Convención

- Un documento por tema, con prefijo numérico de dos dígitos.
- Las cifras llevan su fecha y cómo las obtuve.
- Las fuentes externas que sostienen una decisión se citan con su URL.
- Lo que no he comprobado se dice.
- De otros proyectos míos (zutool, `ui-glass`, analizador-trafico, Barrits) cito la ruta dentro de su
  repositorio. Los proyectos privados no se nombran: el design system y el carousel que reutilicé salen de un
  "proyecto de origen" que no identifico.
