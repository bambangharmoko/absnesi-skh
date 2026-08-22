# 🎓 Sistem Presensi Siswa Face Recognition Real-time
### SKH Santo Fransiskus Asisi (100% Full-Stack TypeScript + Supabase)

Aplikasi presensi berbasis kecerdasan buatan (*Face Recognition*) yang dirancang khusus untuk siswa berkebutuhan khusus di **SKH Santo Fransiskus Asisi**. Sistem ini dibangun **100% menggunakan TypeScript** dengan pengenalan wajah langsung di peramban (*client-side AI via WebGL/WASM*) dan database terpusat di **Supabase Cloud**.

---

## 🌟 Fitur Utama

- **⚡ Real-Time Face Recognition (60 FPS):** Pengenalan wajah instan di browser menggunakan `@vladmandic/face-api` (TensorFlow.js), tanpa lag pengiriman frame video ke server.
- **📱 PWA & Offline-First:** Kiosk absensi dapat dipasang sebagai aplikasi tablet/desktop mandiri dan tetap dapat mengenali wajah siswa saat offline.
- **☁️ Supabase Cloud Database:** Sinkronisasi data siswa, vektor fitur wajah, dan catatan presensi ke database PostgreSQL Supabase.
- **📊 Ekspor Laporan Excel:** Unduh laporan absensi harian, bulanan, atau per kelas langsung dalam format `.xlsx`.
- **🔊 Audio & Celebration Feedback:** Sambutan suara ramah dan animasi konfeti saat siswa berhasil terverifikasi.

---

## 🛠️ Teknologi yang Digunakan

- **Frontend & App Core:** React 19 + TypeScript + Vite + TailwindCSS 4
- **AI Face Engine:** `@vladmandic/face-api` (TinyFaceDetector, FaceLandmarks68, 128-d FaceDescriptor)
- **Database & Cloud:** `@supabase/supabase-js` (Supabase PostgreSQL Cloud)
- **Icons & UI Effects:** Lucide React, Canvas-Confetti, Framer Motion
- **Deployment:** Vercel Static Hosting

---

## 🚀 Cara Menjalankan di Komputer Lokal

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Jalankan Server Pengembangan
```bash
npm run dev
```
Buka peramban di **`http://localhost:5173/`**.

### 3. Build untuk Produksi
```bash
npm run build
```

---

## 📂 Struktur Direktori Proyek

```
Absensi-SKH/
├── frontend/                     # Aplikasi 100% TypeScript
│   ├── public/
│   │   ├── models/               # Bobot Model AI Wajah (TensorFlow.js)
│   │   └── manifest.webmanifest  # PWA Manifest
│   ├── src/
│   │   ├── components/           # Komponen Kiosk, Navbar, Audio
│   │   ├── pages/                # Halaman Kiosk, Siswa, Laporan
│   │   ├── services/
│   │   │   ├── faceApi.ts        # Layanan AI Deteksi & Vektor Wajah
│   │   │   ├── db.ts             # Layanan Database Siswa & Absensi
│   │   │   └── api.ts            # Unified Client API
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── package.json                  # Root Package Scripts
├── vercel.json                   # Konfigurasi Hosting Vercel
└── README.md
```

---

## 📄 Lisensi
Hak Cipta © 2026 SKH Santo Fransiskus Asisi. Dilisensikan di bawah MIT License.
