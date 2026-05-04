// ============================================================
// integrator.js — Render loop, state, draw calls, UI wiring
// ============================================================

const Integrator = (() => {
  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(edge0, edge1, value) {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  }

  function hash2(x, y, seed) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function noise2(x, y, seed) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const a = hash2(xi, yi, seed);
    const b = hash2(xi + 1, yi, seed);
    const c = hash2(xi, yi + 1, seed);
    const d = hash2(xi + 1, yi + 1, seed);

    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }

  function fbm2(x, y, seed) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1.0;

    for (let i = 0; i < 4; i++) {
      value +=
        amplitude * noise2(x * frequency, y * frequency, seed + i * 17.13);
      frequency *= 2.03;
      amplitude *= 0.5;
    }

    return value;
  }

  function wrapDelta(value, center) {
    let delta = Math.abs(value - center);
    return Math.min(delta, 1 - delta);
  }

  function continentField(u, v) {
    let score = 0;

    function blob(cx, cy, rx, ry, weight, stretchX, stretchY) {
      const dx = wrapDelta(u, cx) / rx;
      const dy = (v - cy) / ry;
      const warpX = Math.sin(v * 12 + cy * 7.5 + weight) * stretchX;
      const warpY = Math.cos(u * 10 + cx * 8.0 - weight) * stretchY;
      const x = dx + warpX;
      const y = dy + warpY;
      return weight * Math.exp(-(x * x * 1.4 + y * y * 1.05));
    }

    // Major continents (refined positioning)
    score += blob(0.15, 0.32, 0.14, 0.18, 1.3, 0.05, 0.03); // North America - larger, more detailed
    score += blob(0.23, 0.62, 0.09, 0.25, 1.15, 0.04, 0.02); // South America - elongated
    score += blob(0.48, 0.28, 0.09, 0.12, 0.95, 0.03, 0.02); // Europe - refined
    score += blob(0.5, 0.55, 0.13, 0.28, 1.35, 0.04, 0.04); // Africa - larger, more tapered
    score += blob(0.72, 0.26, 0.22, 0.18, 1.4, 0.05, 0.03); // Asia - largest landmass
    score += blob(0.85, 0.72, 0.08, 0.08, 0.85, 0.02, 0.02); // Australia

    // Major islands and archipelagos
    score += blob(0.31, 0.12, 0.06, 0.06, 0.7, 0.01, 0.01); // Greenland - refined
    score += blob(0.38, 0.25, 0.04, 0.05, 0.5, 0.01, 0.01); // British Isles
    score += blob(0.45, 0.22, 0.03, 0.04, 0.4, 0.01, 0.01); // Iceland
    score += blob(0.55, 0.18, 0.04, 0.03, 0.45, 0.01, 0.01); // Mediterranean region
    score += blob(0.7, 0.32, 0.05, 0.04, 0.6, 0.01, 0.01); // Japan region
    score += blob(0.76, 0.42, 0.06, 0.06, 0.65, 0.02, 0.01); // Philippines & SE Asia
    score += blob(0.8, 0.48, 0.04, 0.04, 0.55, 0.01, 0.01); // Indonesia
    score += blob(0.88, 0.75, 0.04, 0.04, 0.5, 0.01, 0.01); // New Zealand
    score += blob(0.6, 0.5, 0.05, 0.08, 0.5, 0.02, 0.01); // Madagascar region

    // Minor islands and archipelagos
    score += blob(0.13, 0.45, 0.03, 0.03, 0.35, 0.01, 0.01); // Caribbean
    score += blob(0.26, 0.48, 0.03, 0.03, 0.3, 0.01, 0.01); // West Africa islands
    score += blob(0.92, 0.3, 0.03, 0.02, 0.35, 0.01, 0.01); // Micronesia
    score += blob(0.95, 0.5, 0.02, 0.03, 0.3, 0.01, 0.01); // Melanesia

    // Multi-scale noise for coastline complexity and inland features
    score += 0.32 * fbm2(u * 5.5, v * 3.5, 11.0); // Large landform features
    score += 0.18 * fbm2(u * 14.0, v * 9.0, 19.0); // Medium coastline detail
    score += 0.08 * fbm2(u * 32.0, v * 22.0, 29.0) - 0.03; // Fine coastal fractal

    // Polar regions - ice sheets
    if (v > 0.94) {
      score += (v - 0.94) * 4.8;
    }
    if (v < 0.06) {
      score += (0.06 - v) * 4.8;
    }

    return smoothstep(0.8, 1.2, score);
  }

  function generateEarthTextureCanvas() {
    const width = 1024;
    const height = 512;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    const image = context.createImageData(width, height);
    const data = image.data;

    for (let y = 0; y < height; y++) {
      const v = y / (height - 1);
      const latNorm = Math.abs(v - 0.5) * 2;
      const polar = smoothstep(0.84, 1.0, latNorm);
      const polarCap = smoothstep(0.76, 0.98, latNorm);

      for (let x = 0; x < width; x++) {
        const u = x / (width - 1);
        const warpedU = (u + (fbm2(u * 10, v * 6, 2.0) - 0.5) * 0.018 + 1) % 1;
        const warpedV = clamp01(v + (fbm2(u * 8, v * 5, 7.0) - 0.5) * 0.012);

        const land = continentField(warpedU, warpedV);

        // Enhanced ocean floor topology with continental shelf
        const oceanDepthBase = fbm2(u * 8.0, v * 4.0, 5.0);
        const oceanDepthDetail = fbm2(u * 22.0, v * 14.0, 15.0);
        const continentalShelf = fbm2(u * 12.0, v * 6.0, 8.0);
        const depth =
          oceanDepthBase * 0.6 +
          oceanDepthDetail * 0.25 +
          continentalShelf * 0.15;

        const coast = smoothstep(0.18, 0.52, Math.abs(land - 0.5));
        const moisture = fbm2(u * 12.0, v * 7.0, 13.0);

        // Enhanced terrain height with more realistic mountain ranges
        const heightBase = fbm2(u * 15.0, v * 9.0, 23.0);
        const heightDetail = fbm2(u * 38.0, v * 24.0, 27.0);
        const heightField = heightBase * 0.7 + heightDetail * 0.3;

        let r;
        let g;
        let b;

        const oceanMix = smoothstep(0.1, 0.9, depth);
        const deepOcean = [4, 22, 72];
        const midOcean = [8, 64, 148];
        const shelfOcean = [12, 108, 196];
        const brightOcean = [18, 164, 228];

        if (land < 0.5) {
          const coastTint = coast * 0.42;
          const tropical = 1.0 - smoothstep(0.18, 0.5, latNorm);
          const oceanLift = 0.2 + tropical * 0.22;

          // Better continental shelf representation
          const shelfDepth = smoothstep(0.35, 0.65, depth);
          const oceanColor = [
            lerp(
              lerp(deepOcean[0], midOcean[0], oceanMix),
              shelfOcean[0],
              shelfDepth * 0.4
            ),
            lerp(
              lerp(deepOcean[1], midOcean[1], oceanMix),
              shelfOcean[1],
              shelfDepth * 0.4
            ),
            lerp(
              lerp(deepOcean[2], midOcean[2], oceanMix),
              shelfOcean[2],
              shelfDepth * 0.4
            ),
          ];
          r = oceanColor[0] / 255;
          g = oceanColor[1] / 255;
          b = oceanColor[2] / 255;
          r = lerp(
            r,
            brightOcean[0] / 255,
            coastTint * 0.45 + oceanLift * 0.06
          );
          g = lerp(
            g,
            brightOcean[1] / 255,
            coastTint * 0.62 + oceanLift * 0.28
          );
          b = lerp(
            b,
            brightOcean[2] / 255,
            coastTint * 0.68 + oceanLift * 0.38
          );
        } else {
          const tropical = 1.0 - smoothstep(0.14, 0.45, latNorm);
          const temperate = 1.0 - smoothstep(0.38, 0.72, latNorm);
          const dry =
            smoothstep(0.22, 0.58, latNorm) *
            (1.0 - smoothstep(0.42, 0.82, moisture));

          // More realistic terrain height distribution
          const ridges = smoothstep(0.44, 0.82, heightField);
          const mountains = smoothstep(0.6, 0.92, heightField);
          const peaks = smoothstep(0.78, 0.98, heightField);
          const highSnow = smoothstep(0.82, 0.99, heightField);

          const rainforest = [18, 110, 36];
          const greenLow = [36, 134, 52];
          const greenMid = [80, 144, 58];
          const grassland = [126, 140, 62];
          const yellowPlain = [172, 158, 76];
          const ochre = [152, 130, 70];
          const darkRock = [108, 98, 90];
          const rock = [128, 116, 108];
          const snowWhite = [240, 244, 248];

          const greenBand = [
            lerp(rainforest[0], greenLow[0], temperate * 0.5),
            lerp(rainforest[1], greenLow[1], temperate * 0.5),
            lerp(rainforest[2], greenLow[2], temperate * 0.5),
          ];
          const grassBand = [
            lerp(greenBand[0], grassland[0], temperate * 0.4),
            lerp(greenBand[1], grassland[1], temperate * 0.4),
            lerp(greenBand[2], grassland[2], temperate * 0.4),
          ];
          const yellowBand = [
            lerp(grassBand[0], yellowPlain[0], dry * 0.85),
            lerp(grassBand[1], yellowPlain[1], dry * 0.85),
            lerp(grassBand[2], yellowPlain[2], dry * 0.85),
          ];
          const ridgeBand = [
            lerp(yellowBand[0], ochre[0], ridges * 0.65),
            lerp(yellowBand[1], ochre[1], ridges * 0.65),
            lerp(yellowBand[2], ochre[2], ridges * 0.65),
          ];
          const mountainBand = [
            lerp(ridgeBand[0], darkRock[0], mountains * 0.58),
            lerp(ridgeBand[1], darkRock[1], mountains * 0.58),
            lerp(ridgeBand[2], darkRock[2], mountains * 0.58),
          ];
          const peakBand = [
            lerp(mountainBand[0], rock[0], peaks * 0.48),
            lerp(mountainBand[1], rock[1], peaks * 0.48),
            lerp(mountainBand[2], rock[2], peaks * 0.48),
          ];
          const polarWhite = smoothstep(0.68, 1.0, latNorm) * 0.92;
          const finalLand = [
            lerp(peakBand[0], snowWhite[0], Math.max(highSnow, polarWhite)),
            lerp(peakBand[1], snowWhite[1], Math.max(highSnow, polarWhite)),
            lerp(peakBand[2], snowWhite[2], Math.max(highSnow, polarWhite)),
          ];
          r = finalLand[0] / 255;
          g = finalLand[1] / 255;
          b = finalLand[2] / 255;
        }

        const haze = 0.01 + fbm2(u * 18.0, v * 10.0, 21.0) * 0.018;
        const polarMix = polar * 0.88;
        r = clamp01(r + haze);
        g = clamp01(g + haze * 0.88);
        b = clamp01(b + haze * 1.12);

        if (polarMix > 0.001) {
          r = lerp(r, 0.968, polarMix);
          g = lerp(g, 0.977, polarMix);
          b = lerp(b, 0.988, polarMix);
        }

        const index = (y * width + x) * 4;
        data[index] = Math.round(r * 255);
        data[index + 1] = Math.round(g * 255);
        data[index + 2] = Math.round(b * 255);
        data[index + 3] = Math.round(clamp01(land + (1 - polar) * 0.06) * 255);
      }
    }

    context.putImageData(image, 0, 0);
    return canvas;
  }

  function generateCloudTextureCanvas() {
    const width = 1024;
    const height = 512;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    const image = context.createImageData(width, height);
    const data = image.data;

    for (let y = 0; y < height; y++) {
      const v = y / (height - 1);
      const lat = Math.abs(v - 0.5) * 2;

      for (let x = 0; x < width; x++) {
        const u = x / (width - 1);
        const band =
          0.5 +
          0.35 *
            Math.sin(u * 10.0 + v * 7.0 + fbm2(u * 8.0, v * 5.0, 31.0) * 6.0);
        const swirlA = fbm2(u * 5.0 + v * 1.5, v * 4.0, 41.0);
        const swirlB = fbm2(u * 11.0 - v * 2.0, v * 7.0 + 2.0, 53.0);
        const detail = fbm2(u * 22.0, v * 14.0, 61.0);

        let alpha = band * 0.36 + swirlA * 0.38 + swirlB * 0.22 + detail * 0.12;
        alpha = smoothstep(0.46, 0.72, alpha);
        alpha *= 1.0 - smoothstep(0.84, 1.0, lat);

        const softness = smoothstep(0.0, 0.55, alpha);
        const brightness = 0.9 + softness * 0.1;

        const index = (y * width + x) * 4;
        data[index] = Math.round(245 * brightness);
        data[index + 1] = Math.round(248 * brightness);
        data[index + 2] = Math.round(255 * brightness);
        data[index + 3] = Math.round(clamp01(alpha) * 255);
      }
    }

    context.putImageData(image, 0, 0);
    return canvas;
  }

  function createTextureFromCanvas(gl, canvas) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }

  function init(canvas) {
    // ── WebGL context ──────────────────────────────────────
    const gl = canvas.getContext("webgl", {
      antialias: true,
      alpha: false,
      depth: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      alert("WebGL tidak didukung browser ini.");
      return;
    }

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 1);

    // ── Extensions ────────────────────────────────────────
    // OES_element_index_uint for >65535 indices (not needed at res 64, but good practice)

    // ── Build shaders ─────────────────────────────────────
    const progs = Shaders.buildAll(gl);

    // ── Build meshes ──────────────────────────────────────
    const STACKS = 64,
      SLICES = 64;
    const earthMesh = Mesh.buildSphere(gl, STACKS, SLICES);
    const cloudMesh = Mesh.buildSphere(gl, STACKS, SLICES); // same geo, slightly larger
    const atmMesh = Mesh.buildSphere(gl, 32, 32);
    const starData = Mesh.buildStars(gl, 3000, 200);

    // ── Local texture pipeline ────────────────────────────
    const earthTexture = createTextureFromCanvas(
      gl,
      generateEarthTextureCanvas()
    );
    const cloudTexture = createTextureFromCanvas(
      gl,
      generateCloudTextureCanvas()
    );

    // ── Camera ────────────────────────────────────────────
    const camera = Camera.create(canvas);
    const { mat4, identity, multiply, scale, normalMatrix } = Camera;

    // ── State ─────────────────────────────────────────────
    let state = {
      rotAngle: 0,
      rotSpeed: 0.3, // multiplier (1 = ~24s/rev)
      axialTilt: 23.5, // degrees
      time: 0,
      fps: 0,
      showAtm: true,
      showClouds: true,
      showStars: true,
      showWire: false,
    };

    // Sun direction (fixed in world space, left side)
    const sunDir = new Float32Array([1.0, 0.2, 0.3]);
    // normalize
    const sl = Math.sqrt(sunDir[0] ** 2 + sunDir[1] ** 2 + sunDir[2] ** 2);
    sunDir[0] /= sl;
    sunDir[1] /= sl;
    sunDir[2] /= sl;

    // ── Helper: bind float attrib ─────────────────────────
    function bindAttrib(prog, name, buf, size) {
      const loc = gl.getAttribLocation(prog, name);
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }
    function bindTexture(prog, samplerName, texture, unit) {
      const loc = gl.getUniformLocation(prog, samplerName);
      if (!loc && loc !== 0) return;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(loc, unit);
    }
    function setUniform(prog, name, type, ...v) {
      const loc = gl.getUniformLocation(prog, name);
      if (!loc && loc !== 0) return;
      gl["uniform" + type](loc, ...v);
    }
    function setMat4(prog, name, m) {
      const loc = gl.getUniformLocation(prog, name);
      if (!loc && loc !== 0) return;
      gl.uniformMatrix4fv(loc, false, m);
    }
    function setMat3(prog, name, m) {
      const loc = gl.getUniformLocation(prog, name);
      if (!loc && loc !== 0) return;
      gl.uniformMatrix3fv(loc, false, m);
    }

    // ── Build Earth model matrix ──────────────────────────
    function earthModel() {
      // tilt around Z axis then rotate around Y
      const tiltRad = (state.axialTilt * Math.PI) / 180;
      const tiltM = mat4();
      identity(tiltM);
      // rotation around Z for tilt
      tiltM[0] = Math.cos(tiltRad);
      tiltM[1] = Math.sin(tiltRad);
      tiltM[4] = -Math.sin(tiltRad);
      tiltM[5] = Math.cos(tiltRad);
      tiltM[10] = 1;
      tiltM[15] = 1;

      const rotM = mat4();
      identity(rotM);
      rotM[0] = Math.cos(state.rotAngle);
      rotM[2] = -Math.sin(state.rotAngle);
      rotM[8] = Math.sin(state.rotAngle);
      rotM[10] = Math.cos(state.rotAngle);
      rotM[5] = 1;
      rotM[15] = 1;

      return multiply(mat4(), tiltM, rotM);
    }

    // ── Draw sphere helper ─────────────────────────────────
    function drawSphere(prog, mesh, model, extraUniforms, textureBindings) {
      gl.useProgram(prog);
      bindAttrib(prog, "aPosition", mesh.position, 3);
      bindAttrib(prog, "aNormal", mesh.normal, 3);
      bindAttrib(prog, "aTexCoord", mesh.texCoord, 2);

      const proj = camera.getProjectionMatrix(canvas.width / canvas.height);
      const view = camera.getViewMatrix();
      const eye = camera.getEyePosition();
      const nm = normalMatrix(model);

      setMat4(prog, "uModel", model);
      setMat4(prog, "uView", view);
      setMat4(prog, "uProjection", proj);
      setMat3(prog, "uNormalMatrix", nm);
      setUniform(prog, "uSunDir", "3fv", sunDir);
      setUniform(prog, "uCameraPos", "3f", ...eye);
      setUniform(prog, "uTime", "1f", state.time);

      if (textureBindings) {
        textureBindings.forEach((binding) => {
          bindTexture(prog, binding.name, binding.texture, binding.unit || 0);
        });
      }

      if (extraUniforms) extraUniforms(prog);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    }

    // ── Draw wireframe ────────────────────────────────────
    function drawWire(mesh, model) {
      const prog = progs.wire;
      gl.useProgram(prog);
      bindAttrib(prog, "aPosition", mesh.position, 3);
      const proj = camera.getProjectionMatrix(canvas.width / canvas.height);
      const view = camera.getViewMatrix();
      setMat4(prog, "uModel", model);
      setMat4(prog, "uView", view);
      setMat4(prog, "uProjection", proj);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.index);
      // draw as lines
      const cnt = mesh.count;
      // We re-draw as LINE_STRIP over the same index buffer for a rough wireframe
      gl.drawElements(gl.LINES, cnt, gl.UNSIGNED_SHORT, 0);
    }

    // ── Draw atmosphere shell ─────────────────────────────
    function drawAtmosphere(baseModel) {
      // slightly larger sphere
      const atmScale = 1.055;
      const atmModel = scale(baseModel, atmScale, atmScale, atmScale);
      gl.depthMask(false);
      drawSphere(progs.atm, atmMesh, atmModel, null);
      gl.depthMask(true);
    }

    // ── Draw clouds ───────────────────────────────────────
    function drawClouds(baseModel) {
      const cs = 1.015;
      const cloudModel = scale(baseModel, cs, cs, cs);
      gl.depthMask(false);
      drawSphere(progs.cloud, cloudMesh, cloudModel, null, [
        { name: "uCloudMap", texture: cloudTexture, unit: 0 },
      ]);
      gl.depthMask(true);
    }

    // ── Draw stars ────────────────────────────────────────
    function drawStars() {
      const prog = progs.star;
      gl.useProgram(prog);

      // Stars use camera rotation only (no tilt/spin), so they follow drag
      const proj = camera.getProjectionMatrix(canvas.width / canvas.height);
      // Use the camera's rotation matrix as the "view" so stars rotate with drag
      const starView = camera.getViewMatrix();

      bindAttrib(prog, "aPosition", starData.position, 3);
      bindAttrib(prog, "aSize", starData.size, 1);
      bindAttrib(prog, "aBrightness", starData.brightness, 1);

      setMat4(prog, "uView", starView);
      setMat4(prog, "uProjection", proj);
      setUniform(prog, "uTime", "1f", state.time);

      gl.drawArrays(gl.POINTS, 0, starData.count);
    }

    // ── Resize handler ────────────────────────────────────
    function resize() {
      canvas.width = canvas.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener("resize", resize);
    resize();

    // ── FPS counter ───────────────────────────────────────
    let lastTime = 0,
      frameCount = 0,
      fpsTimer = 0;

    // ── Main render loop ──────────────────────────────────
    function frame(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // FPS
      frameCount++;
      fpsTimer += dt;
      if (fpsTimer >= 0.5) {
        state.fps = Math.round(frameCount / fpsTimer);
        frameCount = 0;
        fpsTimer = 0;
        updateHUD();
      }

      // Earth rotation: 1 full rotation in ~20 real-seconds at speed=1
      const BASE_RATE = (2 * Math.PI) / 20;
      state.rotAngle += BASE_RATE * state.rotSpeed * dt;
      state.time = now / 1000;

      camera.update();

      // ── Clear ────────────────────────────────────────────
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // ── Stars (behind everything) ─────────────────────
      if (state.showStars) {
        gl.depthMask(false);
        drawStars();
        gl.depthMask(true);
      }

      // ── Earth ─────────────────────────────────────────
      const model = earthModel();

      if (state.showAtm) {
        // Draw atm behind earth first (back faces)
        gl.cullFace && gl.enable(gl.CULL_FACE);
        drawAtmosphere(model);
        gl.disable && gl.disable(gl.CULL_FACE);
      }

      // Earth surface
      gl.depthMask(true);
      drawSphere(
        progs.earth,
        earthMesh,
        model,
        (prog) => {
          setUniform(prog, "uWireframe", "1i", state.showWire ? 1 : 0);
          setUniform(prog, "uShowAtmosphere", "1i", state.showAtm ? 1 : 0);
        },
        [{ name: "uEarthMap", texture: earthTexture, unit: 0 }]
      );

      if (state.showWire) {
        drawWire(earthMesh, model);
      }

      if (state.showClouds && !state.showWire) {
        drawClouds(model);
      }

      requestAnimationFrame(frame);
    }

    requestAnimationFrame((t) => {
      lastTime = t;
      requestAnimationFrame(frame);
    });

    // ── HUD update ────────────────────────────────────────
    function updateHUD() {
      const deg = (((state.rotAngle * 180) / Math.PI) % 360).toFixed(1);
      document.getElementById("hud-fps").textContent = state.fps + " FPS";
      document.getElementById("hud-rot").textContent = "ROT " + deg + "°";
      document.getElementById("hud-tilt").textContent =
        "TILT " + state.axialTilt.toFixed(1) + "°";
      document.getElementById("hud-speed").textContent =
        "SPD ×" + state.rotSpeed.toFixed(2);
    }

    // ── UI controls ───────────────────────────────────────
    function toggleBtn(id, key) {
      document.getElementById(id).addEventListener("click", function () {
        state[key] = !state[key];
        this.classList.toggle("active", state[key]);
      });
    }

    toggleBtn("btn-atm", "showAtm");
    toggleBtn("btn-clouds", "showClouds");
    toggleBtn("btn-stars", "showStars");

    // Special wireframe toggle to also control scanlines
    document.getElementById("btn-wire").addEventListener("click", function () {
      state.showWire = !state.showWire;
      this.classList.toggle("active", state.showWire);
      document
        .getElementById("scanlines")
        .classList.toggle("wireframe-active", state.showWire);
    });

    document.getElementById("btn-speedup").addEventListener("click", () => {
      state.rotSpeed = Math.min(state.rotSpeed * 1.5, 32);
      updateHUD();
    });
    document.getElementById("btn-speeddown").addEventListener("click", () => {
      state.rotSpeed = Math.max(state.rotSpeed / 1.5, 0.05);
      updateHUD();
    });
    document.getElementById("btn-reset").addEventListener("click", () => {
      state.rotSpeed = 0.3;
      updateHUD();
    });

    document
      .getElementById("btn-atm")
      .classList.toggle("active", state.showAtm);
    document
      .getElementById("btn-clouds")
      .classList.toggle("active", state.showClouds);
    document
      .getElementById("btn-stars")
      .classList.toggle("active", state.showStars);
    document
      .getElementById("btn-wire")
      .classList.toggle("active", state.showWire);
    document
      .getElementById("scanlines")
      .classList.toggle("wireframe-active", state.showWire);

    updateHUD();
  }

  return { init };
})();
