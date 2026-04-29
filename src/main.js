// ─── WebGL helpers ────────────────────────────────────────────────────────────

function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vertSrc, fragSrc) {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

function createBuffer(gl, data, target = null) {
  target = target || gl.ARRAY_BUFFER;
  const buf = gl.createBuffer();
  gl.bindBuffer(target, buf);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return buf;
}

function getUniforms(gl, prog, names) {
  const u = {};
  names.forEach(n => u[n] = gl.getUniformLocation(prog, n));
  return u;
}

function getAttribs(gl, prog, names) {
  const a = {};
  names.forEach(n => a[n] = gl.getAttribLocation(prog, n));
  return a;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  const canvas = document.getElementById('glCanvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) { alert('WebGL tidak didukung browser ini.'); return; }

  // Extensions
  gl.getExtension('OES_element_index_uint');

  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    rotationSpeed : 0.5,
    showAtmosphere: true,
    showWireframe : false,
    showStars     : true,
    rotationAngle : 0,
    lightAngle    : 0,
    lastTime      : 0,
    fps           : 0,
    fpsFrames     : 0,
    fpsAccum      : 0
  };

  // ── Programs ───────────────────────────────────────────────────────────────
  const earthProg = createProgram(gl, Shaders.earthVert, Shaders.earthFrag);
  const atmosProg = createProgram(gl, Shaders.atmosphereVert, Shaders.atmosphereFrag);
  const starProg  = createProgram(gl, Shaders.starVert, Shaders.starFrag);
  const wireProg  = createProgram(gl, Shaders.wireVert, Shaders.wireFrag);

  // ── Geometry ───────────────────────────────────────────────────────────────
  const sphere   = createSphere(64);
  const wireSph  = createWireframeSphere(32);
  const starData = createStars(3000);

  // Earth buffers
  const earthPosBuf  = createBuffer(gl, sphere.positions);
  const earthNrmBuf  = createBuffer(gl, sphere.normals);
  const earthUVBuf   = createBuffer(gl, sphere.uvs);
  const earthIdxBuf  = createBuffer(gl, sphere.indices, gl.ELEMENT_ARRAY_BUFFER);

  // Wireframe buffers
  const wirePosBuf = createBuffer(gl, wireSph.positions);
  const wireIdxBuf = createBuffer(gl, wireSph.indices, gl.ELEMENT_ARRAY_BUFFER);

  // Star buffer
  const starBuf = createBuffer(gl, starData.positions);

  // ── Textures ───────────────────────────────────────────────────────────────
  const loadingEl = document.getElementById('loading');
  loadingEl.textContent = 'Membuat tekstur bumi...';

  // Defer heavy texture generation to next tick so loading message appears
  setTimeout(() => {
    const dayCanvas   = generateDayTexture(1024);
    const nightCanvas = generateNightTexture(1024);
    const dayTex      = createWebGLTexture(gl, dayCanvas);
    const nightTex    = createWebGLTexture(gl, nightCanvas);
    loadingEl.style.display = 'none';

    // ── Matrices ──────────────────────────────────────────────────────────────
    const projMatrix   = mat4.create();
    const viewMatrix   = mat4.create();
    const modelMatrix  = mat4.create();
    const normalMatrix = new Float32Array(9);
    const tempMatrix   = mat4.create();

    // ── Camera ────────────────────────────────────────────────────────────────
    const camera = new OrbitCamera();
    camera.attach(canvas);

    // ── Resize ────────────────────────────────────────────────────────────────
    function resize() {
      canvas.width  = canvas.clientWidth  * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
      mat4.perspective(projMatrix,
        Math.PI / 4,
        canvas.width / canvas.height,
        0.1, 500.0);
    }
    window.addEventListener('resize', resize);
    resize();

    // ── Attribute binder ──────────────────────────────────────────────────────
    function bindAttrib(buf, loc, size) {
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }

    // ── Earth uniforms / attribs ──────────────────────────────────────────────
    const eU = getUniforms(gl, earthProg, [
      'uModel','uView','uProjection','uNormalMatrix',
      'uEarthDay','uEarthNight','uLightDir','uCameraPos'
    ]);
    const eA = getAttribs(gl, earthProg, ['aPosition','aNormal','aUV']);

    // ── Atmosphere uniforms / attribs ─────────────────────────────────────────
    const aU = getUniforms(gl, atmosProg, [
      'uModel','uView','uProjection','uCameraPos','uLightDir'
    ]);
    const aA = getAttribs(gl, atmosProg, ['aPosition']);

    // ── Star uniforms / attribs ───────────────────────────────────────────────
    const sU = getUniforms(gl, starProg, ['uView','uProjection']);
    const sA = getAttribs(gl, starProg, ['aPosition']);

    // ── Wireframe uniforms / attribs ──────────────────────────────────────────
    const wU = getUniforms(gl, wireProg, ['uModel','uView','uProjection']);
    const wA = getAttribs(gl, wireProg, ['aPosition']);

    // ── Render loop ───────────────────────────────────────────────────────────
    function buildModelMatrix() {
      mat4.identity(modelMatrix);
      // Axial tilt 23.5°
      mat4.rotateZ(modelMatrix, modelMatrix, 23.5 * Math.PI / 180);
      // Rotation
      mat4.rotateY(modelMatrix, modelMatrix, state.rotationAngle);
      mat4.normalMatrix(normalMatrix, modelMatrix);
    }

    function getLightDir() {
      return [
        Math.cos(state.lightAngle),
        0.15,
        Math.sin(state.lightAngle)
      ];
    }

    function renderEarth(lightDir, camPos) {
      gl.useProgram(earthProg);

      gl.uniformMatrix4fv(eU.uModel,       false, modelMatrix);
      gl.uniformMatrix4fv(eU.uView,        false, viewMatrix);
      gl.uniformMatrix4fv(eU.uProjection,  false, projMatrix);
      gl.uniformMatrix3fv(eU.uNormalMatrix,false, normalMatrix);
      gl.uniform3fv(eU.uLightDir,   lightDir);
      gl.uniform3fv(eU.uCameraPos,  camPos);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dayTex);
      gl.uniform1i(eU.uEarthDay, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, nightTex);
      gl.uniform1i(eU.uEarthNight, 1);

      bindAttrib(earthPosBuf, eA.aPosition, 3);
      bindAttrib(earthNrmBuf, eA.aNormal,   3);
      bindAttrib(earthUVBuf,  eA.aUV,       2);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, earthIdxBuf);
      gl.drawElements(gl.TRIANGLES, sphere.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    function renderAtmosphere(lightDir, camPos) {
      // Slightly larger sphere
      mat4.identity(tempMatrix);
      mat4.scale(tempMatrix, tempMatrix, [1.025, 1.025, 1.025]);

      gl.useProgram(atmosProg);
      gl.uniformMatrix4fv(aU.uModel,      false, tempMatrix);
      gl.uniformMatrix4fv(aU.uView,       false, viewMatrix);
      gl.uniformMatrix4fv(aU.uProjection, false, projMatrix);
      gl.uniform3fv(aU.uCameraPos, camPos);
      gl.uniform3fv(aU.uLightDir,  lightDir);

      bindAttrib(earthPosBuf, aA.aPosition, 3);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, earthIdxBuf);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.cullFace(gl.FRONT);
      gl.drawElements(gl.TRIANGLES, sphere.indexCount, gl.UNSIGNED_SHORT, 0);
      gl.cullFace(gl.BACK);
      gl.disable(gl.BLEND);
    }

    function renderStars() {
      gl.useProgram(starProg);
      gl.uniformMatrix4fv(sU.uView,       false, viewMatrix);
      gl.uniformMatrix4fv(sU.uProjection, false, projMatrix);
      bindAttrib(starBuf, sA.aPosition, 3);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, starData.count);
      gl.disable(gl.BLEND);
    }

    function renderWireframe() {
      gl.useProgram(wireProg);
      gl.uniformMatrix4fv(wU.uModel,      false, modelMatrix);
      gl.uniformMatrix4fv(wU.uView,       false, viewMatrix);
      gl.uniformMatrix4fv(wU.uProjection, false, projMatrix);
      bindAttrib(wirePosBuf, wA.aPosition, 3);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireIdxBuf);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawElements(gl.LINES, wireSph.indexCount, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.BLEND);
    }

    function render(timestamp) {
      const dt = Math.min((timestamp - state.lastTime) / 1000, 0.05);
      state.lastTime = timestamp;

      // FPS counter
      state.fpsAccum  += dt;
      state.fpsFrames += 1;
      if (state.fpsAccum >= 0.5) {
        state.fps       = Math.round(state.fpsFrames / state.fpsAccum);
        state.fpsAccum  = 0;
        state.fpsFrames = 0;
        document.getElementById('fpsLabel').textContent = state.fps + ' fps';
      }

      // Update angles
      state.rotationAngle += dt * state.rotationSpeed * 0.3;
      state.lightAngle    += dt * 0.02; // sun orbits slowly

      buildModelMatrix();
      camera.getViewMatrix(viewMatrix);
      const camPos   = camera.position;
      const lightDir = getLightDir();

      gl.clearColor(0.0, 0.0, 0.02, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);

      if (state.showStars)     renderStars();
      renderEarth(lightDir, camPos);
      if (state.showAtmosphere) renderAtmosphere(lightDir, camPos);
      if (state.showWireframe)  renderWireframe();

      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

    // ── UI bindings ───────────────────────────────────────────────────────────
    const speedSlider = document.getElementById('speedSlider');
    const speedVal    = document.getElementById('speedVal');
    speedSlider.addEventListener('input', () => {
      state.rotationSpeed = parseFloat(speedSlider.value);
      speedVal.textContent = parseFloat(speedSlider.value).toFixed(1) + 'x';
    });

    document.getElementById('toggleAtmos').addEventListener('click', function() {
      state.showAtmosphere = !state.showAtmosphere;
      this.classList.toggle('active', state.showAtmosphere);
    });

    document.getElementById('toggleWire').addEventListener('click', function() {
      state.showWireframe = !state.showWireframe;
      this.classList.toggle('active', state.showWireframe);
    });

    document.getElementById('toggleStars').addEventListener('click', function() {
      state.showStars = !state.showStars;
      this.classList.toggle('active', state.showStars);
    });

  }, 50); // end setTimeout
});
