# Política de seguridad

## Versiones con soporte

Los paquetes están en `0.x`. Las correcciones de seguridad se aplican a la última versión publicada.

| Versión | Soporte |
|---|---|
| Última `0.x` publicada | Sí |
| Anteriores | No |

## Cómo reportar una vulnerabilidad

No abras un issue público ni un pull request con los detalles.

1. Canal preferente: el reporte privado de vulnerabilidades del repositorio (pestaña "Security",
   "Report a vulnerability"). **Pendiente de definir por el responsable:** hay que activarlo en la
   configuración del repositorio cuando exista.
2. Canal alternativo por correo: **pendiente de definir por el responsable.** Todavía no hay una
   dirección de contacto de seguridad.

Mientras ninguno de los dos canales esté activo, abre un issue que diga solo que quieres reportar un
problema de seguridad, sin detalles, y espera a que el responsable indique un canal privado.

Incluye en el reporte:

- paquete y versión afectados (`@zuccadev-labs/zuix`, `@zuccadev-labs/zuix-tokens`, `@zuccadev-labs/zuix-zicon`, `@zuccadev-labs/zuix-zui`, `@zuccadev-labs/zuix-zout`);
- descripción del problema y de su impacto;
- pasos o código mínimo para reproducirlo;
- navegador o entorno, si influye.

## Qué esperar

Los plazos de respuesta y de corrección están **pendientes de definir por el responsable.** La intención
es confirmar la recepción, acordar una fecha de divulgación y publicar la corrección con una nota en el
`CHANGELOG.md` del paquete.

## Alcance

Dentro del alcance:

- Los paquetes publicados y el código de este repositorio.
- Inyección de marcado o de scripts a través de `@zuccadev-labs/zuix-zui/dom`, `@zuccadev-labs/zuix-zout/dom`, `<z-icon>` o los
  componentes de React cuando reciben datos no confiables por las vías documentadas.
- La cadena de publicación: workflows de `.github/workflows/` y contenido de los paquetes.

Fuera del alcance:

- Vulnerabilidades de dependencias sin efecto demostrable en la suite. Se actualizan por la vía normal.
- El uso de funciones que insertan HTML con contenido que la propia aplicación no ha saneado, cuando la
  documentación indica que el valor se inserta como HTML.
- `examples/` y el sitio de documentación en modo desarrollo.
