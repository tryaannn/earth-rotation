/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  MODUL 3 — PHYSICS & CAMERA                             ║
 * ║  Matriks transformasi, Arcball Camera, Directional Light ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Tanggung jawab:
 *  1. Matriks rotasi bumi dengan kemiringan sumbu 23.5°
 *  2. Arcball Camera (orbit) via mouse / touch drag
 *  3. Directional Light sederhana (simulasi matahari)
 *
 * Dependency: none (helper matriks lokal)
 */

function createMat4() {
  const out = new Float32Array(16);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}

function createMat3() {
  const out = new Float32Array(9);
  out[0] = 1;
  out[4] = 1;
  out[8] = 1;
  return out;
}

function normalizeVec3(out, a) {
  const x = a[0];
  const y = a[1];
  const z = a[2];
  const len = Math.hypot(x, y, z) || 1;
  out[0] = x / len;
  out[1] = y / len;
  out[2] = z / len;
  return out;
}

function identityMat4(out) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}

function rotateMat4(out, a, rad, axis) {
  let x = axis[0];
  let y = axis[1];
  let z = axis[2];
  let len = Math.hypot(x, y, z);
  if (len < 1e-6) return null;
  len = 1 / len;
  x *= len;
  y *= len;
  z *= len;

  const s = Math.sin(rad);
  const c = Math.cos(rad);
  const t = 1 - c;

  const b00 = x * x * t + c;
  const b01 = y * x * t + z * s;
  const b02 = z * x * t - y * s;
  const b10 = x * y * t - z * s;
  const b11 = y * y * t + c;
  const b12 = z * y * t + x * s;
  const b20 = x * z * t + y * s;
  const b21 = y * z * t - x * s;
  const b22 = z * z * t + c;

  const a00 = a[0],
    a01 = a[1],
    a02 = a[2],
    a03 = a[3];
  const a10 = a[4],
    a11 = a[5],
    a12 = a[6],
    a13 = a[7];
  const a20 = a[8],
    a21 = a[9],
    a22 = a[10],
    a23 = a[11];

  out[0] = a00 * b00 + a10 * b01 + a20 * b02;
  out[1] = a01 * b00 + a11 * b01 + a21 * b02;
  out[2] = a02 * b00 + a12 * b01 + a22 * b02;
  out[3] = a03 * b00 + a13 * b01 + a23 * b02;
  out[4] = a00 * b10 + a10 * b11 + a20 * b12;
  out[5] = a01 * b10 + a11 * b11 + a21 * b12;
  out[6] = a02 * b10 + a12 * b11 + a22 * b12;
  out[7] = a03 * b10 + a13 * b11 + a23 * b12;
  out[8] = a00 * b20 + a10 * b21 + a20 * b22;
  out[9] = a01 * b20 + a11 * b21 + a21 * b22;
  out[10] = a02 * b20 + a12 * b21 + a22 * b22;
  out[11] = a03 * b20 + a13 * b21 + a23 * b22;

  if (out !== a) {
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  }
  return out;
}

function lookAtMat4(out, eye, center, up) {
  let x0;
  let x1;
  let x2;
  let y0;
  let y1;
  let y2;
  let z0;
  let z1;
  let z2;

  z0 = eye[0] - center[0];
  z1 = eye[1] - center[1];
  z2 = eye[2] - center[2];

  let len = Math.hypot(z0, z1, z2);
  if (len === 0) {
    z2 = 1;
  } else {
    len = 1 / len;
    z0 *= len;
    z1 *= len;
    z2 *= len;
  }

  x0 = up[1] * z2 - up[2] * z1;
  x1 = up[2] * z0 - up[0] * z2;
  x2 = up[0] * z1 - up[1] * z0;
  len = Math.hypot(x0, x1, x2);
  if (len === 0) {
    x0 = 0;
    x1 = 0;
    x2 = 0;
  } else {
    len = 1 / len;
    x0 *= len;
    x1 *= len;
    x2 *= len;
  }

  y0 = z1 * x2 - z2 * x1;
  y1 = z2 * x0 - z0 * x2;
  y2 = z0 * x1 - z1 * x0;

  out[0] = x0;
  out[1] = y0;
  out[2] = z0;
  out[3] = 0;
  out[4] = x1;
  out[5] = y1;
  out[6] = z1;
  out[7] = 0;
  out[8] = x2;
  out[9] = y2;
  out[10] = z2;
  out[11] = 0;
  out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
  out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
  out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
  out[15] = 1;
  return out;
}

function perspectiveMat4(out, fovy, aspect, near, far) {
  const f = 1.0 / Math.tan(fovy / 2);
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[15] = 0;

  if (far != null && far !== Infinity) {
    const nf = 1 / (near - far);
    out[10] = (far + near) * nf;
    out[14] = 2 * far * near * nf;
  } else {
    out[10] = -1;
    out[14] = -2 * near;
  }
  return out;
}

function normalFromMat4(out, a) {
  const a00 = a[0],
    a01 = a[1],
    a02 = a[2];
  const a10 = a[4],
    a11 = a[5],
    a12 = a[6];
  const a20 = a[8],
    a21 = a[9],
    a22 = a[10];

  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;

  let det = a00 * b01 + a01 * b11 + a02 * b21;
  if (!det) return null;
  det = 1.0 / det;

  out[0] = b01 * det;
  out[1] = (-a22 * a01 + a02 * a21) * det;
  out[2] = (a12 * a01 - a02 * a11) * det;
  out[3] = b11 * det;
  out[4] = (a22 * a00 - a02 * a20) * det;
  out[5] = (-a12 * a00 + a02 * a10) * det;
  out[6] = b21 * det;
  out[7] = (-a21 * a00 + a01 * a20) * det;
  out[8] = (a11 * a00 - a01 * a10) * det;
  return out;
}

const vec3 = { create: () => new Float32Array(3), normalize: normalizeVec3 };
const mat4 = {
  create: createMat4,
  identity: identityMat4,
  rotate: rotateMat4,
  lookAt: lookAtMat4,
  perspective: perspectiveMat4,
};
const mat3 = { create: createMat3, normalFromMat4 };

// ────────────────────────────────────────────────────────────
// KONSTANTA FISIKA
// ────────────────────────────────────────────────────────────
const AXIS_TILT_DEG = 23.5; // kemiringan sumbu bumi
const AXIS_TILT_RAD = (AXIS_TILT_DEG * Math.PI) / 180;
const AUTO_ROTATE = 0.001; // rad/frame (rotasi harian)
const TWO_PI = Math.PI * 2;

// ────────────────────────────────────────────────────────────
// Arah Matahari — fixed di world space
// Diposisikan atas-kanan-depan agar siang/malam terlihat jelas
// ────────────────────────────────────────────────────────────
const SUN_DIR_RAW = [1.4, 0.6, 1.0];
export const LIGHT_DIR = vec3.normalize(vec3.create(), SUN_DIR_RAW);

// ────────────────────────────────────────────────────────────
// CLASS: EarthCamera
// ────────────────────────────────────────────────────────────
export class EarthCamera {
  constructor() {
    // ── Orbit state ─────────────────────────────────────────
    this.theta = 0.4; // azimuth (rad)
    this.phi = 1.25; // polar / elevation (rad)  0=kutub atas, π=kutub bawah
    this.radius = 2.45; // jarak kamera ke pusat bola

    // Batas zoom
    this.minRadius = 1.3;
    this.maxRadius = 6.5;

    // ── Drag state ──────────────────────────────────────────
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;

    // Inertia / momentum drag
    this.velTheta = 0;
    this.velPhi = 0;
    this.friction = 0.88; // redaman kecepatan (0=berhenti seketika, 1=tidak berhenti)
    this.manualSpin = 0;

    // ── Matriks output ──────────────────────────────────────
    this.model = mat4.create();
    this.view = mat4.create();
    this.projection = mat4.create();
    this.normalMat = mat3.create();

    // Counter frame internal untuk rotasi otomatis
    this._frame = 0;
  }

  // ──────────────────────────────────────────────────────────
  // buildModel  — rotasi bumi + kemiringan sumbu 23.5°
  // dipanggil tiap frame dari main loop
  // ──────────────────────────────────────────────────────────
  buildModel() {
    mat4.identity(this.model);

    // 1. Terapkan kemiringan sumbu pada sumbu Z
    mat4.rotate(this.model, this.model, AXIS_TILT_RAD, [0, 0, 1]);

    // 2. Rotasi siang/malam kontinu pada sumbu Y (setelah tilt)
    mat4.rotate(this.model, this.model, this._frame * AUTO_ROTATE, [0, 1, 0]);
    mat4.rotate(this.model, this.model, this.manualSpin, [0, 1, 0]);

    // Normal matrix = transpose(inverse(mat3 dari model))
    mat3.normalFromMat4(this.normalMat, this.model);

    this._frame++;
    return (this._frame * AUTO_ROTATE * (180 / Math.PI)) % 360; // derajat rotasi (untuk UI)
  }

  // ──────────────────────────────────────────────────────────
  // buildView  — posisi kamera dari koordinat spherical
  // ──────────────────────────────────────────────────────────
  buildView() {
    // Terapkan inertia
    if (!this.isDragging) {
      this.theta += this.velTheta;
      this.phi += this.velPhi;
      this.theta = ((this.theta % TWO_PI) + TWO_PI) % TWO_PI;
      // clamp phi to avoid gimbal flip at poles (keep within (eps, PI - eps))
      const EPS = 0.001;
      this.phi = Math.max(EPS, Math.min(Math.PI - EPS, this.phi));
      this.velTheta *= this.friction;
      this.velPhi *= this.friction;
    }

    // Koordinat Cartesian dari spherical
    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    const eye = [
      this.radius * sinPhi * Math.cos(this.theta),
      this.radius * cosPhi,
      this.radius * sinPhi * Math.sin(this.theta),
    ];

    mat4.lookAt(this.view, eye, [0, 0, 0], [0, 1, 0]);
  }

  // ──────────────────────────────────────────────────────────
  // buildProjection  — perspektif FOV 45°
  // ──────────────────────────────────────────────────────────
  buildProjection(aspect) {
    mat4.perspective(this.projection, (45 * Math.PI) / 180, aspect, 0.05, 50.0);
  }

  // ──────────────────────────────────────────────────────────
  // Input handlers — Mouse
  // ──────────────────────────────────────────────────────────
  onMouseDown(e) {
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.velTheta = 0;
    this.velPhi = 0;
  }

  onMouseMove(e) {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;

    // Sensitivitas drag — lebih halus saat zoom in
    const sens = 0.004 * (this.radius / 2.8);

    this.velTheta = -dx * sens;
    this.velPhi = -dy * sens;
    this.theta += this.velTheta;
    this.phi += this.velPhi;
    this.theta = ((this.theta % TWO_PI) + TWO_PI) % TWO_PI;
    // clamp phi to avoid instant flip when dragging past the poles
    const EPS = 0.001;
    this.phi = Math.max(EPS, Math.min(Math.PI - EPS, this.phi));

    this.manualSpin += -dx * sens * 1.2;

    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  onMouseUp() {
    this.isDragging = false;
  }

  // ──────────────────────────────────────────────────────────
  // Input handlers — Scroll (zoom)
  // ──────────────────────────────────────────────────────────
  onWheel(e) {
    const delta = e.deltaY * 0.004;
    this.radius = Math.max(
      this.minRadius,
      Math.min(this.maxRadius, this.radius + delta)
    );
  }

  // ──────────────────────────────────────────────────────────
  // Input handlers — Touch
  // ──────────────────────────────────────────────────────────
  onTouchStart(e) {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      this.onMouseDown({ clientX: t.clientX, clientY: t.clientY });
    }
    this._pinchDist0 = this._getPinchDist(e);
    this._radius0 = this.radius;
  }

  onTouchMove(e) {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      this.onMouseMove({ clientX: t.clientX, clientY: t.clientY });
    } else if (e.touches.length === 2) {
      // Pinch-to-zoom
      const dist = this._getPinchDist(e);
      const scale = this._pinchDist0 / dist;
      this.radius = Math.max(
        this.minRadius,
        Math.min(this.maxRadius, this._radius0 * scale)
      );
    }
  }

  onTouchEnd() {
    this.isDragging = false;
  }

  _getPinchDist(e) {
    if (e.touches.length < 2) return 1;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
