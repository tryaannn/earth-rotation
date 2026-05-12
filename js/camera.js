// ============================================================
// camera.js — Arcball / orbit camera with drag & scroll zoom
// ============================================================

const Camera = (() => {
  // ── Mat4 helpers (column-major) ───────────────────────────
  // Allocates a 4x4 matrix (column-major).
  function mat4() {
    return new Float32Array(16);
  }

  function identity(m) {
    m.fill(0);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  }

  function perspective(m, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy * 0.5);
    const nf = 1.0 / (near - far);
    identity(m);
    m[0] = f / aspect;
    m[5] = f;
    m[10] = (far + near) * nf;
    m[11] = -1;
    m[14] = 2 * far * near * nf;
    m[15] = 0;
    return m;
  }

  // Builds a view matrix from eye/center/up (right-handed).
  function lookAt(m, eye, center, up) {
    const zx = eye[0] - center[0],
      zy = eye[1] - center[1],
      zz = eye[2] - center[2];
    let zl = Math.sqrt(zx * zx + zy * zy + zz * zz);
    if (zl < 1e-8) {
      identity(m);
      return m;
    }
    const zinvL = 1 / zl;
    const Zx = zx * zinvL,
      Zy = zy * zinvL,
      Zz = zz * zinvL;

    const Xx = up[1] * Zz - up[2] * Zy;
    const Xy = up[2] * Zx - up[0] * Zz;
    const Xz = up[0] * Zy - up[1] * Zx;
    let xl = Math.sqrt(Xx * Xx + Xy * Xy + Xz * Xz);
    if (xl < 1e-8) xl = 1;
    const xinvL = 1 / xl;
    const XXx = Xx * xinvL,
      XXy = Xy * xinvL,
      XXz = Xz * xinvL;

    const Yx = Zy * XXz - Zz * XXy;
    const Yy = Zz * XXx - Zx * XXz;
    const Yz = Zx * XXy - Zy * XXx;

    m[0] = XXx;
    m[1] = Yx;
    m[2] = Zx;
    m[3] = 0;
    m[4] = XXy;
    m[5] = Yy;
    m[6] = Zy;
    m[7] = 0;
    m[8] = XXz;
    m[9] = Yz;
    m[10] = Zz;
    m[11] = 0;
    m[12] = -(XXx * eye[0] + XXy * eye[1] + XXz * eye[2]);
    m[13] = -(Yx * eye[0] + Yy * eye[1] + Yz * eye[2]);
    m[14] = -(Zx * eye[0] + Zy * eye[1] + Zz * eye[2]);
    m[15] = 1;
    return m;
  }

  // Multiplies two 4x4 matrices: out = a * b.
  function multiply(out, a, b) {
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[i + k * 4] * b[k + j * 4];
        out[i + j * 4] = s;
      }
    return out;
  }

  // Scale & translate helpers (used by model assembly)
  function scale(m, sx, sy, sz) {
    const r = identity(mat4());
    r[0] = sx;
    r[5] = sy;
    r[10] = sz;
    return multiply(mat4(), m, r);
  }

  function translateX(m, tx) {
    const r = identity(mat4());
    r[12] = tx;
    return multiply(mat4(), m, r);
  }

  // Normal matrix (upper-left 3x3 inverse-transpose of model)
  function normalMatrix(model) {
    // For uniform-scale spheres this equals upper-left 3×3 of model
    return new Float32Array([
      model[0],
      model[1],
      model[2],
      model[4],
      model[5],
      model[6],
      model[8],
      model[9],
      model[10],
    ]);
  }

  // ── Quaternion helpers ────────────────────────────────────
  // Quaternion helpers for arcball rotation.
  function quat(x = 0, y = 0, z = 0, w = 1) {
    return new Float32Array([x, y, z, w]);
  }

  function qMultiply(a, b) {
    const ax = a[0],
      ay = a[1],
      az = a[2],
      aw = a[3];
    const bx = b[0],
      by = b[1],
      bz = b[2],
      bw = b[3];
    return new Float32Array([
      aw * bx + ax * bw + ay * bz - az * by,
      aw * by - ax * bz + ay * bw + az * bx,
      aw * bz + ax * by - ay * bx + az * bw,
      aw * bw - ax * bx - ay * by - az * bz,
    ]);
  }

  function qToMatrix(q) {
    const x = q[0],
      y = q[1],
      z = q[2],
      w = q[3];
    const x2 = x + x,
      y2 = y + y,
      z2 = z + z;
    const xx = x * x2,
      xy = x * y2,
      xz = x * z2;
    const yy = y * y2,
      yz = y * z2,
      zz = z * z2;
    const wx = w * x2,
      wy = w * y2,
      wz = w * z2;
    const m = mat4();
    m[0] = 1 - (yy + zz);
    m[1] = xy + wz;
    m[2] = xz - wy;
    m[3] = 0;
    m[4] = xy - wz;
    m[5] = 1 - (xx + zz);
    m[6] = yz + wx;
    m[7] = 0;
    m[8] = xz + wy;
    m[9] = yz - wx;
    m[10] = 1 - (xx + yy);
    m[11] = 0;
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;
    return m;
  }

  function axisAngleQuat(ax, ay, az, angle) {
    const s = Math.sin(angle / 2);
    const l = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
    return quat((ax / l) * s, (ay / l) * s, (az / l) * s, Math.cos(angle / 2));
  }

  // ── Camera object ─────────────────────────────────────────
  function create(canvas) {
    let dist = 3.5;
    let rotQuat = quat(); // arcball orientation
    let dragging = false;
    let lastX = 0,
      lastY = 0;
    let velX = 0,
      velY = 0; // inertia

    // Mouse drag -> arcball rotation
    canvas.addEventListener("mousedown", (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      velX = velY = 0;
    });
    window.addEventListener("mouseup", () => {
      dragging = false;
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      velX = dx;
      velY = dy;
      const speed = 0.005;
      const qY = axisAngleQuat(0, 1, 0, dx * speed);
      const qX = axisAngleQuat(1, 0, 0, dy * speed);
      rotQuat = qMultiply(qMultiply(qY, qX), rotQuat);
      lastX = e.clientX;
      lastY = e.clientY;
    });

    // Touch support: one finger rotates, two fingers zoom.
    let lastTouchDist = 0;
    canvas.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          dragging = true;
          lastX = e.touches[0].clientX;
          lastY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          lastTouchDist = Math.sqrt(dx * dx + dy * dy);
        }
      },
      { passive: true }
    );
    canvas.addEventListener(
      "touchend",
      () => {
        dragging = false;
      },
      { passive: true }
    );
    canvas.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 1 && dragging) {
          const dx = e.touches[0].clientX - lastX;
          const dy = e.touches[0].clientY - lastY;
          const speed = 0.005;
          rotQuat = qMultiply(
            qMultiply(
              axisAngleQuat(0, 1, 0, dx * speed),
              axisAngleQuat(1, 0, 0, dy * speed)
            ),
            rotQuat
          );
          lastX = e.touches[0].clientX;
          lastY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const d = Math.sqrt(dx * dx + dy * dy);
          dist = Math.max(1.6, Math.min(10, dist * (lastTouchDist / d)));
          lastTouchDist = d;
        }
      },
      { passive: true }
    );

    // Scroll zoom
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        dist = Math.max(1.6, Math.min(10, dist + e.deltaY * 0.005));
      },
      { passive: false }
    );

    // Applies inertia when not dragging.
    function update() {
      if (!dragging) {
        // inertia
        if (Math.abs(velX) > 0.1 || Math.abs(velY) > 0.1) {
          const speed = 0.004;
          rotQuat = qMultiply(
            qMultiply(
              axisAngleQuat(0, 1, 0, velX * speed),
              axisAngleQuat(1, 0, 0, velY * speed)
            ),
            rotQuat
          );
          velX *= 0.88;
          velY *= 0.88;
        }
      }
    }

    // Camera view matrix from current arcball rotation.
    function getViewMatrix() {
      const rm = qToMatrix(rotQuat);
      const eye = [rm[2] * dist, rm[6] * dist, rm[10] * dist];
      return lookAt(mat4(), eye, [0, 0, 0], [0, 1, 0]);
    }

    // Perspective projection with fixed FOV.
    function getProjectionMatrix(aspect) {
      return perspective(mat4(), Math.PI / 4, aspect, 0.1, 500);
    }

    // Eye position in world space (for specular and atmosphere).
    function getEyePosition() {
      const rm = qToMatrix(rotQuat);
      return [rm[2] * dist, rm[6] * dist, rm[10] * dist];
    }

    // Raw rotation matrix for any auxiliary transforms.
    function getRotMatrix() {
      return qToMatrix(rotQuat);
    }

    return {
      update,
      getViewMatrix,
      getProjectionMatrix,
      getEyePosition,
      getRotMatrix,
      mat4,
      identity,
      multiply,
      scale,
      normalMatrix,
    };
  }

  return { create, mat4, identity, multiply, scale, normalMatrix };
})();
