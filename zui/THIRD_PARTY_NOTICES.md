# Avisos de terceros de @zuccadev-labs/zuix-zui

`@zuccadev-labs/zuix-zui` no depende en ejecución de ningún paquete ajeno a la suite zuix. Sus primitivas (diálogos, capas, menús,
controles de formulario) están escritas a partir de los patrones de la
[ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) y de las APIs de la plataforma (`<dialog>`,
Popover API).

Dos piezas de `src/core/menu-aim.ts` adaptan técnicas concretas publicadas por terceros. Se conservan aquí sus avisos.

## Zona de gracia del puntero en submenús

El polígono entre el punto por el que el puntero sale de una entrada y el borde cercano de su submenú
(`graceArea`, `createMenuAim`) sigue la técnica de «pointer grace area» de los menús de
[Radix UI Primitives](https://github.com/radix-ui/primitives). El código es propio; no se ha copiado el suyo.

```
MIT License

Copyright (c) 2022 WorkOS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Punto dentro de un polígono

`inPolygon` es una adaptación a TypeScript del código C de PNPOLY, de W. Randolph Franklin
(<https://wrfranklin.org/Research/Short_Notes/pnpoly.html>): la prueba par-impar con un rayo horizontal.

```
Copyright (c) 1970-2003, Wm. Randolph Franklin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimers.
2. Redistributions in binary form must reproduce the above copyright notice
   in the documentation and/or other materials provided with the
   distribution.
3. The name of W. Randolph Franklin may not be used to endorse or promote
   products derived from this Software without specific prior written
   permission.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
