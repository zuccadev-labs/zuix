"use client";
import type { LensShape } from "./lens";
import { LENS_BAND } from "./lens";

/**
 * Dibuja con WebGL2 las zonas curvas del carrusel (ruta opcional: requiere texturas por slide).
 *
 * Por cada píxel se deshace la lente (misma fórmula que lensSource en lens.ts) una vez por
 * canal de color con intensidades ligeramente distintas: junto al borde curvo eso produce una
 * refracción cromática en lugar de un contorno; el interior queda limpio.
 * El muestreo usa cuatro sub-muestras con gradientes explícitos para que el resultado sea
 * nítido y sin dientes. La franja central no se dibuja: ahí se ve el slide HTML real.
 */

export interface LensInstance {
  /** Textura (índice del slide). */
  texture: number;
  left: number;
  top: number;
  width: number;
  height: number;
  alpha: number;
}

export interface LensFrame {
  shape: LensShape;
  strength: number;
  /** Separación entre canales (fracción de la deformación). */
  spread: number;
  /** Intensidad del brillo de cristal y del halo (0..1). */
  bloom: number;
  radius: number;
  /** Alcance del halo exterior en px CSS. */
  glow: number;
  /** Color real detrás del lienzo (0..1): completa los canales separados sobre el fondo. */
  background: Rgb;
  instances: LensInstance[];
}

export type Rgb = [number, number, number];

const UNIFORMS = [
  "uViewport", "uRect", "uExpand", "uStrength", "uLens", "uSlide", "uPixelRatio", "uRadius", "uSpread", "uAlpha", "uBand", "uBloom", "uGlow", "uGlowColor", "uBackground",
] as const;
type UniformName = (typeof UNIFORMS)[number];

const COLUMNS = 96;
const ROWS = 4;

const VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aGrid;
uniform vec2 uViewport;
uniform vec4 uRect;
uniform float uExpand;
uniform float uStrength;
uniform float uSpread;
uniform vec4 uLens;

const float CURVE = 1.8;

// Inversa exacta de lensSource: coloca la malla donde se verá el slide.
vec2 lensForward(vec2 p, float k) {
  float halfW = uViewport.x * 0.5;
  float centerY = uViewport.y * 0.5;
  float nx = (p.x - halfW) / halfW;
  float side = nx < 0.0 ? -1.0 : 1.0;
  float a = abs(nx);
  float f = uLens.x;
  float span = max(1.0 - f, 1e-3);
  float m = uLens.z * k;
  float u = 0.0;
  if (a > f) {
    float v = a - f;
    if (v >= span * (1.0 - m)) {
      u = v / (1.0 - m);
    } else {
      float c = m / span;
      u = c < 1e-6 ? v : (1.0 - sqrt(max(1.0 - 4.0 * c * v, 0.0))) / (2.0 * c);
    }
  }
  float ax = a > f ? f + u : a;
  float t = min(u / span, 1.0);
  float halfSlide = uLens.w * 0.5;
  float nySource = (p.y - centerY) / halfSlide;
  float ny = side + (nySource - side) * (1.0 + uLens.y * pow(t, CURVE) * k);
  return vec2(halfW + side * ax * halfW, centerY + ny * halfSlide);
}

void main() {
  vec2 local = mix(vec2(-uExpand), uRect.zw + uExpand, aGrid);
  vec2 warped = lensForward(uRect.xy + local, uStrength * (1.0 + uSpread));
  vec2 clip = warped / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSlide;
uniform vec2 uViewport;
uniform float uPixelRatio;
uniform vec4 uRect;
uniform float uRadius;
uniform vec4 uLens;
uniform float uStrength;
uniform float uSpread;
uniform float uAlpha;
uniform float uBand;
uniform float uBloom;
uniform float uGlow;
uniform vec3 uGlowColor;
uniform vec3 uBackground;
out vec4 outColor;

const float CURVE = 1.8;

vec2 lensSource(vec2 p, float k) {
  float halfW = uViewport.x * 0.5;
  float centerY = uViewport.y * 0.5;
  float nx = (p.x - halfW) / halfW;
  float side = nx < 0.0 ? -1.0 : 1.0;
  float ax = abs(nx);
  float span = max(1.0 - uLens.x, 1e-3);
  float u = max(ax - uLens.x, 0.0);
  float t = min(u / span, 1.0);
  float sx = ax - uLens.z * k * u * t;
  float halfSlide = uLens.w * 0.5;
  float ny = (p.y - centerY) / halfSlide;
  float sy = side + (ny - side) / (1.0 + uLens.y * pow(t, CURVE) * k);
  return vec2(halfW + side * sx * halfW, centerY + sy * halfSlide);
}

float roundedBox(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Cuatro sub-muestras en rejilla rotada con gradientes a mitad de píxel: nítido y sin dientes.
vec4 crisp(vec2 uv) {
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  vec2 gx = dx * 0.5;
  vec2 gy = dy * 0.5;
  return 0.25 * (
    textureGrad(uSlide, uv + dx * 0.125 + dy * 0.375, gx, gy) +
    textureGrad(uSlide, uv + dx * 0.375 - dy * 0.125, gx, gy) +
    textureGrad(uSlide, uv - dx * 0.125 - dy * 0.375, gx, gy) +
    textureGrad(uSlide, uv - dx * 0.375 + dy * 0.125, gx, gy)
  );
}

void main() {
  vec2 screen = vec2(gl_FragCoord.x, 0.0) / uPixelRatio;
  screen.y = uViewport.y - gl_FragCoord.y / uPixelRatio;

  // Fuera de la franja central (ahí se ve el slide HTML nítido).
  float nx = abs(screen.x / uViewport.x * 2.0 - 1.0);
  float t = max(nx - uLens.x, 0.0) / max(1.0 - uLens.x, 1e-3);
  float outside = smoothstep(0.0, uBand, t);
  if (outside <= 0.0) discard;
  float edge = pow(min(t, 1.0), CURVE);

  vec2 size = uRect.zw;
  vec2 halfSize = size * 0.5;
  // Sobre fondo claro el borde se ve azul cuando rojo y verde llegan más lejos que el azul:
  // ahí el contenido oscurece rojo/verde y el azul conserva la luz del fondo.
  vec2 lR = lensSource(screen, uStrength * (1.0 + uSpread)) - uRect.xy;
  vec2 lG = lensSource(screen, uStrength) - uRect.xy;
  vec2 lB = lensSource(screen, uStrength * (1.0 - uSpread)) - uRect.xy;
  float dR = roundedBox(lR - halfSize, halfSize, uRadius);
  float dG = roundedBox(lG - halfSize, halfSize, uRadius);
  float dB = roundedBox(lB - halfSize, halfSize, uRadius);
  float aa = max(fwidth(dG), 1e-4);
  vec3 cover = clamp(0.5 - vec3(dR, dG, dB) / aa, 0.0, 1.0);
  float coverage = max(cover.r, max(cover.g, cover.b));

  // La separación de color solo vive junto al borde: el interior queda limpio.
  vec4 base = crisp(lG / size);
  float rimZone = 1.0 - smoothstep(6.0, 22.0, -dG);
  vec3 split = vec3(crisp(lR / size).r, base.g, crisp(lB / size).b);
  vec3 tex = mix(base.rgb, split, rimZone);
  // Color premultiplicado por canal; donde un canal no cubre se completa con el fondo real.
  vec3 color = cover * tex + (coverage - cover) * uBackground;

  // Brillo de cristal: franja clara muy suave por dentro del borde curvo.
  float inner = (1.0 - smoothstep(0.0, 14.0, -dG)) * step(dG, 0.0);
  color = mix(color, vec3(coverage), inner * edge * uBloom * 0.16);

  // Halo exterior tenue (luz, no contorno).
  float halo = 1.0 - smoothstep(0.0, uGlow, max(dR, 0.0));
  halo = halo * halo * edge * uBloom * 0.2 * (1.0 - coverage);

  float weight = uAlpha * outside;
  outColor = vec4((color + uGlowColor * halo) * weight, (coverage + halo) * weight);
}
`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("No se pudo crear el shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log ?? "Error de compilación");
  }
  return shader;
}

export class LensRenderer {
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly buffers: WebGLBuffer[];
  private readonly indexCount: number;
  private readonly textures = new Map<number, WebGLTexture>();
  private readonly anisotropy: { ext: EXT_texture_filter_anisotropic; max: number } | null;
  private readonly uniforms: Record<UniformName, WebGLUniformLocation | null>;
  private readonly handleLost: (event: Event) => void;
  private glowColor: Rgb = [1, 1, 1];
  private cssWidth = 1;
  private cssHeight = 1;
  private ratio = 1;
  readonly maxTextureSize: number;
  lost = false;

  /**
   * El navegador negó WebGL2 en esta página. No hay forma de preguntarlo sin pedir un contexto (la interfaz
   * WebGL2RenderingContext existe aunque no se pueda crear), y Firefox escribe un aviso en la consola por cada
   * intento fallido: se pregunta una vez y los demás carruseles de la página van directos a la lente css.
   */
  private static unavailable = false;

  static create(canvas: HTMLCanvasElement, onLost: () => void): LensRenderer | null {
    if (LensRenderer.unavailable) return null;
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!gl) {
      LensRenderer.unavailable = true;
      return null;
    }
    if (gl.isContextLost()) return null;
    try {
      return new LensRenderer(canvas, gl, onLost);
    } catch {
      return null;
    }
  }

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    onLost: () => void,
  ) {
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!program) throw new Error("No se pudo crear el programa");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Error de enlace");
    this.program = program;

    const names = UNIFORMS;
    this.uniforms = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)])) as Record<
      UniformName,
      WebGLUniformLocation | null
    >;
    this.maxTextureSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, 4096);

    // Malla: muchas columnas (la curva depende de x) y pocas filas (en y el mapeo es lineal).
    const vertices = new Float32Array((COLUMNS + 1) * (ROWS + 1) * 2);
    let v = 0;
    for (let row = 0; row <= ROWS; row++) {
      for (let column = 0; column <= COLUMNS; column++) {
        vertices[v++] = column / COLUMNS;
        vertices[v++] = row / ROWS;
      }
    }
    const indices = new Uint16Array(COLUMNS * ROWS * 6);
    let i = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let column = 0; column < COLUMNS; column++) {
        const a = row * (COLUMNS + 1) + column;
        const b = a + 1;
        const c = a + COLUMNS + 1;
        const d = c + 1;
        indices.set([a, c, b, b, c, d], i);
        i += 6;
      }
    }
    this.indexCount = indices.length;

    const vao = gl.createVertexArray();
    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    if (!vao || !vertexBuffer || !indexBuffer) throw new Error("No se pudo crear la malla");
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.vao = vao;
    this.buffers = [vertexBuffer, indexBuffer];

    const ext = gl.getExtension("EXT_texture_filter_anisotropic");
    this.anisotropy = ext ? { ext, max: Math.min(16, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number) } : null;

    this.handleLost = (event: Event) => {
      event.preventDefault();
      this.lost = true;
      onLost();
    };
    canvas.addEventListener("webglcontextlost", this.handleLost);
  }

  resize(width: number, height: number, pixelRatio: number) {
    this.cssWidth = Math.max(width, 1);
    this.cssHeight = Math.max(height, 1);
    this.ratio = pixelRatio;
    const w = Math.max(1, Math.round(width * pixelRatio));
    const h = Math.max(1, Math.round(height * pixelRatio));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  setGlowColor(color: Rgb) {
    this.glowColor = color;
  }

  setTexture(slot: number, source: TexImageSource) {
    const gl = this.gl;
    if (this.lost) return;
    const texture = this.textures.get(slot) ?? gl.createTexture();
    if (!texture) return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (this.anisotropy) gl.texParameterf(gl.TEXTURE_2D, this.anisotropy.ext.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropy.max);
    this.textures.set(slot, texture);
  }

  draw(frame: LensFrame) {
    const gl = this.gl;
    if (this.lost) return;
    const u = this.uniforms;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(u.uSlide, 0);

    const { shape } = frame;
    const [br, bg, bb] = frame.background;
    const [gr, gg, gb] = this.glowColor;
    gl.uniform2f(u.uViewport, this.cssWidth, this.cssHeight);
    gl.uniform1f(u.uPixelRatio, this.cssWidth > 0 ? this.canvas.width / this.cssWidth : this.ratio);
    gl.uniform4f(u.uLens, shape.flat, shape.stretch, shape.magnify, shape.slideHeight);
    gl.uniform1f(u.uRadius, frame.radius);
    gl.uniform1f(u.uStrength, frame.strength);
    gl.uniform1f(u.uSpread, frame.spread);
    gl.uniform1f(u.uBloom, frame.bloom);
    gl.uniform1f(u.uGlow, frame.glow);
    gl.uniform1f(u.uBand, LENS_BAND);
    gl.uniform3f(u.uGlowColor, gr, gg, gb);
    gl.uniform3f(u.uBackground, br, bg, bb);
    // La malla usa la deformación del canal más desplazado y un margen para el rojo y el halo.
    gl.uniform1f(u.uExpand, frame.glow + shape.slideHeight * shape.stretch * frame.spread + 4);

    for (const instance of frame.instances) {
      const texture = this.textures.get(instance.texture);
      if (!texture || instance.alpha <= 0.001) continue;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform4f(u.uRect, instance.left, instance.top, instance.width, instance.height);
      gl.uniform1f(u.uAlpha, instance.alpha);
      gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
  }

  clear() {
    if (this.lost) return;
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /** Libera recursos sin perder el contexto (React StrictMode vuelve a montar sobre el mismo lienzo). */
  dispose() {
    const gl = this.gl;
    this.canvas.removeEventListener("webglcontextlost", this.handleLost);
    if (this.lost) return;
    this.textures.forEach((texture) => gl.deleteTexture(texture));
    this.textures.clear();
    this.buffers.forEach((buffer) => gl.deleteBuffer(buffer));
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
    this.clear();
  }
}
