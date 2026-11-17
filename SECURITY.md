# Política de seguridad

## Versiones con soporte

Los paquetes están en `0.x`. Las correcciones de seguridad se aplican a la última versión publicada.

| Versión | Soporte |
|---|---|
| Última `0.x` publicada | Sí |
| Anteriores | No |

## Cómo reportar una vulnerabilidad

No abras un issue público ni un pull request con los detalles.

Usa el reporte privado de vulnerabilidades del repositorio:
<https://github.com/zuccadev-labs/zuix/security/advisories/new> (pestaña "Security", "Report a vulnerability").
Es el único canal; no hay dirección de correo de seguridad.

Incluye en el reporte:

- paquete y versión afectados (`@zuccadev-labs/zuix`, `@zuccadev-labs/zuix-tokens`,
  `@zuccadev-labs/zuix-zicon`, `@zuccadev-labs/zuix-zui`, `@zuccadev-labs/zuix-zout`);
- descripción del problema y de su impacto;
- pasos o código mínimo para reproducirlo;
- navegador o entorno, si influye.

## Qué esperar

Mantengo el proyecto yo solo y no puedo garantizar plazos. Mi intención es confirmar la recepción en una
semana, acordar una fecha de divulgación y publicar la corrección con una nota en el `CHANGELOG.md` del
paquete.

## Qué hace la suite con los datos que recibe

- **Modo sin framework** (`@zuccadev-labs/zuix-zui/dom`, `@zuccadev-labs/zuix-zout/dom`). Los textos que
  llegan por argumentos (`toast({ title })`, `confirm({ description })`, etiquetas) se escriben con
  `textContent`: no se interpretan como HTML. El marcado propio de los módulos pasa por un único punto y por
  la política de Trusted Types `zuix-zui`. Los atributos que nombran otro elemento (`data-z-open="#id"`) se
  resuelven por id, no como selector arbitrario.
- **Iconos.** `<z-icon>` y `iconElement()` construyen el SVG con el DOM, sin `innerHTML`. `iconSvg()`
  devuelve una cadena con los valores escapados; quien la inserta en una página decide cómo.
- **React.** Los componentes no usan `dangerouslySetInnerHTML` con datos de la aplicación.
- **Sitio de documentación** (`zudocs`). Un `.mdx` es código y un `.md` deja pasar el HTML que contenga. Para
  documentos escritos por terceros existe el modo `markdown.untrusted` y la cabecera de política de contenido
  que genera `zudocs headers`.

Cómo desplegar con una política de seguridad de contenido estricta:
[CSP y Trusted Types](./docs/users/11-csp-y-trusted-types.md).

## Cadena de suministro

Cómo se construye y se publica, y cómo comprobarlo desde fuera:

- **Publicación.** Solo desde el workflow `release` de este repositorio, con publicación de confianza de npm
  (OIDC, sin tokens de larga duración). Cada versión publicada así lleva procedencia en npm:
  `npm audit signatures` en un proyecto que la instale, o la insignia de procedencia en npmjs.com.
  `0.1.0` la publiqué a mano, antes de existir ese flujo, y no la lleva.
- **Tarballs.** El GitHub Release de cada versión adjunta los cinco tarballs publicados, sus huellas
  (`SHA256SUMS`) y un SBOM CycloneDX por paquete. La atestación de cada tarball se comprueba con
  `gh attestation verify <archivo>.tgz --repo zuccadev-labs/zuix`.
- **Dependencias.** Lockfile congelado en CI; ninguna dependencia ejecuta scripts de instalación; no se
  instala una versión con menos de un día en el registro ni una que pierda la procedencia que tenían las
  anteriores (`pnpm-workspace.yaml`). `pnpm audit` forma parte de la integración continua, y cada pull
  request pasa revisión de dependencias y CodeQL. En `main` se ejecuta además OpenSSF Scorecard.
- **Workflows.** Acciones fijadas por SHA completo, `GITHUB_TOKEN` de solo lectura salvo en el trabajo que
  lo necesita, y sin secretos.

Los paquetes son código de navegador y de compilación: no abren conexiones ni leen el sistema de archivos
al instalarse ni al importarse, y no declaran scripts de instalación. `@zuccadev-labs/zuix-zui` tiene una
sola dependencia en ejecución, `@zuccadev-labs/zuix-tokens`.

El detalle está en [CI y cadena de suministro](./docs/development/03-ci-y-cadena-de-suministro.md).

## Alcance

Dentro del alcance:

- Los paquetes publicados y el código de este repositorio.
- Inyección de marcado o de scripts a través de `@zuccadev-labs/zuix-zui/dom`,
  `@zuccadev-labs/zuix-zout/dom`, `<z-icon>` o los componentes de React cuando reciben datos no confiables
  por las vías documentadas.
- La cadena de publicación: workflows de `.github/workflows/` y contenido de los paquetes.

Fuera del alcance:

- Vulnerabilidades de dependencias sin efecto demostrable en la suite. Se actualizan por la vía normal.
- El uso de funciones que devuelven o insertan HTML con contenido que la propia aplicación no ha saneado,
  cuando la documentación indica que el valor se trata como HTML.
- `examples/` y el sitio de documentación en modo desarrollo.
