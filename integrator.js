/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  MODUL 4 — SYSTEM INTEGRATOR                            ║
 * ║  WebGL 2.0 boilerplate, VAO/VBO, RequestAnimationFrame  ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Tanggung jawab:
 *  1. Setup <canvas> dan inisialisasi WebGL 2.0 context
 *  2. Compile shader & link program (dari Modul 2)
 *  3. Upload data buffer dari Modul 1 ke GPU (VBO / VAO)
 *  4. Main loop RAF — render + hubungkan input dari Modul 3
 *
 * Entry point: initApp()
 */

import {
  generateUVSphere,
  generateEarthTexture,
  generateCloudTexture,
} from "./mesh.js";
import { VS_SOURCE, FS_SOURCE } from "./shaders.js";
import { EarthCamera, LIGHT_DIR } from "./camera.js";

// ────────────────────────────────────────────────────────────
// 1. WebGL Context
// ────────────────────────────────────────────────────────────
function initGL(canvas) {
  const gl = canvas.getContext("webgl2", {
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error("WebGL 2 tidak tersedia di browser ini.");
  return gl;
}

// ────────────────────────────────────────────────────────────
// 2. Compile shader & link program
// ────────────────────────────────────────────────────────────
function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error:\n${info}`);
  }
  return shader;
}

function linkProgram(gl, vsSrc, fsSrc) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Program link error:\n${info}`);
  }
  // Shader sudah di-link, tidak diperlukan lagi
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

// ────────────────────────────────────────────────────────────
// 3. Upload buffer ke GPU (VBO / VAO)
// ────────────────────────────────────────────────────────────
function uploadMesh(gl, program, meshData) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  function bindAttribute(data, name, size) {
    const loc = gl.getAttribLocation(program, name);
    if (loc < 0) {
      console.warn(`Attribute "${name}" tidak ditemukan.`);
      return;
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    return buf;
  }

  bindAttribute(meshData.positions, "aPosition", 3);
  bindAttribute(meshData.normals, "aNormal", 3);
  bindAttribute(meshData.uvs, "aUV", 2);

  // Index Buffer Object (IBO)
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshData.indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);

  return { vao, ibo, indexCount: meshData.indexCount };
}

// ────────────────────────────────────────────────────────────
// Helper — cache semua uniform location sekaligus
// ────────────────────────────────────────────────────────────
function getUniforms(gl, program, names) {
  const locs = {};
  names.forEach((n) => {
    locs[n] = gl.getUniformLocation(program, n);
  });
  return locs;
}

function multiplyMat4(out, a, b) {
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
  const a30 = a[12],
    a31 = a[13],
    a32 = a[14],
    a33 = a[15];

  let b0 = b[0],
    b1 = b[1],
    b2 = b[2],
    b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[4];
  b1 = b[5];
  b2 = b[6];
  b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[8];
  b1 = b[9];
  b2 = b[10];
  b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

  b0 = b[12];
  b1 = b[13];
  b2 = b[14];
  b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}

function transformPoint(mat, point) {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const w = 1;
  return [
    mat[0] * x + mat[4] * y + mat[8] * z + mat[12] * w,
    mat[1] * x + mat[5] * y + mat[9] * z + mat[13] * w,
    mat[2] * x + mat[6] * y + mat[10] * z + mat[14] * w,
    mat[3] * x + mat[7] * y + mat[11] * z + mat[15] * w,
  ];
}

function createTexture(gl, imageSource) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    imageSource
  );
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

// ────────────────────────────────────────────────────────────
// 4. MAIN ENTRY POINT
// ────────────────────────────────────────────────────────────
export function initApp({ canvasId = "c", uiFps, uiRot } = {}) {
  // ── Canvas & GL ───────────────────────────────────────────
  const canvas = document.getElementById(canvasId);
  const overlayCanvas = document.getElementById("overlay");
  const overlayCtx = overlayCanvas ? overlayCanvas.getContext("2d") : null;
  const toggleSunBtn = document.getElementById("toggleSun");
  const toggleAxisBtn = document.getElementById("toggleAxis");
  const toggleCloudBtn = document.getElementById("toggleCloud");
  const gl = initGL(canvas);

  // ── Shader program ────────────────────────────────────────
  const program = linkProgram(gl, VS_SOURCE, FS_SOURCE);
  const uniforms = getUniforms(gl, program, [
    "uModel",
    "uView",
    "uProjection",
    "uNormalMatrix",
    "uLightDir",
    "uTime",
    "uEarthTexture",
    "uCloudTexture",
    "uCloudEnabled",
  ]);

  // ── Mesh dari Modul 1 ─────────────────────────────────────
  const meshData = generateUVSphere(64, 64);
  const gpu = uploadMesh(gl, program, meshData);
  const earthTexture = createTexture(gl, generateEarthTexture(1024));
  const cloudTexture = createTexture(gl, generateCloudTexture(1024));

  // ── Kamera dari Modul 3 ───────────────────────────────────
  const camera = new EarthCamera();

  const overlayState = {
    showSun: true,
    showAxis: true,
    showCloud: true,
  };

  let cloudMix = 1.0;

  const syncToggleButton = (button, active) => {
    if (!button) return;
    button.classList.toggle("is-active", active);
  };

  syncToggleButton(toggleSunBtn, overlayState.showSun);
  syncToggleButton(toggleAxisBtn, overlayState.showAxis);
  syncToggleButton(toggleCloudBtn, overlayState.showCloud);

  if (toggleSunBtn) {
    toggleSunBtn.addEventListener("click", () => {
      overlayState.showSun = !overlayState.showSun;
      syncToggleButton(toggleSunBtn, overlayState.showSun);
    });
  }

  if (toggleAxisBtn) {
    toggleAxisBtn.addEventListener("click", () => {
      overlayState.showAxis = !overlayState.showAxis;
      syncToggleButton(toggleAxisBtn, overlayState.showAxis);
    });
  }

  if (toggleCloudBtn) {
    toggleCloudBtn.addEventListener("click", () => {
      overlayState.showCloud = !overlayState.showCloud;
      syncToggleButton(toggleCloudBtn, overlayState.showCloud);
      cloudMix = overlayState.showCloud ? 1.0 : 0.0;
    });
  }

  // ── GL global state ───────────────────────────────────────
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  // ── Resize handler ────────────────────────────────────────
  const onResize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (overlayCanvas) {
      overlayCanvas.width = canvas.width;
      overlayCanvas.height = canvas.height;
      overlayCanvas.style.width = canvas.style.width;
      overlayCanvas.style.height = canvas.style.height;
    }
    camera.buildProjection(canvas.width / canvas.height);
  };
  window.addEventListener("resize", onResize);
  onResize();

  // ── Input events — delegasi ke Modul 3 ───────────────────
  canvas.addEventListener("mousedown", (e) => camera.onMouseDown(e));
  window.addEventListener("mousemove", (e) => camera.onMouseMove(e));
  window.addEventListener("mouseup", () => camera.onMouseUp());
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      camera.onWheel(e);
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      camera.onTouchStart(e);
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      camera.onTouchMove(e);
    },
    { passive: false }
  );
  canvas.addEventListener("touchend", () => camera.onTouchEnd());

  // Cursor visual feedback
  canvas.style.cursor = "grab";
  canvas.addEventListener("mousedown", () => {
    canvas.style.cursor = "grabbing";
  });
  window.addEventListener("mouseup", () => {
    canvas.style.cursor = "grab";
  });

  // ── FPS counter state ─────────────────────────────────────
  let lastFpsTime = performance.now();
  let fpsCount = 0;

  // ── RAF — Main Render Loop ────────────────────────────────
  function render(time) {
    requestAnimationFrame(render);

    // FPS
    fpsCount++;
    if (time - lastFpsTime >= 1000) {
      if (uiFps) uiFps.textContent = fpsCount;
      fpsCount = 0;
      lastFpsTime = time;
    }

    // Clear
    gl.clearColor(0.0, 0.0, 0.01, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Matriks (Modul 3)
    const rotDeg = camera.buildModel();
    camera.buildView();
    if (uiRot) uiRot.textContent = rotDeg.toFixed(1) + "°";

    // Shader & VAO
    gl.useProgram(program);
    gl.bindVertexArray(gpu.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, earthTexture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, cloudTexture);

    // Upload uniforms
    gl.uniformMatrix4fv(uniforms.uModel, false, camera.model);
    gl.uniformMatrix4fv(uniforms.uView, false, camera.view);
    gl.uniformMatrix4fv(uniforms.uProjection, false, camera.projection);
    gl.uniformMatrix3fv(uniforms.uNormalMatrix, false, camera.normalMat);
    gl.uniform3fv(uniforms.uLightDir, LIGHT_DIR);
    gl.uniform1f(uniforms.uTime, time);
    gl.uniform1i(uniforms.uEarthTexture, 0);
    gl.uniform1i(uniforms.uCloudTexture, 1);
    gl.uniform1f(uniforms.uCloudEnabled, cloudMix);

    // Draw call (Modul 1 index buffer)
    gl.drawElements(gl.TRIANGLES, gpu.indexCount, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null);

    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      overlayCtx.save();
      overlayCtx.lineWidth = Math.max(1, canvas.width / 900);
      overlayCtx.font = `${Math.max(
        12,
        canvas.width / 110
      )}px Poppins, sans-serif`;
      overlayCtx.textBaseline = "middle";

      const mvp = new Float32Array(16);
      const viewModel = new Float32Array(16);
      multiplyMat4(viewModel, camera.view, camera.model);
      multiplyMat4(mvp, camera.projection, viewModel);

      const project = (point) => {
        const clip = transformPoint(mvp, point);
        if (Math.abs(clip[3]) < 1e-5) return null;
        const ndcX = clip[0] / clip[3];
        const ndcY = clip[1] / clip[3];
        return {
          x: (ndcX * 0.5 + 0.5) * overlayCanvas.width,
          y: (1 - (ndcY * 0.5 + 0.5)) * overlayCanvas.height,
        };
      };

      const drawArrowLabel = (start, end, label, accent, align = "left") => {
        const a = project(start);
        const b = project(end);
        if (!a || !b) return;

        overlayCtx.strokeStyle = accent;
        overlayCtx.fillStyle = accent;
        overlayCtx.beginPath();
        overlayCtx.moveTo(a.x, a.y);
        overlayCtx.lineTo(b.x, b.y);
        overlayCtx.stroke();

        overlayCtx.beginPath();
        overlayCtx.arc(
          b.x,
          b.y,
          Math.max(2, overlayCtx.lineWidth * 1.8),
          0,
          Math.PI * 2
        );
        overlayCtx.fill();

        const tx = b.x + (align === "left" ? 12 : -12);
        const ty = b.y - 12;
        overlayCtx.textAlign = align;
        overlayCtx.fillText(label, tx, ty);
      };

      if (overlayState.showSun) {
        drawArrowLabel(
          [0, 0, 0],
          [LIGHT_DIR[0] * 1.7, LIGHT_DIR[1] * 1.7, LIGHT_DIR[2] * 1.7],
          "Arah Matahari",
          "rgba(255, 208, 125, 0.95)"
        );
      }
      if (overlayState.showAxis) {
        drawArrowLabel(
          [0, -1.2, 0],
          [0, 1.2, 0],
          "Sumbu Rotasi",
          "rgba(125, 215, 255, 0.95)",
          "right"
        );
      }

      overlayCtx.restore();
    }
  }

  requestAnimationFrame(render);
}
