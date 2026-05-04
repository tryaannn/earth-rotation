// ============================================================
// shaders.js — Semua GLSL shader untuk WebGL Earth Visualization
// ============================================================

const Shaders = (() => {
  // ── Earth Vertex Shader ──────────────────────────────────
  const earthVS = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aTexCoord;

    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProjection;
    uniform mat3 uNormalMatrix;

    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec2 vTexCoord;

    void main() {
      vec4 worldPos = uModel * vec4(aPosition, 1.0);
      vWorldPos    = worldPos.xyz;
      vNormal      = normalize(uNormalMatrix * aNormal);
      vTexCoord    = aTexCoord;
      gl_Position  = uProjection * uView * worldPos;
    }
  `;

  // ── Earth Fragment Shader ────────────────────────────────
  const earthFS = `
    precision highp float;

    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec2 vTexCoord;

    uniform vec3  uSunDir;       // normalized direction TO sun
    uniform vec3  uCameraPos;
    uniform float uTime;
    uniform sampler2D uEarthMap;
    uniform bool  uWireframe;
    uniform bool  uShowAtmosphere;

    float hash(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 6; i++) {
        v += a * noise(p);
        p = p * 2.07 + vec2(1.7, 9.2);
        a *= 0.5;
      }
      return v;
    }

    float ridge(vec2 p) {
      float n = fbm(p);
      return 1.0 - abs(2.0 * n - 1.0);
    }

    float continentMask(vec2 uv) {
      vec2 warp = vec2(fbm(uv * vec2(3.6, 2.0) + vec2(2.0, 4.1)), fbm(uv * vec2(3.8, 2.2) + vec2(8.3, 1.3)));
      vec2 p = uv * vec2(4.1, 2.3) + (warp - 0.5) * 0.42;

      float low  = fbm(p + vec2(3.1, 2.7));
      float mid  = fbm(p * 2.0 + vec2(1.3, 5.2));
      float high = fbm(p * 4.1 + vec2(8.1, 3.9));
      float shape = low + 0.45 * mid + 0.2 * high;

      float land = smoothstep(0.54, 0.62, shape);

      float lat = (uv.y - 0.5) * 3.14159;
      float polar = smoothstep(1.18, 1.36, abs(lat));
      return max(land, polar * 0.82);
    }

    float terrainHeight(vec2 uv, float land) {
      if (land < 0.02) return 0.0;

      vec2 p = uv * vec2(8.0, 4.4);
      float base = fbm(p + vec2(5.3, 2.1));
      float detail = 0.6 * fbm(p * 2.0 + vec2(2.2, 7.7));
      float ranges = 0.45 * ridge(p * 2.8 + vec2(0.7, 1.9));
      return clamp(base + detail + ranges, 0.0, 1.0);
    }

    float coastMask(float land) {
      return 1.0 - smoothstep(0.08, 0.22, abs(land - 0.5));
    }

    float desertMask(vec2 uv, float h) {
      float lat = abs(uv.y - 0.5);
      float subtropic = smoothstep(0.10, 0.21, lat) * (1.0 - smoothstep(0.24, 0.36, lat));
      float humidity = fbm(uv * vec2(5.0, 2.7) + vec2(4.4, 2.2));
      float rocky = smoothstep(0.52, 0.75, h);
      return subtropic * smoothstep(0.45, 0.62, humidity) * (1.0 - rocky);
    }

    float forestMask(vec2 uv, float h) {
      float lat = abs(uv.y - 0.5);
      float tropical = 1.0 - smoothstep(0.12, 0.34, lat);
      float moisture = fbm(uv * vec2(7.0, 3.4) + vec2(1.7, 8.1));
      return tropical * smoothstep(0.52, 0.78, moisture) * (1.0 - smoothstep(0.62, 0.86, h));
    }

    float cityLights(vec2 uv, float land, float h, float coast, float polar) {
      vec2 p = uv * vec2(15.0, 7.5);
      float clusters = 0.0;
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        vec2 pp = p + vec2(fi * 3.7, fi * 2.3);
        float n1 = noise(pp);
        float n2 = noise(pp * 2.0 + vec2(1.1, 0.9));
        float n3 = noise(pp * 4.3 + vec2(5.3, 7.9));
        clusters += step(0.73, n1) * step(0.67, n2) * (0.5 + 0.5 * n3);
      }
      float temperate = 1.0 - smoothstep(0.18, 0.42, abs(uv.y - 0.5));
      float habitable = land * (1.0 - smoothstep(0.72, 0.9, h)) * (1.0 - polar);
      float coastBoost = mix(0.75, 1.25, coast);
      return clamp(clusters * 0.68 * temperate * habitable * coastBoost, 0.0, 1.0);
    }

    vec3 applySaturation(vec3 color, float sat) {
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      return mix(vec3(luma), color, sat);
    }

    vec3 auroraGlow(vec2 uv, float sunN, float polar, float strength) {
      float night = smoothstep(0.10, -0.15, sunN);
      float poleBand = smoothstep(0.78, 0.96, polar);
      float waveA = fbm(vec2(uv.x * 28.0 + uTime * 0.05, uv.y * 11.0));
      float waveB = fbm(vec2(uv.x * 34.0 - uTime * 0.04, uv.y * 8.0 + 3.7));
      float curtains = smoothstep(0.58, 0.84, waveA * 0.75 + waveB * 0.45);
      float streak = smoothstep(0.45, 0.8, noise(vec2(uv.x * 70.0 + uTime * 0.08, uv.y * 4.0)));
      float a = night * poleBand * curtains * streak * strength;
      return vec3(0.10, 0.95, 0.58) * a + vec3(0.20, 0.52, 1.0) * a * 0.3;
    }

    void main() {
      if (uWireframe) {
        discard;
      }

      vec2 uv = vTexCoord;
      vec4 earthSample = texture2D(uEarthMap, uv);
      vec3 albedo = earthSample.rgb;
      float landMask = earthSample.a;
      vec3 Ngeo = normalize(vNormal);

      float sunN = dot(Ngeo, uSunDir);
      float day = smoothstep(-0.10, 0.18, sunN);
      float diff = max(sunN, 0.0);
      float nightFactor = 1.0 - day;

      float land = continentMask(uv);
      float coast = coastMask(land);
      float h = terrainHeight(uv, land);
      float desert = desertMask(uv, h) * land;
      float forest = forestMask(uv, h) * land;

      float lat = abs(uv.y - 0.5) * 3.14159;
      float polar = smoothstep(1.13, 1.36, lat);

      // Procedural bump for shading variation
      float e = 0.0028;
      float hU = terrainHeight(uv + vec2(e, 0.0), land);
      float hV = terrainHeight(uv + vec2(0.0, e), land);
      float dhU = (hU - h) * land;
      float dhV = (hV - h) * land;

      vec3 upRef = abs(Ngeo.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 T = normalize(cross(upRef, Ngeo));
      vec3 B = normalize(cross(Ngeo, T));
      vec3 N = normalize(Ngeo + T * dhU * 1.35 + B * dhV * 1.35);

      vec3 V = normalize(uCameraPos - vWorldPos);
      vec3 H = normalize(uSunDir + V);

      float ndh = max(dot(N, H), 0.0);
      float oceanMask = 1.0 - landMask;
      float oceanSpec = pow(ndh, 110.0) * oceanMask;
      float fresnel = pow(1.0 - max(dot(N, V), 0.0), 5.0);
      vec3 specular = vec3(1.0, 0.99, 0.96) * oceanSpec * (0.55 + 0.85 * fresnel) * diff * 0.85;

      // Slight coastal haze on day side
      vec3 coastGlow = vec3(0.08, 0.22, 0.18) * coast * landMask * diff * 0.16;

      float ambient = 0.11;
      vec3 dayColor = albedo * (ambient + diff * 1.28) + specular + coastGlow;

      float cl = cityLights(uv, land, h, coast, polar);
      vec3 cityTone = mix(vec3(1.0, 0.92, 0.55), vec3(1.0, 0.96, 0.80), noise(uv * 60.0));
      vec3 cityGlow = cityTone * cl * 1.15;
      vec3 nightColor = albedo * 0.006 + cityGlow;

      // Soft twilight tint around terminator
      float twilight = smoothstep(-0.16, -0.02, sunN) * (1.0 - smoothstep(-0.02, 0.10, sunN));
      vec3 twilightTint = vec3(0.30, 0.24, 0.28) * twilight;

      vec3 color = mix(nightColor, dayColor, day) + twilightTint;

      if (uShowAtmosphere) {
        float rim = pow(1.0 - max(dot(N, V), 0.0), 3.2);
        vec3 dayAtm = vec3(0.34, 0.64, 1.0) * rim * max(diff + 0.22, 0.0);
        vec3 nightAtm = vec3(0.05, 0.08, 0.22) * rim * nightFactor * 0.28;
        vec3 aurora = auroraGlow(uv, sunN, polar, 0.28);
        color += dayAtm * 0.55 + nightAtm + aurora;
      }

      // Tonemap + gamma for more natural contrast
      color = applySaturation(color, 1.08);
      color = color / (color + vec3(1.0));
      color = clamp((color - 0.5) * 1.12 + 0.5, 0.0, 1.0);
      color = pow(color, vec3(0.84));

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  // ── Wireframe overlay: draw lines on triangle edges ──────
  const wireVS = `
    attribute vec3 aPosition;
    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProjection;
    void main(){
      gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
    }
  `;
  const wireFS = `
    precision mediump float;
    void main(){
      gl_FragColor = vec4(1.0, 1.0, 1.0, 0.18);
    }
  `;

  // ── Cloud Vertex Shader ──────────────────────────────────
  const cloudVS = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aTexCoord;

    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProjection;
    uniform mat3 uNormalMatrix;

    varying vec3 vNormal;
    varying vec2 vTexCoord;
    varying vec3 vWorldPos;

    void main(){
      vec4 wp = uModel * vec4(aPosition, 1.0);
      vWorldPos = wp.xyz;
      vNormal   = normalize(uNormalMatrix * aNormal);
      vTexCoord = aTexCoord;
      gl_Position = uProjection * uView * wp;
    }
  `;

  // ── Cloud Fragment Shader ────────────────────────────────
  const cloudFS = `
    precision highp float;

    varying vec3 vNormal;
    varying vec2 vTexCoord;
    varying vec3 vWorldPos;

    uniform sampler2D uCloudMap;
    uniform vec3  uSunDir;
    uniform float uTime;
    uniform vec3  uCameraPos;

    void main(){
      vec4 cloudSample = texture2D(uCloudMap, vTexCoord);
      float alpha = cloudSample.a;
      if (alpha < 0.02) discard;

      vec3 N    = normalize(vNormal);
      float diff = max(dot(N, uSunDir), 0.0);
      float terminator = smoothstep(-0.08, 0.12, dot(N, uSunDir));

      vec3 cloudDay   = vec3(1.0) * (0.34 + diff * 0.82);
      vec3 cloudNight = vec3(0.07, 0.08, 0.12);
      vec3 color = mix(cloudNight, cloudDay, terminator) * mix(vec3(0.86), cloudSample.rgb, 0.9);

      // rim lighting
      vec3 viewDir = normalize(uCameraPos - vWorldPos);
      float rim = pow(1.0 - max(dot(N, viewDir),0.0), 2.5);
      color += vec3(0.92,0.96,1.0) * rim * diff * 0.52;

      gl_FragColor = vec4(color, alpha * 0.96);
    }
  `;

  // ── Atmosphere Shell Shader ───────────────────────────────
  const atmVS = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProjection;
    uniform mat3 uNormalMatrix;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    void main(){
      vec4 wp = uModel * vec4(aPosition,1.0);
      vWorldPos = wp.xyz;
      vNormal   = normalize(uNormalMatrix * aNormal);
      gl_Position = uProjection * uView * wp;
    }
  `;
  const atmFS = `
    precision highp float;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    uniform vec3 uSunDir;
    uniform vec3 uCameraPos;

    void main(){
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCameraPos - vWorldPos);
      float rim = 1.0 - max(dot(N,V),0.0);
      rim = pow(rim, 2.8);
      float sun = max(dot(N, uSunDir), 0.0);
      float dayside = smoothstep(-0.3, 0.5, dot(N, uSunDir));
      vec3 dayAtm   = mix(vec3(0.1,0.35,1.0), vec3(0.5,0.8,1.0), sun);
      vec3 nightAtm = vec3(0.02, 0.04, 0.12);
      vec3 color    = mix(nightAtm, dayAtm, dayside);
      float alpha   = rim * 0.55 * (0.3 + 0.7 * dayside);
      gl_FragColor  = vec4(color, alpha);
    }
  `;

  // ── Stars Vertex / Fragment ──────────────────────────────
  const starVS = `
    attribute vec3 aPosition;
    attribute float aSize;
    attribute float aBrightness;
    uniform mat4 uView;
    uniform mat4 uProjection;
    varying float vBrightness;
    void main(){
      vBrightness = aBrightness;
      gl_PointSize = aSize;
      gl_Position  = uProjection * uView * vec4(aPosition, 1.0);
    }
  `;
  const starFS = `
    precision mediump float;
    varying float vBrightness;
    uniform float uTime;
    void main(){
      vec2 d = gl_PointCoord - 0.5;
      float r = dot(d,d)*4.0;
      if(r > 1.0) discard;
      float twinkle = 0.85 + 0.15 * sin(uTime * 2.5 + vBrightness * 6.28);
      float alpha = (1.0 - r) * vBrightness * twinkle;
      vec3 col = mix(vec3(0.7,0.8,1.0), vec3(1.0,1.0,0.9), vBrightness);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  // ── Compile helper ───────────────────────────────────────
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error("Shader compile error:\n" + gl.getShaderInfoLog(s));
    return s;
  }

  function program(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error("Program link error:\n" + gl.getProgramInfoLog(p));
    return p;
  }

  function buildAll(gl) {
    return {
      earth: program(gl, earthVS, earthFS),
      wire: program(gl, wireVS, wireFS),
      cloud: program(gl, cloudVS, cloudFS),
      atm: program(gl, atmVS, atmFS),
      star: program(gl, starVS, starFS),
    };
  }

  return { buildAll };
})();
