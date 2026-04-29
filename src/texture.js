// Simple pseudo-random / noise helpers
function hash(x, y) {
  let h = (Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;
  return h < 0 ? h + 1 : h;
}

function smoothNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
  const a = hash(ix,   iy);
  const b = hash(ix+1, iy);
  const c = hash(ix,   iy+1);
  const d = hash(ix+1, iy+1);
  return a + (b-a)*ux + (c-a)*uy + (d-c-b+a)*ux*uy;
}

function fbm(x, y, octaves = 6) {
  let value = 0, amp = 0.5, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x*freq, y*freq) * amp;
    max   += amp;
    amp   *= 0.5;
    freq  *= 2.0;
  }
  return value / max;
}

// ─── Day texture ────────────────────────────────────────────────────────────
function generateDayTexture(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size / 2);
  const d   = img.data;

  const H = size / 2;

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < size; px++) {
      const u  = px / size;
      const v  = py / H;

      // spherical coords for continental placement
      const lon = u * 360 - 180;   // -180 .. 180
      const lat = v * 180 - 90;    //  -90 ..  90

      // noise coords
      const nx = u * 4;
      const ny = v * 4;

      const n = fbm(nx, ny, 7);

      let r, g, b;

      // polar ice caps
      if (Math.abs(lat) > 72) {
        const blend = Math.min(1, (Math.abs(lat)-72)/8);
        const snow  = 0.85 + fbm(nx*6, ny*6)*0.15;
        const ocean = 0.05 + n * 0.15;
        r = ocean*(1-blend)*255 + snow*blend*255;
        g = (ocean*0.3+0.1)*(1-blend)*255 + snow*blend*255;
        b = (ocean*0.6+0.2)*(1-blend)*255 + snow*blend*255;
      } else if (n > 0.54) {
        // land
        const elev    = (n - 0.54) / 0.46;
        const detail  = fbm(nx*8, ny*8);

        // mountains
        if (elev > 0.6) {
          const m = (elev - 0.6) / 0.4;
          r = Math.round(120 + m * 100 + detail*20);
          g = Math.round(110 + m * 95  + detail*20);
          b = Math.round(100 + m * 90  + detail*15);
        } else if (elev > 0.3) {
          // highlands / savanna
          r = Math.round(140 + detail*40);
          g = Math.round(120 + detail*40);
          b = Math.round(70  + detail*20);
        } else {
          // lowland forest / plains
          r = Math.round(60  + detail*50);
          g = Math.round(100 + detail*50);
          b = Math.round(40  + detail*30);
        }
        // desert band near equator
        if (Math.abs(lat) < 25 && fbm(nx*3+5, ny*3+5) > 0.55) {
          r = Math.round(200 + detail*30);
          g = Math.round(170 + detail*20);
          b = Math.round(90  + detail*20);
        }
      } else {
        // ocean
        const depth = (0.54 - n) / 0.54;
        r = Math.round(10  + (1-depth)*30);
        g = Math.round(50  + (1-depth)*50);
        b = Math.round(120 + (1-depth)*80);
      }

      const i = (py * size + px) * 4;
      d[i]   = Math.max(0, Math.min(255, r));
      d[i+1] = Math.max(0, Math.min(255, g));
      d[i+2] = Math.max(0, Math.min(255, b));
      d[i+3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ─── Night texture (city lights) ─────────────────────────────────────────────
function generateNightTexture(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size / 2);
  const d   = img.data;

  const H = size / 2;

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const v = py / H;
      const nx = u * 4, ny = v * 4;
      const n  = fbm(nx, ny, 7);

      // city lights appear only on land areas
      const isLand = n > 0.54;
      const lat    = v * 180 - 90;
      const isPole = Math.abs(lat) > 72;

      let r = 0, g = 0, b = 0;

      if (isLand && !isPole) {
        const cityNoise = fbm(nx * 12 + 99, ny * 12 + 99, 4);
        if (cityNoise > 0.60) {
          const intensity = Math.pow((cityNoise - 0.60) / 0.40, 1.5);
          r = Math.round(255 * intensity * 0.9);
          g = Math.round(255 * intensity * 0.85);
          b = Math.round(255 * intensity * 0.5);
        }
      }

      const i = (py * size + px) * 4;
      d[i]   = r;
      d[i+1] = g;
      d[i+2] = b;
      d[i+3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ─── Upload to WebGL ─────────────────────────────────────────────────────────
function createWebGLTexture(gl, canvas) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
  return tex;
}
