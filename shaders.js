/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  MODUL 2 — SHADER SPECIALIST                            ║
 * ║  GLSL Vertex & Fragment Shader (WebGL 2.0 / GLSL ES 300)║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Tanggung jawab:
 *  - Vertex Shader   : transformasi MVP + normal
 *  - Fragment Shader : 3D Perlin Noise murni → benua/laut,
 *                      pencahayaan Directional, efek atmosfer
 *
 * Tidak ada tekstur eksternal — semua prosedural.
 */

// ────────────────────────────────────────────────────────────
// VERTEX SHADER
// ────────────────────────────────────────────────────────────
export const VS_SOURCE = /* glsl */ `#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aNormal;
in vec2 aUV;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
uniform mat3 uNormalMatrix;

out vec3 vNormal;
out vec3 vWorldPos;
out vec2 vUV;
out vec3 vViewDir;

void main() {
  vec4 worldPos  = uModel * vec4(aPosition, 1.0);
  vWorldPos      = worldPos.xyz;
  vNormal        = normalize(uNormalMatrix * aNormal);
  vUV            = aUV;

  // Arah pandang dari fragment ke kamera (untuk atmosfer fresnel)
  vec3 camPos    = inverse(uView)[3].xyz;   // posisi kamera di world
  vViewDir       = normalize(camPos - vWorldPos);

  gl_Position = uProjection * uView * worldPos;
}
`;

// ────────────────────────────────────────────────────────────
// FRAGMENT SHADER
// ────────────────────────────────────────────────────────────
export const FS_SOURCE = /* glsl */ `#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorldPos;
in vec2 vUV;
in vec3 vViewDir;

uniform vec3  uLightDir;   // arah matahari (world space, normalized)
uniform float uTime;       // waktu dalam milidetik (untuk awan bergerak)
uniform sampler2D uEarthTexture;
uniform sampler2D uCloudTexture;
uniform float uCloudEnabled;

out vec4 fragColor;

// ════════════════════════════════════════════════════════════
// 3D PERLIN NOISE — Implementasi murni GLSL (Ashima Arts)
// Tidak ada dependency tekstur / library eksternal.
// ════════════════════════════════════════════════════════════
vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x)  { return mod289v4(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

float cnoise(vec3 P) {
  vec3 Pi0 = floor(P);  vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod289v3(Pi0);  Pi1 = mod289v3(Pi1);
  vec3 Pf0 = fract(P);  vec3 Pf1 = Pf0 - vec3(1.0);

  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;

  vec4 ixy  = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 / 7.0; vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 / 7.0; vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x, gy0.x, gz0.x); vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
  vec3 g010 = vec3(gx0.z, gy0.z, gz0.z); vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
  vec3 g001 = vec3(gx1.x, gy1.x, gz1.x); vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
  vec3 g011 = vec3(gx1.z, gy1.z, gz1.z); vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000*=norm0.x; g010*=norm0.y; g100*=norm0.z; g110*=norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001*=norm1.x; g011*=norm1.y; g101*=norm1.z; g111*=norm1.w;

  float n000 = dot(g000, Pf0); float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z)); float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z)); float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz)); float n111 = dot(g111, Pf1);

  vec3  fade_xyz = fade(Pf0);
  vec4  n_z  = mix(vec4(n000,n100,n010,n110), vec4(n001,n101,n011,n111), fade_xyz.z);
  vec2  n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

// ════════════════════════════════════════════════════════════
// fBm — Fractal Brownian Motion (6 oktaf) untuk detail benua
// ════════════════════════════════════════════════════════════
float fbm(vec3 p) {
  float val = 0.0, amp = 0.5, freq = 1.0;
  for (int i = 0; i < 6; i++) {
    val  += amp  * cnoise(p * freq);
    amp  *= 0.5;
    freq *= 2.1;
  }
  return val;
}

float ridgeFbm(vec3 p) {
  float val = 0.0, amp = 0.55, freq = 1.0;
  for (int i = 0; i < 5; i++) {
    float n = abs(cnoise(p * freq));
    val += amp * (1.0 - n);
    amp *= 0.5;
    freq *= 2.3;
  }
  return val;
}

// ════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════
void main() {
  // Koordinat 3D seamless di permukaan bola
  vec3 p = normalize(vWorldPos) * 1.8;
  vec3 nrm = normalize(vNormal);

  float n = fbm(p);
  float ridge = ridgeFbm(p * 1.2 + vec3(3.1, 1.7, -2.4));

  // ── Warna permukaan ──────────────────────────────────────
  // Ambang batas daratan vs laut
  const float LAND_THRESH = 0.08;

  vec3 deepOcean  = vec3(0.02, 0.08, 0.24);
  vec3 shallowSea = vec3(0.06, 0.28, 0.56);
  vec3 sand       = vec3(0.79, 0.72, 0.48);
  vec3 lowland    = vec3(0.13, 0.46, 0.12);
  vec3 highland   = vec3(0.21, 0.56, 0.18);
  vec3 mountain   = vec3(0.48, 0.46, 0.40);
  vec3 snow       = vec3(0.92, 0.94, 0.98);

  vec3 surfaceColor;

  if (n < LAND_THRESH) {
    // ── LAUT ────────────────────────────────────────────
    float t = clamp((n + 0.6) / 0.7, 0.0, 1.0);
    surfaceColor = mix(deepOcean, shallowSea, t);

    // Specular highlight laut
    vec3  reflDir = reflect(-uLightDir, nrm);
    float spec    = pow(max(0.0, dot(reflDir, vViewDir)), 72.0);
    surfaceColor += vec3(0.55, 0.72, 1.0) * spec * 0.55;

  } else {
    // ── DARATAN — gradient ketinggian dari noise ─────────
    float t = clamp((n - LAND_THRESH) / 0.65, 0.0, 1.0);

    if      (t < 0.08) surfaceColor = mix(sand,     lowland,  t / 0.08);
    else if (t < 0.45) surfaceColor = mix(lowland,  highland, (t - 0.08) / 0.37);
    else if (t < 0.75) surfaceColor = mix(highland, mountain, (t - 0.45) / 0.30);
    else               surfaceColor = mix(mountain, snow,     (t - 0.75) / 0.25);

    float ridgeMask = smoothstep(0.42, 0.82, ridge + t * 0.22);
    surfaceColor = mix(surfaceColor, mountain, ridgeMask * 0.4);
  }

  // Tekstur bumi procedural sebagai warna dasar yang lebih realistis
  vec3 textureColor = pow(texture(uEarthTexture, vUV).rgb, vec3(0.96));
  surfaceColor = mix(surfaceColor, textureColor, 0.92);

  // ── Pencahayaan Directional (Matahari) ───────────────────
  float NdotL    = dot(nrm, uLightDir);
  float diffuse  = max(0.0, NdotL) * 1.18;
  float ambient  = 0.038;

  // Terminator siang/malam dengan transisi halus
  float terminator = smoothstep(-0.18, 0.18, NdotL);
  vec3  nightColor = surfaceColor * 0.015 + vec3(0.002, 0.004, 0.016);
  vec3  litColor   = surfaceColor * (ambient + diffuse * 1.08);
  vec3  finalColor = mix(nightColor, litColor, terminator);

  // Dorong sedikit saturasi agar detail permukaan lebih terbaca.
  finalColor = mix(finalColor, finalColor * vec3(1.0, 1.05, 1.1), 0.18);

  // Tambah kontras terminator supaya perbedaan siang dan malam lebih tegas.
  float terminatorRim = 1.0 - smoothstep(0.01, 0.28, abs(NdotL));
  finalColor += vec3(0.08, 0.12, 0.18) * terminatorRim * 0.12;

  // ── Lampu kota malam ─────────────────────────────────────
  // Dibuat dari noise halus agar sisi malam punya detail yang terbaca.
  float citySeeds = fbm(p * 4.2 + vec3(8.0, 3.0, 1.5));
  float cityMask  = smoothstep(-0.18, -0.72, NdotL);
  float cities    = smoothstep(0.28, 0.72, citySeeds) * cityMask;
  vec3  cityColor = vec3(1.00, 0.78, 0.34) * cities * 1.15;
  finalColor     += cityColor;

  // Rim lembut di sekitar garis terminator agar transisi siang-malam lebih terbaca
  float terminatorBand = 1.0 - smoothstep(0.03, 0.22, abs(NdotL));
  finalColor += vec3(0.10, 0.16, 0.24) * terminatorBand * 0.10;

  // ── Awan prosedural bergerak (diperkuat dengan area boost) ──
  if (uCloudEnabled > 0.5) {
    float cloudTime = uTime * 0.000010;
    vec3  cloudFlow = vec3(cloudTime * 0.75, cloudTime * 0.18, cloudTime * 0.12);
    float cloudBase = fbm(p * 0.55 + cloudFlow);
    float cloudDetail = fbm(p * 1.45 - cloudFlow * 0.45);
    float cloudMask = smoothstep(0.20, 0.50, cloudBase + cloudDetail * 0.24);
    cloudMask *= smoothstep(-0.20, 0.18, NdotL + 0.05);
    cloudMask *= 0.82 + 0.18 * smoothstep(0.0, 1.0, textureColor.g);

    vec3 cloudTex = texture(uCloudTexture, vUV).rgb;
    float cloudTexAlpha = texture(uCloudTexture, vUV).a;
    float cloudTextureMask = smoothstep(0.1, 0.8, dot(cloudTex, vec3(0.333))) * cloudTexAlpha;

    // Tambahan: buat awan lebih tebal di area tertentu sehingga Bumi terasa lebih hidup.
    float cloudSeed2 = fbm(p * 0.85 + vec3(2.3, -1.7, 4.1));
    float cloudBoost = smoothstep(0.42, 0.78, cloudSeed2) * 1.05;
    float latAbs = abs(normalize(vWorldPos).y);
    float equatorBoost = smoothstep(0.12, 0.48, 1.0 - latAbs);
    cloudMask += cloudBoost * 0.7 * equatorBoost;
    cloudMask = max(cloudMask, cloudTextureMask * (0.55 + cloudBoost * 0.35));
    cloudMask = clamp(cloudMask, 0.0, 1.0);

    vec3  cloudColor = vec3(0.98, 0.99, 1.0) * (ambient + diffuse * 1.05);
    // Di area yang di-boost, tingkatkan opasitas mix sehingga awan tampak jauh lebih tebal
    finalColor = mix(finalColor, cloudColor, cloudMask * (0.62 + cloudBoost * 0.42));
  }

  // ── Atmosfer (rim glow biru tipis) ───────────────────────
  // Fresnel: sudut miring dari arah pandang
  float fresnel  = pow(1.0 - max(0.0, dot(nrm, vViewDir)), 3.8);
  // Lebih cerah di sisi siang
  float atmLight = 0.16 + 0.84 * terminator;
  vec3  atmColor = vec3(0.14, 0.42, 1.00) * fresnel * 1.1 * atmLight;
  finalColor    += atmColor;

  // ── Tone mapping sederhana (Reinhard) ────────────────────
  finalColor = finalColor / (finalColor + vec3(1.0));
  finalColor = pow(finalColor, vec3(1.0 / 2.2)); // gamma

  fragColor = vec4(finalColor, 1.0);
}
`;
