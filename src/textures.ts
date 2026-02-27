const SIZE = 128;

async function loadTextureFromImage(device: GPUDevice, url: string): Promise<GPUTexture> {
    const response = await fetch(url);
    const blob = await response.blob();
    const source = await createImageBitmap(blob); // Convierte la imagen a un formato que la GPU entiende

    const tex = device.createTexture({
        size: [source.width, source.height, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    device.queue.copyExternalImageToTexture(
        { source: source, flipY: false }, // Cambia flipY a true si la imagen sale al revés
        { texture: tex },
        [source.width, source.height]
    );

    return tex;
}



function uploadTexture(device: GPUDevice, data: Uint8Array): GPUTexture {
  
  const tex = device.createTexture({
    size: [SIZE, SIZE, 1],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
    { texture: tex },
    data,
    { bytesPerRow: SIZE * 4, rowsPerImage: SIZE },
    [SIZE, SIZE, 1]
  );
  return tex;
}

// Checkerboard: cuadros blancos y grises
function makeCheckerboard(device: GPUDevice): GPUTexture { 
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const c = (((x >> 4) & 1) ^ ((y >> 4) & 1)) ? 255 : 80;
      data[i] = data[i+1] = data[i+2] = c;
      data[i+3] = 255;
    }
  }
  return uploadTexture(device, data); 
}

// Stripes: rayas horizontales blancas y grises
function makeStripes(device: GPUDevice): GPUTexture { 
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const c = ((y >> 3) & 1) ? 255 : 80;
      data[i] = data[i+1] = data[i+2] = c;
      data[i+3] = 255;
    }
  }
  return uploadTexture(device, data);
}

// Dots: puntos blancos sobre fondo gris
function makeDots(device: GPUDevice): GPUTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);
  const CELL = 16;
  const R    = 5;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i  = (y * SIZE + x) * 4;
      const cx = (x % CELL) - CELL / 2;
      const cy = (y % CELL) - CELL / 2;
      const c  = (cx*cx + cy*cy) <= R*R ? 255 : 80;
      data[i] = data[i+1] = data[i+2] = c;
      data[i+3] = 255;
    }
  }
  return uploadTexture(device, data);
}

/* 
export function createTextures(device: GPUDevice): GPUTexture[] {
  return [
    makeCheckerboard(device),
    makeStripes(device),
    makeDots(device),
  ];
}*/

export async function createTextures(device: GPUDevice): Promise<GPUTexture[]> {
  return [
    makeCheckerboard(device), // Sigue siendo inmediata
    makeStripes(device),      // Sigue siendo inmediata
    await loadTextureFromImage(device, "../public/minecraft.jpg"), // ESPERA a la imagen
  ];
}


export const TEXTURE_COUNT = 3;