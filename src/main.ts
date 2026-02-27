/// <reference types="@webgpu/types" />
import "./style.css";
import shaderCode from "./shader.wgsl?raw";
import { Camera } from "./camera.ts";
import { mat4 } from "./math.ts";
import { Cube, unprojectClick, FLOATS_PER_VERTEX } from "./cube.ts";
import { createTextures, TEXTURE_COUNT } from "./textures.ts";

if (!navigator.gpu) throw new Error("WebGPU not supported");

const canvas = document.querySelector("#gfx-main") as HTMLCanvasElement;
if (!canvas) throw new Error("Canvas not found");

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) throw new Error("No adapter");
const device = await adapter.requestDevice();

const context = canvas.getContext("webgpu");
if (!context) throw new Error("No context");

const format = navigator.gpu.getPreferredCanvasFormat();
let depthTexture: GPUTexture | null = null;

function resize() {
  canvas.width  = Math.max(1, Math.floor(window.innerWidth  * devicePixelRatio));
  canvas.height = Math.max(1, Math.floor(window.innerHeight * devicePixelRatio));
  context.configure({ device, format, alphaMode: "premultiplied" });
  depthTexture?.destroy();
  depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
  });
}
resize();
window.addEventListener("resize", resize);

// ─── Pipeline ────────────────────────────────────────────────────────────────
const pipeline = device.createRenderPipeline({
  layout: "auto",
  vertex: {
    module: device.createShaderModule({ code: shaderCode }),
    entryPoint: "vs_main",
    buffers: [{
      arrayStride: FLOATS_PER_VERTEX * 4, // 8 * 4 = 32 bytes
      attributes: [
        { shaderLocation: 0, offset:  0, format: "float32x3" }, // xyz
        { shaderLocation: 1, offset: 12, format: "float32x2" }, // uv
        { shaderLocation: 2, offset: 20, format: "float32x3" }, // rgb
      ],
    }],
  },
  fragment: {
    module: device.createShaderModule({ code: shaderCode }),
    entryPoint: "fs_main",
    targets: [{ format }],
  },
  primitive: { topology: "triangle-list", cullMode: "back" },
  depthStencil: {
    format: "depth24plus",
    depthWriteEnabled: true,
    depthCompare: "less",
  },
});

// ─── Recursos compartidos ─────────────────────────────────────────────────────
const sampler = device.createSampler({
  magFilter: "linear", minFilter: "linear",
  addressModeU: "repeat", addressModeV: "repeat",
});

const textures = await createTextures(device); //carga textura patrones

// ─── Cubos ────────────────────────────────────────────────────────────────────
const MAX_CUBES    = 512;
const MIN_DISTANCE = .5;
const cubes: Cube[] = [];

function isTooClose(cx: number, cy: number, cz: number): boolean {
  return cubes.some(c => {
    const dx = c.center[0]-cx, dy = c.center[1]-cy, dz = c.center[2]-cz;
    return Math.sqrt(dx*dx + dy*dy + dz*dz) < MIN_DISTANCE;
  });
}

function addCube(cx: number, cy: number, cz: number) {
  if (cubes.length >= MAX_CUBES) return;
  if (isTooClose(cx, cy, cz)) {
    console.log("Muy cerca de otro cubo");
    return;
  }

  const cube = new Cube(cx, cy, cz, TEXTURE_COUNT, device, pipeline, sampler, textures);
  cubes.push(cube);
}

function addRandomCube() {
  const RANGE = 10; // unidades de mundo en X e Y
  const DEPTH =  10; // rango en Z para que queden cerca del plano visible

  for (let attempt = 0; attempt < 10; attempt++) {
    const cx = (Math.random() * 2 - 1) * RANGE;
    const cy = (Math.random() * 2 - 1) * RANGE;
    const cz = (Math.random() * 2 - 1) * DEPTH;

    if (!isTooClose(cx, cy, cz)) {
      addCube(cx, cy, cz);
      return;
    }
  }
}

// ─── Cámara ───────────────────────────────────────────────────────────────────
const camera = new Camera();
const keys   = new Set<string>();
window.addEventListener("keydown", e => {
  keys.add(e.key);

  if (e.key === " ") {
    e.preventDefault(); // evita scroll de la página
    addRandomCube();
  }
});window.addEventListener("keyup",   e => keys.delete(e.key));

let currentInvVP = new Float32Array(16);

canvas.addEventListener("click", e => {
  const [wx, wy, wz] = unprojectClick(e.clientX, e.clientY, canvas, currentInvVP, 0);
  addCube(wx, wy, wz);
});

// ─── Inversión mat4 ───────────────────────────────────────────────────────────
// Invertir una matriz 4x4 (column-major) para el unproject del mouse 
function invertMat4(m: Float32Array): Float32Array { 
  const inv = new Float32Array(16);
  const m00=m[0],m01=m[1],m02=m[2],m03=m[3];
  const m10=m[4],m11=m[5],m12=m[6],m13=m[7];
  const m20=m[8],m21=m[9],m22=m[10],m23=m[11];
  const m30=m[12],m31=m[13],m32=m[14],m33=m[15];
  const b00=m00*m11-m01*m10,b01=m00*m12-m02*m10,b02=m00*m13-m03*m10;
  const b03=m01*m12-m02*m11,b04=m01*m13-m03*m11,b05=m02*m13-m03*m12;
  const b06=m20*m31-m21*m30,b07=m20*m32-m22*m30,b08=m20*m33-m23*m30;
  const b09=m21*m32-m22*m31,b10=m21*m33-m23*m31,b11=m22*m33-m23*m32;
  const det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;
  if (Math.abs(det)<1e-10) return m;
  const d=1/det;
  inv[0] =( m11*b11-m12*b10+m13*b09)*d; inv[1] =(-m01*b11+m02*b10-m03*b09)*d;
  inv[2] =( m31*b05-m32*b04+m33*b03)*d; inv[3] =(-m21*b05+m22*b04-m23*b03)*d;
  inv[4] =(-m10*b11+m12*b08-m13*b07)*d; inv[5] =( m00*b11-m02*b08+m03*b07)*d;
  inv[6] =(-m30*b05+m32*b02-m33*b01)*d; inv[7] =( m20*b05-m22*b02+m23*b01)*d;
  inv[8] =( m10*b10-m11*b08+m13*b06)*d; inv[9] =(-m00*b10+m01*b08-m03*b06)*d;
  inv[10]=( m30*b04-m31*b02+m33*b00)*d; inv[11]=(-m20*b04+m21*b02-m23*b00)*d;
  inv[12]=(-m10*b09+m11*b07-m12*b06)*d; inv[13]=( m00*b09-m01*b07+m02*b06)*d;
  inv[14]=(-m30*b03+m31*b01-m32*b00)*d; inv[15]=( m20*b03-m21*b01+m22*b00)*d;
  return inv;
}

// ─── Frame loop ───────────────────────────────────────────────────────────────
let lastTime = performance.now(); 
// loop principal: actualizar cámara, animar cubos, renderizar escena
function frame(now: number) {
  const dt = Math.min(0.033, (now - lastTime) / 1000); // limitar frames para evitar saltos, esto es lo que explico Mena de usar el tiempo
  lastTime = now;

  camera.update(keys, dt); 

  const proj = mat4.perspective((60 * Math.PI) / 180, canvas.width / canvas.height, 0.1, 100.0); // matriz de proyección
  const view = camera.getViewMatrix(); 
  const vp   = mat4.multiply(proj, view); 

  currentInvVP = invertMat4(vp); // actualizar la inversa de VP para el unproject del mouse

  const encoder = device.createCommandEncoder(); // crear encoder para comandos GPU
  const pass    = encoder.beginRenderPass({ 
    colorAttachments: [{ // cada frame se renderiza a la textura del canvas
      view: context.getCurrentTexture().createView(),
      clearValue: { r: 0.06, g: 0.08, b: 0.12, a: 1.0 },
      loadOp: "clear", storeOp: "store",
    }],
    depthStencilAttachment: { // renderizar profundidad a la textura depthTexture para el test de profundidad
      view: depthTexture!.createView(), // depthTexture no es null porque se crea en resize() que se llama antes de iniciar el frame loop
      depthClearValue: 1.0,
      depthLoadOp: "clear", depthStoreOp: "store",
    },
  });

  pass.setPipeline(pipeline);

  for (const cube of cubes) { // cada cubo tiene su propia posición, textura y uniform buffer, así que se actualiza y renderiza por separado
    cube.update(dt);

    // 2. Calcular MVP y subir al uniform buffer propio del cubo
    const mvp = mat4.multiply(vp, cube.buildModelMatrix());
    device.queue.writeBuffer(cube.uniformBuffer, 0, mvp);

    // 3. Cada cubo tiene su propio bindGroup (con su textura y su uniform)
    pass.setBindGroup(0, cube.bindGroup);
    pass.setVertexBuffer(0, cube.vertexBuffer);
    pass.draw(36);
  }

  pass.end();
  device.queue.submit([encoder.finish()]);
  requestAnimationFrame(frame); 
}

requestAnimationFrame(frame); 