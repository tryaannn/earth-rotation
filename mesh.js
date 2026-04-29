/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  MODUL 1 — MESH ARCHITECT                               ║
 * ║  UV Sphere geometry generator (pure JS, no libraries)   ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Tanggung jawab:
 *  - Menghasilkan Float32Array posisi (x,y,z)
 *  - Menghasilkan Float32Array normal  (nx,ny,nz)
 *  - Menghasilkan Float32Array UV      (u,v)
 *  - Menghasilkan Uint16Array  indices untuk gl.drawElements
 *
 * Algoritma: latitude/longitude subdivision dengan sin/cos.
 * Setiap "quad" antara dua ring lintang dibagi menjadi 2 segitiga.
 */

export function generateUVSphere(latBands = 64, lonBands = 64) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // ── Vertex generation ─────────────────────────────────────
  // lat  = baris dari kutub utara (0) ke kutub selatan (latBands)
  // lon  = kolom melingkar  0..lonBands (lonBands == lon 0, wrapped)
  for (let lat = 0; lat <= latBands; lat++) {
    const theta = (lat * Math.PI) / latBands; // 0 → π
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= lonBands; lon++) {
      const phi = (lon * 2 * Math.PI) / lonBands; // 0 → 2π
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      // Untuk unit sphere: posisi == normal
      const nx = cosPhi * sinTheta;
      const ny = cosTheta;
      const nz = sinPhi * sinTheta;

      // UV: u berjalan kebalikan agar tekstur tidak mirror
      const u = 1 - lon / lonBands;
      const v = 1 - lat / latBands;

      positions.push(nx, ny, nz);
      normals.push(nx, ny, nz);
      uvs.push(u, v);
    }
  }

  // ── Index buffer (2 segitiga per quad) ────────────────────
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const a = lat * (lonBands + 1) + lon; // kiri-atas
      const b = a + (lonBands + 1); // kiri-bawah
      const c = a + 1; // kanan-atas
      const d = b + 1; // kanan-bawah

      // Segitiga 1: a-b-c
      indices.push(a, b, c);
      // Segitiga 2: b-d-c
      indices.push(b, d, c);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    vertexCount: positions.length / 3,
    indexCount: indices.length,
  };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fract(value) {
  return value - Math.floor(value);
}

function hash2(x, y) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
}

function valueNoise2D(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);

  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);

  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}

function fbm2(x, y, octaves = 5) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1.0;

  for (let i = 0; i < octaves; i++) {
    sum += amplitude * valueNoise2D(x * frequency, y * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return sum;
}

function blendRgb(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function generateEarthTexture(size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  const image = context.createImageData(size, size);
  const pixels = image.data;

  const deepOcean = [8, 26, 72];
  const midOcean = [16, 68, 132];
  const shallowOcean = [40, 126, 188];
  const shore = [214, 196, 138];
  const grass = [54, 120, 63];
  const forest = [31, 94, 57];
  const mountain = [122, 114, 100];
  const snow = [245, 248, 252];
  const desert = [204, 181, 108];

  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    const lat = (0.5 - v) * Math.PI;
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);

    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const lon = (u - 0.5) * Math.PI * 2;
      const cosLon = Math.cos(lon);
      const sinLon = Math.sin(lon);

      const globeX = cosLat * cosLon;
      const globeY = sinLat;
      const globeZ = cosLat * sinLon;
      const latitude = Math.abs(globeY);

      const continental = fbm2(
        globeX * 1.7 + globeY * 0.35,
        globeZ * 1.7 - globeY * 0.25
      );
      const regional = fbm2(globeX * 4.8 + 11.0, globeZ * 4.8 - 7.0);
      const detail = fbm2(globeX * 11.0 + 19.0, globeZ * 11.0 + 31.0);
      const ridge = fbm2(globeX * 16.0 - 4.0, globeZ * 16.0 + 13.0);

      const latitudeBias = 0.12 - Math.abs(globeY) * 0.16;
      const landNoise =
        continental +
        0.24 * regional +
        0.1 * detail +
        0.06 * ridge +
        latitudeBias;
      const landMask = smoothstep(-0.04, 0.3, landNoise);
      const coast =
        smoothstep(0.08, 0.22, landNoise) *
        (1 - smoothstep(0.2, 0.4, landNoise));

      const oceanDepth = clamp01((0.34 - landNoise) / 0.34);
      let color = blendRgb(
        midOcean,
        deepOcean,
        smoothstep(0.15, 0.95, oceanDepth)
      );
      color = blendRgb(shallowOcean, color, smoothstep(0.2, 0.8, oceanDepth));

      if (landMask > 0.16) {
        const elevation = clamp01(
          (regional + detail * 0.7 + ridge * 0.35 + 1.1) * 0.34
        );
        const dryness = clamp01(0.75 - Math.abs(globeY) * 1.7 + detail * 0.18);
        const highElevation = smoothstep(0.42, 0.82, elevation);
        const veryHigh = smoothstep(0.7, 0.95, elevation);

        let landColor = blendRgb(
          grass,
          forest,
          smoothstep(0.18, 0.65, elevation)
        );
        landColor = blendRgb(landColor, mountain, highElevation);
        landColor = blendRgb(
          landColor,
          snow,
          veryHigh * smoothstep(0.55, 0.95, latitude)
        );
        landColor = blendRgb(
          landColor,
          desert,
          smoothstep(0.42, 0.74, dryness)
        );

        color = blendRgb(color, landColor, 0.95);
        color = blendRgb(color, shore, coast * 0.8);
      }

      const polarCap = smoothstep(0.7, 0.99, latitude);
      color = blendRgb(color, snow, polarCap * 0.78);

      const idx = (y * size + x) * 4;
      pixels[idx + 0] = Math.round(color[0]);
      pixels[idx + 1] = Math.round(color[1]);
      pixels[idx + 2] = Math.round(color[2]);
      pixels[idx + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas;
}

export function generateCloudTexture(size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  const image = context.createImageData(size, size);
  const pixels = image.data;

  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    const latBand = Math.sin(v * Math.PI);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const fx = u * 8.0;
      const fy = v * 8.0;
      const n = fbm2(fx + 3.1, fy - 1.7, 5);
      const n2 = fbm2(fx * 2.0 - 5.4, fy * 2.0 + 2.2, 4);
      const density = clamp01((n * 0.65 + n2 * 0.35 + 0.18) * latBand);
      const alpha = Math.round(Math.pow(density, 1.7) * 255);
      const idx = (y * size + x) * 4;
      pixels[idx + 0] = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
      pixels[idx + 3] = alpha;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas;
}
