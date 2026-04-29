const Shaders = {

  // ─── Earth ────────────────────────────────────────────────────────────────

  earthVert: `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aUV;

    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProjection;
    uniform mat3 uNormalMatrix;

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUV;

    void main() {
      vec4 worldPos = uModel * vec4(aPosition, 1.0);
      vPosition = worldPos.xyz;
      vNormal   = normalize(uNormalMatrix * aNormal);
      vUV       = aUV;
      gl_Position = uProjection * uView * worldPos;
    }
  `,

  earthFrag: `
    precision highp float;

    uniform sampler2D uEarthDay;
    uniform sampler2D uEarthNight;
    uniform vec3 uLightDir;
    uniform vec3 uCameraPos;

    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUV;

    void main() {
      vec3 n = normalize(vNormal);
      vec3 l = normalize(uLightDir);

      float diff = dot(n, l);                        // -1 .. 1
      float t    = smoothstep(-0.12, 0.12, diff);    // terminator blend

      vec4 dayColor   = texture2D(uEarthDay,   vUV);
      vec4 nightColor = texture2D(uEarthNight, vUV);

      // specular highlight on water (blueish texels)
      vec3 viewDir = normalize(uCameraPos - vPosition);
      vec3 halfVec = normalize(l + viewDir);
      float spec   = pow(max(dot(n, halfVec), 0.0), 64.0);
      float isWater = 1.0 - smoothstep(0.3, 0.5,
                        dayColor.r * 0.5 + dayColor.g * 0.3 - dayColor.b * 0.4);
      vec3 specColor = vec3(0.6, 0.7, 1.0) * spec * isWater * max(diff, 0.0);

      vec3 color = mix(nightColor.rgb * 0.6, dayColor.rgb, t) + specColor;

      // simple ambient
      color += dayColor.rgb * 0.04;

      gl_FragColor = vec4(color, 1.0);
    }
  `,

  // ─── Atmosphere ───────────────────────────────────────────────────────────

  atmosphereVert: `
    attribute vec3 aPosition;

    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProjection;

    varying vec3 vPosition;
    varying vec3 vNormal;

    void main() {
      vNormal   = normalize(aPosition);
      vec4 worldPos = uModel * vec4(aPosition, 1.0);
      vPosition = worldPos.xyz;
      gl_Position = uProjection * uView * worldPos;
    }
  `,

  atmosphereFrag: `
    precision highp float;

    uniform vec3 uCameraPos;
    uniform vec3 uLightDir;

    varying vec3 vPosition;
    varying vec3 vNormal;

    void main() {
      vec3 n = normalize(vNormal);
      vec3 v = normalize(uCameraPos - vPosition);
      vec3 l = normalize(uLightDir);

      float fresnel = 1.0 - max(dot(n, v), 0.0);
      fresnel = pow(fresnel, 3.5);

      float dayFactor = max(dot(n, l) + 0.3, 0.0);

      vec3 atmosColor = mix(vec3(0.1, 0.3, 0.9), vec3(0.5, 0.7, 1.0), dayFactor);
      float alpha = fresnel * 0.6 * (0.3 + dayFactor * 0.7);

      gl_FragColor = vec4(atmosColor, alpha);
    }
  `,

  // ─── Stars ────────────────────────────────────────────────────────────────

  starVert: `
    attribute vec3 aPosition;
    uniform mat4 uView;
    uniform mat4 uProjection;

    void main() {
      gl_Position  = uProjection * uView * vec4(aPosition, 1.0);
      gl_PointSize = 1.5 + fract(aPosition.x * 127.1 + aPosition.y * 311.7) * 1.5;
    }
  `,

  starFrag: `
    precision mediump float;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float alpha = 1.0 - smoothstep(0.4, 1.0, d);
      gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
    }
  `,

  // ─── Wireframe ────────────────────────────────────────────────────────────

  wireVert: `
    attribute vec3 aPosition;
    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProjection;

    void main() {
      gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
    }
  `,

  wireFrag: `
    precision mediump float;
    void main() {
      gl_FragColor = vec4(0.3, 0.8, 1.0, 0.35);
    }
  `
};
