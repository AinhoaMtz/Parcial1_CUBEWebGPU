import { mat4 } from "./math.ts";

const BASE_VERTICES: number[] = [
  // Front (+Z)
  -1, -1,  1, 0, 1,
   1, -1,  1, 1, 1,
   1,  1,  1, 1, 0,
  -1, -1,  1, 0, 1,
   1,  1,  1, 1, 0,
  -1,  1,  1, 0, 0,
  // Back (-Z)
   1, -1, -1, 0, 1,
  -1, -1, -1, 1, 1,
  -1,  1, -1, 1, 0,
   1, -1, -1, 0, 1,
  -1,  1, -1, 1, 0,
   1,  1, -1, 0, 0,
  // Left (-X)
  -1, -1, -1, 0, 1,
  -1, -1,  1, 1, 1,
  -1,  1,  1, 1, 0,
  -1, -1, -1, 0, 1,
  -1,  1,  1, 1, 0,
  -1,  1, -1, 0, 0,
  // Right (+X)
   1, -1,  1, 0, 1,
   1, -1, -1, 1, 1,
   1,  1, -1, 1, 0,
   1, -1,  1, 0, 1,
   1,  1, -1, 1, 0,
   1,  1,  1, 0, 0,
  // Top (+Y)
  -1,  1,  1, 0, 1,
   1,  1,  1, 1, 1,
   1,  1, -1, 1, 0,
  -1,  1,  1, 0, 1,
   1,  1, -1, 1, 0,
  -1,  1, -1, 0, 0,
  // Bottom (-Y)
  -1, -1, -1, 0, 1,
   1, -1, -1, 1, 1,
   1, -1,  1, 1, 0,
  -1, -1, -1, 0, 1,
   1, -1,  1, 1, 0,
  -1, -1,  1, 0, 0,
];

export interface CubeCategory {
  name: string;
  color: [number, number, number];
  halfSize: number;
}

export const CUBE_CATEGORIES: CubeCategory[] = [
  { name: "Normal", color: [1.0, 1.0, 1.0], halfSize: 0.50 }, 
  { name: "Rojo",   color: [1.0, 0.2, 0.2], halfSize: 0.50 },
  { name: "Azul",   color: [0.2, 0.5, 1.0], halfSize: 0.50 },
];

export const FLOATS_PER_VERTEX = 8;  // x,y,z,u,v,r,g,b
export const VERTICES_PER_CUBE = 36; 
export const FLOATS_PER_CUBE   = VERTICES_PER_CUBE * FLOATS_PER_VERTEX; 

export type RotationPlane = 0 | 1 | 2;

export class Cube {
  center:       [number, number, number];
  halfSize:     number;
  category:     CubeCategory;
  textureIndex: number;

  angle:     number;
  direction: 1 | -1;
  plane:     RotationPlane;
  rotSpeed:  number;

  vertices:      Float32Array;

  // Cada cubo tiene su propio uniform buffer y bindGroup
  uniformBuffer: GPUBuffer;
  bindGroup:     GPUBindGroup;

  // Vertex buffer propio (36 vértices)
  vertexBuffer:  GPUBuffer;

  constructor(
    cx: number, cy: number, cz: number,
    textureCount: number,
    device: GPUDevice,
    pipeline: GPURenderPipeline,
    sampler: GPUSampler,
    textures: GPUTexture[],
  ) {
    this.center       = [cx, cy, cz];
    this.category     = CUBE_CATEGORIES[Math.floor(Math.random() * CUBE_CATEGORIES.length)];
    this.halfSize     = this.category.halfSize;
    this.textureIndex = Math.floor(Math.random() * textureCount);
    this.direction    = Math.random() < 0.5 ? 1 : -1;
    this.plane        = Math.floor(Math.random() * 3) as RotationPlane;
    this.angle        = 0;
    this.rotSpeed     = 0.8 + Math.random() * 0.6;
    
    this.vertices = this.buildVertices();

    // ── Vertex buffer propio ──────────────────────────────────────────────────
    this.vertexBuffer = device.createBuffer({ // cada cubo tiene su propio vertex buffer con sus colores y coordenadas UV calculados en buildVertices()
      size:  this.vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices); 

    // ── Uniform buffer propio (64 bytes = mat4) ───────────────────────────────
    this.uniformBuffer = device.createBuffer({ 
      size:  64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // ── BindGroup propio ──────────────────────────────────────────────────────
    this.bindGroup = device.createBindGroup({ 
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: textures[this.textureIndex].createView() },
      ],
    });
  }

  private buildVertices(): Float32Array { // cada cubo tiene su propio array de vértices con posiciones escaladas por halfSize, colores según categoría y coordenadas UV base
    const out          = new Float32Array(FLOATS_PER_CUBE);
    
    let cr: number, cg: number, cb: number;
    //const [cr, cg, cb] = this.category.color;


    if(this.textureIndex == 2) {
      [cr, cg, cb]  = [1.0, 1.0, 1.0];   
    } else {
      [cr, cg, cb] = this.category.color;
    }
    const hs           = this.halfSize;
    const BASE_STRIDE  = 5;

    for (let i = 0; i < VERTICES_PER_CUBE; i++) {
      const src = i * BASE_STRIDE;
      const dst = i * FLOATS_PER_VERTEX;

      out[dst + 0] = BASE_VERTICES[src + 0] * hs; // x (espacio local)
      out[dst + 1] = BASE_VERTICES[src + 1] * hs; // y
      out[dst + 2] = BASE_VERTICES[src + 2] * hs; // z
      out[dst + 3] = BASE_VERTICES[src + 3];       // u
      out[dst + 4] = BASE_VERTICES[src + 4];       // v
      out[dst + 5] = cr;                           // r
      out[dst + 6] = cg;                           // g
      out[dst + 7] = cb;                           // b
    }

    return out;
  }

  update(dt: number) {
    this.angle += this.direction * this.rotSpeed * dt;
  }

  buildModelMatrix() { // cada cubo construye su propia matriz de modelo a partir de su posición y su rotacion segun
  //  el plano elegido, luego se multiplica T*R para que la rotación sea alrededor del centro del cubo
    const T = mat4.translation(this.center[0], this.center[1], this.center[2]);
    let R;
    switch (this.plane) {
      case 0: R = mat4.rotationX(this.angle); break;
      case 1: R = mat4.rotationY(this.angle); break;
      case 2: R = mat4.rotationZ(this.angle); break;
    }
    return mat4.multiply(T, R);
  }
}


export function unprojectClick( 
  clickX: number,
  clickY: number,
  canvas: HTMLCanvasElement,
  invVP: Float32Array,
  worldZ: number = 0
): [number, number, number] {
  const ndcX =  (clickX / canvas.clientWidth)  * 2 - 1;
  const ndcY = -(clickY / canvas.clientHeight) * 2 + 1;

  const near = multiplyMat4Vec4(invVP, [ndcX, ndcY, -1, 1]);// convertir coordenadas de pantalla a espacio mundo a una profundidad de -1 (near plane)
  const far  = multiplyMat4Vec4(invVP, [ndcX, ndcY,  1, 1]); // convertir coordenadas de pantalla a espacio mundo a una profundidad de 1 (far plane)

  const nearPos: [number, number, number] = [near[0]/near[3], near[1]/near[3], near[2]/near[3]];
  const farPos:  [number, number, number] = [far[0] /far[3],  far[1] /far[3],  far[2] /far[3]];

  const dir: [number, number, number] = [ // dirección del rayo desde la cámara hacia el mundo, normalizada 
    farPos[0] - nearPos[0],
    farPos[1] - nearPos[1],
    farPos[2] - nearPos[2],
  ];

  const t = dir[2] !== 0 ? (worldZ - nearPos[2]) / dir[2] : 0; 
  return [nearPos[0] + dir[0] * t, nearPos[1] + dir[1] * t, worldZ];
}

function multiplyMat4Vec4(  // multiplicar una matriz 4x4 por un vector 4D, útil para el unproject del mouse
  m: Float32Array,
  v: [number, number, number, number]
): [number, number, number, number] {
  return [ 
    m[0]*v[0] + m[4]*v[1] + m[8] *v[2] + m[12]*v[3],
    m[1]*v[0] + m[5]*v[1] + m[9] *v[2] + m[13]*v[3],
    m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14]*v[3],
    m[3]*v[0] + m[7]*v[1] + m[11]*v[2] + m[15]*v[3],
  ];
}
  