// ============================================================
// mesh.js — Procedural sphere & star-field mesh builder
// ============================================================

const Mesh = (() => {

  // ── Sphere ────────────────────────────────────────────────
  // Returns { positions, normals, texCoords, indices }
  function sphere(stacks, slices) {
    const pos = [], nor = [], uv = [], idx = [];

    for (let i = 0; i <= stacks; i++) {
      const phi   = Math.PI * i / stacks;          // 0 … π
      const sinP  = Math.sin(phi);
      const cosP  = Math.cos(phi);

      for (let j = 0; j <= slices; j++) {
        const theta = 2 * Math.PI * j / slices;   // 0 … 2π
        const sinT  = Math.sin(theta);
        const cosT  = Math.cos(theta);

        const x = sinP * cosT;
        const y = cosP;
        const z = sinP * sinT;

        pos.push(x, y, z);
        nor.push(x, y, z);
        uv.push(j / slices, i / stacks);
      }
    }

    for (let i = 0; i < stacks; i++) {
      for (let j = 0; j < slices; j++) {
        const a = i * (slices + 1) + j;
        const b = a + slices + 1;
        idx.push(a, b, a + 1);
        idx.push(b, b + 1, a + 1);
      }
    }

    return {
      positions : new Float32Array(pos),
      normals   : new Float32Array(nor),
      texCoords : new Float32Array(uv),
      indices   : new Uint16Array(idx),
    };
  }

  // ── Star-field ────────────────────────────────────────────
  // Stars live on a large sphere so they rotate with the scene.
  function stars(count, radius) {
    const pos  = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const bri  = new Float32Array(count);

    // Simple LCG for deterministic star placement
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0xffffffff;
    };

    for (let i = 0; i < count; i++) {
      // Uniform sphere distribution
      const u     = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const r     = Math.sqrt(1 - u * u);

      pos[i*3]   = r * Math.cos(theta) * radius;
      pos[i*3+1] = u * radius;
      pos[i*3+2] = r * Math.sin(theta) * radius;

      const b    = 0.3 + rand() * 0.7;
      bri[i]     = b;
      size[i]    = 1.0 + b * 2.5;
    }

    return { positions: pos, sizes: size, brightness: bri };
  }

  // ── Upload to GPU ─────────────────────────────────────────
  function upload(gl, data, isIndex) {
    const target = isIndex ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
    const buf    = gl.createBuffer();
    gl.bindBuffer(target, buf);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    return buf;
  }

  function buildSphere(gl, stacks, slices) {
    const d = sphere(stacks, slices);
    return {
      position : upload(gl, d.positions),
      normal   : upload(gl, d.normals),
      texCoord : upload(gl, d.texCoords),
      index    : upload(gl, d.indices, true),
      count    : d.indices.length,
      raw      : d,
    };
  }

  function buildStars(gl, count, radius) {
    const d = stars(count, radius);
    return {
      position   : upload(gl, d.positions),
      size       : upload(gl, d.sizes),
      brightness : upload(gl, d.brightness),
      count,
    };
  }

  return { buildSphere, buildStars };
})();