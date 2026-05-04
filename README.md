# 🌍 Earth WebGL — Realistic 3D Visualization

Visualisasi 3D Bumi yang sangat realistis dengan rotasi aksial dan siklus siang-malam, berjalan langsung di browser menggunakan WebGL tanpa framework eksternal. Proyek ini menampilkan Bumi dengan kemiringan sumbu 23,5°, transisi terminator siang-malam yang halus, atmosfer dinamis, awan prosedural, dan city lights di sisi malam yang terang dan jelas.

## 🎯 Tujuan Proyek

- Menyimulasikan rotasi Bumi dan siklus siang-malam secara visual dan interaktif dengan akurasi geografis tinggi.
- Menunjukkan hubungan antara sudut datang cahaya Matahari dengan distribusi siang-malam global.
- Menampilkan geografis Bumi yang realistis: benua, pulau, continental shelf, dan topografi terrain.
- Menjadi contoh implementasi WebGL modular untuk pembelajaran grafika komputer dan procedural generation.

## ✨ Fitur Utama

### Rendering & Visual

- **Bumi 3D realistis** dengan mesh UV sphere prosedural dan resolusi tinggi.
- **Tekstur Bumi prosedural** dengan komposisi geografis akurat:

  - Lautan dengan kedalaman multi-layer (deep → shelf → coastal)
  - Daratan dengan terrain realistis: hutan tropis, padang rumput, gurun, gunung berbatu, es kutub
  - 15+ benua dan pulau besar (Amerika, Eropa, Afrika, Asia, Australia, New Zealand, Greenland, British Isles, Iceland, Japan, Philippines, Indonesia, Madagascar, Caribbean, dsb.)

- **Shader GLSL dengan pencahayaan canggih:**

  - Directional lighting dari Matahari
  - Terminator siang-malam yang halus dan realistis
  - Fresnel rim lighting untuk atmosfer
  - **City lights malam** di daerah urban dengan warna kuning emas cerah (intensitas 1.15x)
  - Aurora borealis di kutub
  - Ambient lighting untuk detail sisi malam

- **Atmosfer dinamis** dengan rim lighting dan tinting siang/malam
- **Awan prosedural** dengan pola band dan swirl yang natural
- **Wireframe mode** untuk inspeksi geometri (transparent dengan garis putih)

### Interaksi & Kontrol

- **Kamera orbit interaktif:**
  - Mouse drag: orbit mengelilingi Bumi 360°
  - Mouse wheel: zoom smooth in/out
  - Touch drag: orbit mobile
  - Pinch (2 jari): zoom mobile
- **UI Toggle Controls:**
  - **Atmosfer**: Nyalakan/matikan atmosfer shell
  - **Awan**: Nyalakan/matikan cloud layer
  - **Bintang**: Nyalakan/matikan star field (3000 bintang)
  - **Wireframe**: Mode debug dengan garis mesh transparan
- **Speed Control:**

  - Tombol Lambat/Cepat: Ubah kecepatan rotasi (×0.05 sampai ×32)
  - Tombol Reset: Kembali ke kecepatan default (0.3x)

- **HUD Real-time:**
  - FPS display
  - Sudut rotasi Bumi (0°–360°)
  - Kemiringan aksial (23.5°)
  - Multiplier kecepatan rotasi

### Teknologi & Arsitektur

- **WebGL 1.0** dengan depth testing dan blending yang optimal
- **Procedural generation** untuk tekstur dan noise
- **Canvas texture generation** (1024×512 px) untuk Bumi dan awan
- **No external dependencies** — semuanya native JavaScript
- **Modular architecture** dengan pemisahan shader, mesh, camera, dan integrator

## 📋 Stack Teknologi

- **Rendering**: WebGL 1.0 (compatible & optimized)
- **Shading**: GLSL ES (built-in shader language)
- **Procedural**: Perlin-like noise (fbm2, noise2) + blob-based continent generation
- **Frontend**: HTML5 Canvas, CSS3, vanilla JavaScript ES6
- **No build tools**: Run directly in browser, no npm required

## 📁 Struktur Proyek

```text
earth-webgl/
├─ index.html              ← Entry point utama
├─ css/
│  └─ style.css           ← HUD styling dan overlay
├─ js/
│  ├─ integrator.js       ← Render loop, state management, texture generation
│  ├─ shaders.js          ← GLSL shader compilation & linking
│  ├─ mesh.js             ← Sphere & star mesh geometry builder
│  └─ camera.js           ← Camera control dan matrix calculations
├─ README.md              ← This file
```

## 🔧 Modul Arsitektur

### integrator.js — Core Render Engine

**Tanggung jawab utama:**

- Inisialisasi WebGL context dan state (depth test, blending)
- Compile & link shader programs (earth, atmosphere, cloud, wireframe, star, aurora)
- Generate canvas-based textures:
  - `generateEarthTextureCanvas()`: Procedural Bumi dengan 1024×512 pixels
  - `generateCloudTextureCanvas()`: Awan prosedural dengan pattern natural
- Upload mesh & texture ke GPU
- Manage render state dan uniforms
- Update rotation angle sesuai time delta dan speed multiplier
- UI binding: toggle buttons, speed control, HUD update
- Main loop via `requestAnimationFrame`

**Key functions:**

```javascript
continentField(u, v); // Blob-based continent placement
generateEarthTextureCanvas(); // Procedural Earth texture generation
generateCloudTextureCanvas(); // Procedural cloud texture generation
drawSphere(); // Render mesh dengan texture binding
drawAtmosphere(); // Render rim-lit atmosphere shell
drawClouds(); // Render cloud layer
drawWire(); // Render wireframe edges
drawStars(); // Render star field
```

### shaders.js — Graphics Pipeline

**Shader programs:**

1. **Earth (earthVS + earthFS)**

   - Vertex: Model-view-projection transform + normal matrix
   - Fragment: Texture sampling (uEarthMap), lighting, terminator, city lights, specular

2. **Atmosphere (atmVS + atmFS)**

   - Rim lighting dengan fresnel effect
   - Siang: biru terang, Malam: gelap dengan tinting

3. **Cloud (cloudVS + cloudFS)**

   - Texture sampling (uCloudMap)
   - Alpha blending dengan depth masking

4. **Wireframe (wireVS + wireFS)**

   - Draw sebagai lines instead of triangles
   - White color dengan transparency 0.18 alpha

5. **Star (starVS + starFS)**

   - Twinkle effect dengan sine wave
   - Point rendering untuk efisiensi

6. **Aurora (auroraVS + auroraFS)**
   - Procedural northern lights animation
   - Polar band + fbm waves

### mesh.js — Geometry Builder

**Functions:**

- `buildSphere(gl, stacks, slices)`: Generate UV sphere dengan normals & UVs
- `buildStars(gl, count, radius)`: Generate random star positions + colors

**Resolution:**

- Default: 64×64 sphere (4096 vertices)
- Atmosphere: 32×32 scaled 1.055x
- Cloud: 32×32 scaled 1.015x
- Stars: 3000 count

### camera.js — Navigation & Matrices

**Key components:**

- Axial tilt: 23.5° (true Bumi inclination)
- Orbit camera dengan drag/scroll interaction
- Matrix computations: projection, view, model, normal
- Sun direction vector: configurable angle

## 🚀 Cara Menjalankan

Proyek menggunakan ES6 modules, sehingga **harus dijalankan via HTTP server** (tidak support `file://` protocol).

### Option 1: VS Code Live Server (Recommended)

```bash
1. Install extension "Live Server" di VS Code
2. Right-click index.html → "Open with Live Server"
3. Otomatis buka di http://localhost:5500
```

### Option 2: Python HTTP Server

```bash
# Di root folder proyek
python -m http.server 5500

# Buka browser: http://localhost:5500
```

### Option 3: Node.js serve

```bash
npm i -g serve
serve -l 5500

# Buka: http://localhost:5500
```

## 🎮 Kontrol Interaksi

| Input                | Aksi                              |
| -------------------- | --------------------------------- |
| **Mouse Drag**       | Orbit kamera mengelilingi Bumi    |
| **Mouse Wheel**      | Zoom in/out smooth                |
| **Touch Drag**       | Orbit (mobile)                    |
| **Pinch (2 jari)**   | Zoom (mobile)                     |
| **Atmosfer button**  | Toggle atmosphere layer           |
| **Awan button**      | Toggle cloud layer                |
| **Bintang button**   | Toggle star field                 |
| **Wireframe button** | Toggle mesh wireframe debug view  |
| **◀ Lambat button**  | Kurangi kecepatan rotasi (÷1.5)   |
| **Cepat ▶ button**   | Tambah kecepatan rotasi (×1.5)    |
| **Reset button**     | Reset ke kecepatan default (0.3x) |

## 🎨 Fitur Visual Detail

### Komposisi Lautan

- **Deep Ocean**: RGB(4, 22, 72) — biru gelap untuk laut dalam
- **Mid Ocean**: RGB(8, 64, 148) — biru medium untuk kedalaman sedang
- **Continental Shelf**: RGB(12, 108, 196) — biru terang untuk papan benua
- **Bright Ocean**: RGB(18, 164, 228) — cyan terang untuk pantai tropis

### Komposisi Daratan

- **Rainforest**: RGB(18, 110, 36) — hijau gelap untuk hutan tropis
- **Grassland**: RGB(126, 140, 62) — hijau ceria untuk padang rumput
- **Desert/Plains**: RGB(172, 158, 76) — kuning untuk gurun & padang tandus
- **Mountains**: RGB(128, 116, 108) — abu-abu untuk pegunungan
- **Snow/Ice**: RGB(240, 244, 248) — putih cerah untuk kutub & puncak

### Pencahayaan Khusus

- **City Lights**: Warna kuning emas cerah di area terpencar (intensity 1.15)
- **Aurora**: Hijau-cyan biru dengan wave animation di kutub
- **Terminator**: Soft twilight tinting pada garis siang-malam
- **Coastal Glow**: Highlight halus di tepi benua

## 📊 Parameter Penting yang Dapat Diubah

Di `integrator.js`:

```javascript
// Tekstur resolution
const width = 1024;
const height = 512;

// Mesh resolution
const SPHERE_STACKS = 64;
const SPHERE_SLICES = 64;
const STAR_COUNT = 3000;

// Default kecepatan rotasi
state.rotSpeed = 0.3; // 1.0 = 1 putaran per 20 detik

// Color palettes untuk texture generation
// — lihat continentField() & generateEarthTextureCanvas()
```

Di `shaders.js`:

```javascript
// City lights intensity
const cityLights = cl * 1.15; // Multiplier brightness

// Atmosphere rim strength
const rim = pow(1.0 - dot(N, V), 3.2);

// Terminator softness
const day = smoothstep(-0.1, 0.18, sunN);
```

Di `camera.js`:

```javascript
const AXIS_TILT_DEG = 23.5; // Bumi axial tilt
```

## 🌐 Kompatibilitas Browser

**Minimum Requirements:**

- WebGL 1.0 support
- ES6 module support (modern browsers)
- Hardware GPU acceleration

**Tested On:**

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Notes:**

- Performa optimal di desktop dengan GPU dedicated
- Mobile: kecepatan bergantung pada GPU mobile (kurangi mesh resolution jika perlu)

## 🔍 Troubleshooting

### Halaman Blank / Tidak Ada Objek

```
✗ Kemungkinan: Buka HTML langsung via file://
✓ Solusi: Gunakan HTTP server (Live Server / python http.server)
```

### Module / CORS Error

```
✗ Kemungkinan: ES6 module require HTTPS atau HTTP
✓ Solusi: Jalankan lewat localhost server
```

### Shader Compile Error

```
✗ Kemungkinan: WebGL 1.0 tidak supported
✓ Solusi: Cek apakah GPU & browser support WebGL
Jalankan di console: gl.getParameter(gl.VERSION)
```

### Performa Lambat / FPS Rendah

```
✓ Opsi 1: Kurangi mesh resolution (64 → 48 atau 32)
✓ Opsi 2: Kurangi texture size (1024 → 512)
✓ Opsi 3: Disable stars / clouds / atmosphere
✓ Opsi 4: Tutup tab berat lain, restart browser
```

### Touch/Drag Terlalu Sensitif

```
✓ Sesuaikan di camera.js:
  - ORBIT_SPEED: Kecepatan orbit
  - ZOOM_SPEED: Kecepatan zoom
  - INERTIA_DAMPING: Perlambatan inertia
```

## 💡 Development Tips

### Debugging

- Buka DevTools → Console untuk error messages
- Buka DevTools → Performance untuk profiling FPS
- Toggle wireframe mode untuk inspect geometry

### Modifikasi Terrain

- Edit `continentField()` di integrator.js untuk tambah/ubah benua
- Sesuaikan `blob()` parameters untuk form kontrol
- Ubah fbm scales untuk detail coastline

### Warna Custom

- Ubah RGB arrays di `generateEarthTextureCanvas()` untuk palette custom
- Eksperimen dengan smoothstep thresholds untuk blending antar region

### Shader Tweaking

- Edit fragment shader di shaders.js untuk lighting changes
- Tweak `terrainHeight()`, `continentMask()`, `forestMask()` untuk terrain variation

## 🚀 Ide Pengembangan Lanjutan

- [ ] Seasonal orbit simulation (23.5° tilt terhadap ecliptic)
- [ ] Orbital mechanics simulator (Earth around Sun path)
- [ ] Rain/weather systems dengan dynamic cloud animation
- [ ] Latitude/longitude gridlines overlay
- [ ] Coordinate picker dengan click detection
- [ ] Time-lapse animation dengan timestamp
- [ ] Export screenshot sebagai PNG
- [ ] VR mode support (WebXR)
- [ ] Political boundaries & country labels
- [ ] Sea floor topography visualization

## 📝 Catatan Teknis

- **Rendering Pipeline**: Canvas 2D context + WebGL 1.0 blend
- **Texture Generation**: CPU-side canvas rasterization, GPU upload
- **Update Rate**: 60 FPS target via requestAnimationFrame
- **Memory**: ~10-15 MB untuk textures + buffers
- **No External Libraries**: Semua pure JavaScript

## 📄 Lisensi

Proyek ini belum memiliki lisensi resmi. Jika akan dipublikasikan atau didistribusikan, disarankan menambahkan LICENSE file (MIT, Apache 2.0, GPL, dll sesuai preferensi).
