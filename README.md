# Earth WebGL

Visualisasi 3D rotasi Bumi dan siklus siang-malam berbasis WebGL yang berjalan langsung di browser tanpa framework. Proyek ini menampilkan Bumi dengan kemiringan sumbu 23,5 derajat, transisi terminator siang-malam, atmosfer, awan prosedural, serta overlay arah Matahari dan sumbu rotasi.

## Tujuan Proyek

- Menyimulasikan konsep rotasi Bumi secara visual dan interaktif.
- Menunjukkan hubungan sudut datang cahaya Matahari dengan area siang-malam.
- Menjadi contoh implementasi WebGL modular untuk pembelajaran grafika komputer.

## Fitur Utama

- Render Bumi 3D dengan mesh UV sphere prosedural.
- Shader GLSL ES 300 dengan pencahayaan directional, terminator halus, rim atmosfer, dan city lights malam.
- Tekstur Bumi dan awan dihasilkan secara prosedural (tanpa aset gambar eksternal).
- Overlay 2D untuk arah Matahari dan sumbu rotasi.
- HUD status real-time untuk FPS dan sudut rotasi.
- Interaksi kamera orbit:
  - Drag untuk orbit 360 derajat
  - Scroll untuk zoom
  - Dukungan sentuh (drag dan pinch-to-zoom)
- Toggle UI untuk menyalakan atau mematikan arah Matahari, sumbu rotasi, dan awan.

## Stack Teknologi

- HTML5 Canvas
- WebGL 2.0
- GLSL ES 3.00
- JavaScript ES Modules
- CSS (UI overlay dan panel)

Tidak ada dependency npm wajib untuk menjalankan versi utama.

## Struktur Proyek

```text
earth-webgl/
├─ index.html
├─ integrator.js
├─ mesh.js
├─ shaders.js
├─ camera.js
├─ style.css
└─ src/
   ├─ main.js
   ├─ geometry.js
   ├─ shader.js
   ├─ camera.js
   ├─ texture.js
   └─ utils.js
```

### Catatan Struktur

- Entry utama aplikasi aktif ada di root: `index.html` memanggil `initApp()` dari `integrator.js`.
- Folder `src/` berisi varian atau eksperimen implementasi lain (arsitektur berbeda), bukan entry point default saat `index.html` dijalankan.

## Arsitektur Modul (Versi Utama)

### 1) mesh.js

Tanggung jawab:
- Membuat geometri UV sphere (`positions`, `normals`, `uvs`, `indices`).
- Menghasilkan tekstur Bumi prosedural (`generateEarthTexture`).
- Menghasilkan tekstur awan prosedural (`generateCloudTexture`).

Output modul ini diteruskan ke integrator untuk upload ke GPU.

### 2) shaders.js

Tanggung jawab:
- Menyediakan source vertex shader dan fragment shader.
- Vertex shader menangani transformasi model-view-projection dan normal.
- Fragment shader menangani:
  - Warna permukaan
  - Directional lighting
  - Terminator siang-malam
  - City lights malam
  - Atmosfer (fresnel rim)
  - Layer awan

### 3) camera.js

Tanggung jawab:
- Menyediakan kelas `EarthCamera`.
- Menghitung matriks model, view, projection, dan normal matrix.
- Menangani orbit camera (mouse atau touch), inertia, dan zoom.
- Mendefinisikan arah cahaya Matahari sebagai `LIGHT_DIR`.

### 4) integrator.js

Tanggung jawab:
- Inisialisasi WebGL2 context.
- Compile dan link shader program.
- Upload mesh ke GPU (VAO, VBO, IBO).
- Binding texture ke uniform sampler.
- Menjalankan render loop via `requestAnimationFrame`.
- Sinkronisasi UI (toggle button, HUD FPS/rotasi, overlay canvas).

## Alur Render Singkat

1. Inisialisasi canvas, context WebGL2, dan shader program.
2. Generate mesh sphere serta tekstur prosedural.
3. Upload buffer dan texture ke GPU.
4. Set global render state (depth test dan culling).
5. Tiap frame:
   - Update kamera dan matriks.
   - Clear frame buffer.
   - Set uniforms.
   - Draw sphere (`gl.drawElements`).
   - Gambar overlay 2D (arah Matahari dan sumbu rotasi jika aktif).

## Cara Menjalankan

Karena memakai ES Module, jalankan lewat local server (jangan langsung buka file HTML via `file://`).

### Opsi A: VS Code Live Server

1. Install extension Live Server.
2. Buka folder proyek di VS Code.
3. Klik kanan `index.html` -> Open with Live Server.

### Opsi B: Python HTTP Server

Di root proyek:

```bash
python -m http.server 5500
```

Lalu buka:

```text
http://localhost:5500
```

### Opsi C: Node (serve)

1. Install serve global:

```bash
npm i -g serve
```

2. Jalankan di root proyek:

```bash
serve -l 5500
```

3. Buka `http://localhost:5500`.

## Kontrol Interaksi

- Mouse drag: orbit kamera mengelilingi Bumi.
- Mouse wheel: zoom in/out.
- Touch drag: orbit kamera.
- Pinch (2 jari): zoom in/out.
- Tombol UI:
  - Arah Matahari: tampil atau sembunyi vektor cahaya.
  - Sumbu Rotasi: tampil atau sembunyi garis sumbu.
  - Awan: aktif atau nonaktif layer awan.

## Parameter Visual Penting

Beberapa parameter yang umum diubah:

- Kemiringan sumbu Bumi: `AXIS_TILT_DEG` pada `camera.js`
- Kecepatan rotasi otomatis: `AUTO_ROTATE` pada `camera.js`
- Arah cahaya Matahari: `SUN_DIR_RAW` dan `LIGHT_DIR` pada `camera.js`
- Kepadatan mesh sphere: `generateUVSphere(latBands, lonBands)` pada `integrator.js`
- Resolusi tekstur prosedural:
  - `generateEarthTexture(1024)`
  - `generateCloudTexture(1024)`

## Kompatibilitas

Minimum kebutuhan browser:
- Browser modern dengan dukungan WebGL 2.0

Umumnya kompatibel di:
- Chrome
- Edge
- Firefox
- Safari versi terbaru

Jika context WebGL2 gagal dibuat, cek:
- Driver GPU
- Hardware acceleration browser
- Dukungan WebGL di perangkat

## Troubleshooting

### Halaman kosong atau tidak tampil objek

- Pastikan membuka via local server, bukan file langsung.
- Cek DevTools Console untuk error shader compile/link.

### Error CORS atau module gagal load

- Biasanya karena membuka HTML langsung dari filesystem.
- Solusi: jalankan local server.

### Performa rendah

- Kurangi resolusi tekstur (misalnya 1024 menjadi 512).
- Turunkan segment mesh (misalnya 64 menjadi 48 atau 32).
- Tutup aplikasi berat lain yang memakai GPU.

### Interaksi sentuh terlalu sensitif

- Sesuaikan nilai sensitivitas handler input di `camera.js`.

## Pengembangan Lanjutan (Ide)

- Menambahkan simulasi seasonal (orbit semu Matahari terhadap Bumi).
- Menambah layer awan sebagai mesh sphere terpisah.
- Menambahkan post-processing sederhana untuk efek glow/city lights.
- Menampilkan garis lintang-bujur dan koordinat titik kursor.
- Menambah mode edukasi dengan anotasi naratif per adegan.

## Ringkasan Teknis

- Rendering utama: WebGL 2.0 + GLSL procedural shading.
- Geometri: UV sphere indexed drawing.
- UI: overlay HTML/CSS + canvas 2D anotasi.
- Dependency eksternal untuk pipeline render utama: tidak ada.

## Lisensi

Belum ada file lisensi khusus pada repository ini.
Jika proyek akan dipublikasikan, disarankan menambahkan LICENSE (misalnya MIT).
