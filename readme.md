# SPECIFICATION \& MASTER PROMPT: PENGEMBANGAN SISTEM ABSENSI SISWA FACE RECOGNITION BERBASIS WEB

**Studi Kasus:** SKH (Sekolah Khusus) Santo Fransiskus Asisi  
**Metode:** MediaPipe / MTCNN (Face Detection) + FaceNet / MobileFaceNet (Feature Extraction) + Cosine Similarity / SVM Classifier  
**Target Arsitektur:** FastAPI (Backend / Python Computer Vision) + React / Next.js / Tailwind CSS (Frontend) + SQLite/PostgreSQL

\---

## 📌 1. OVERVIEW \& TUJUAN PROYEK

Buatkan sebuah aplikasi sistem absensi siswa berbasis web interaktif (*web-based kiosk \& dashboard*) yang mengimplementasikan pengenalan wajah (*Face Recognition*) secara *real-time* via kamera/webcam.

### Karakteristik Khusus (Konteks SKH Santo Fransiskus Asisi):

1. **Multi-Frame Continuous Detection:** Siswa berkebutuhan khusus seringkali bergerak aktif dan tidak dapat menatap kamera tegak lurus secara diam. Sistem harus mampu menangkap *stream* video secara otomatis (analisis 3-5 frame per detik) dan mengambil frame dengan deteksi wajah terbaik tanpa mengharuskan penekanan tombol manual oleh siswa.
2. **Child-Friendly \& Interactive UI/UX:** Antarmuka kiosk absensi harus ramah anak, menampilkan *bounding box* visual yang dinamis, animasi kartu profil ketika wajah teridentifikasi, dan respons suara (*Text-to-Speech* / audio chime) *"Selamat Pagi, \[Nama Siswa]! Presensi kamu berhasil dicatat."*
3. **Teacher / Guardian Fallback:** Terdapat fitur kontrol wali kelas/guru pendamping untuk memvalidasi atau melakukan *manual override* presensi jika siswa membutuhkan pendampingan khusus.

\---

## 🛠 2. TECH STACK \& DEPENDENCIES

### Backend (Python 3.10+)

* **Web Framework:** FastAPI + Uvicorn (Asynchronous, performa tinggi untuk streaming/API).
* **Computer Vision \& ML Pipeline:**

  * `opencv-python-headless` (Pengolahan citra \& stream frame)
  * `mediapipe` atau `facenet-pytorch` (Deteksi \& alignment landmark wajah)
  * `deepface` ATAU model ONNX `MobileFaceNet` / `Inception-ResNet-v1` (Ekstraksi representasi embedding 128-d atau 512-d)
  * `scikit-learn` \& `scipy` (Cosine similarity, SVM classifier, k-NN matching)
  * `numpy`
* **Database \& ORM:** SQLAlchemy / SQLite (atau PostgreSQL), Alembic.
* **Reporting \& Export:** `openpyxl` (Export Excel), `reportlab` / `xhtml2pdf` (Export PDF).

### Frontend (Modern Web)

* **Framework:** Next.js (App Router) atau Vite + React 18 / TypeScript.
* **Styling \& UI:** Tailwind CSS, Lucide React Icons, Framer Motion (untuk animasi deteksi \& kartu berhasil).
* **Webcam Integration:** `react-webcam` atau HTML5 WebRTC API `<video>` + `<canvas>` overlay.
* **Audio:** Web Audio API \& Web Speech API (SpeechSynthesis) untuk feedback suara ramah anak.

\---

## 📂 3. ARSITEKTUR STRUKTUR DIREKTORI

```text
absensi-skh/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/
│   │   │   │   ├── auth.py
│   │   │   │   ├── students.py
│   │   │   │   ├── attendance.py
│   │   │   │   ├── recognition.py
│   │   │   │   └── reports.py
│   │   │   └── api\_router.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── db/
│   │   │   ├── database.py
│   │   │   └── models.py
│   │   ├── schemas/
│   │   │   ├── student\_schema.py
│   │   │   └── attendance\_schema.py
│   │   ├── services/
│   │   │   ├── face\_detector.py      # MediaPipe face detector \& landmark alignment
│   │   │   ├── face\_embedder.py      # FaceNet / MobileFaceNet feature extraction
│   │   │   ├── face\_matcher.py       # Cosine Similarity / SVM matcher
│   │   │   └── attendance\_service.py # Logika presensi \& pencegahan duplicate scan
│   │   └── main.py
│   ├── data/
│   │   ├── embeddings/               # Cache file pickle/json vektor wajah
│   │   └── student\_photos/           # Folder foto sampel siswa terdaftar
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── kiosk/
│   │   │   │   ├── CameraScanner.tsx # Stream kamera + canvas bounding box
│   │   │   │   ├── SuccessModal.tsx  # Pop-up animasi ramah anak saat berhasil
│   │   │   │   └── AudioFeedback.ts  # Trigger suara \& chime
│   │   │   ├── dashboard/
│   │   │   │   ├── LiveAttendanceFeed.tsx
│   │   │   │   ├── AttendanceTable.tsx
│   │   │   │   └── StudentRegisterModal.tsx
│   │   │   └── layout/
│   │   ├── hooks/
│   │   │   └── useWebcam.ts
│   │   ├── pages/ (atau app/)
│   │   │   ├── kiosk/page.tsx        # Halaman Kiosk Absensi Siswa
│   │   │   ├── dashboard/page.tsx    # Halaman Monitoring Guru \& Admin
│   │   │   ├── students/page.tsx     # Manajemen Siswa \& Pendaftaran Wajah
│   │   │   └── reports/page.tsx      # Laporan Rekapitulasi Presensi
│   │   ├── services/
│   │   │   └── api.ts
│   │   └── App.tsx
│   ├── package.json
│   └── tailwind.config.js
└── README.md
```

\---

## 🗄 4. SKEMA BASIS DATA (DATABASE SCHEMA)

Implementasikan skema database dengan tabel-tabel berikut:

1. **`users` (Akun Guru \& Admin):**

   * `id`: UUID / Integer (Primary Key)
   * `username`, `hashed\_password`, `full\_name`, `role` (`ADMIN`, `GURU\_KELAS`, `OPERATOR`)
2. **`students` (Data Siswa SKH):**

   * `id`: UUID / Integer (Primary Key)
   * `nis` / `nisn`: String (Unique)
   * `full\_name`: String
   * `nickname`: String (Nama panggilan untuk TTS audio)
   * `class\_name`: String (misal: "Kelas 1 Autis", "Kelas 3 Tunagrahita")
   * `category`: String (Kategori kebutuhan khusus/spesifikasi)
   * `is\_active`: Boolean
   * `created\_at`: DateTime
3. **`face\_embeddings` (Vektor Wajah Siswa):**

   * `id`: UUID / Integer (Primary Key)
   * `student\_id`: ForeignKey (`students.id`)
   * `embedding\_vector`: JSON / LargeBinary (Array float 128 atau 512 dimensi)
   * `photo\_path`: String (Path file foto referensi)
   * `created\_at`: DateTime
4. **`attendances` (Log Presensi Harian):**

   * `id`: UUID / Integer (Primary Key)
   * `student\_id`: ForeignKey (`students.id`)
   * `date`: Date (YYYY-MM-DD)
   * `time\_in`: Time / DateTime
   * `status`: Enum (`HADIR`, `TERLAMBAT`, `IZIN`, `SAKIT`, `ALPHA`)
   * `confidence\_score`: Float (Skor kemiripan wajah, misal: 0.92)
   * `verification\_method`: Enum (`FACE\_RECOGNITION`, `MANUAL\_TEACHER`)
   * `captured\_photo`: String (Snapshot foto saat absensi)
   * `notes`: Text (Catatan guru jika ada)

\---

## 🧠 5. PIPELINE FACE RECOGNITION (STEP-BY-STEP)

AI Agent harus mengimplementasikan pipeline berikut di `backend/app/services/`:

```
\[Webcam Frame (Base64/Stream)] 
          │
          ▼
\[1. Preprocessing \& Face Detection (MediaPipe / MTCNN)]
   - Ekstraksi bounding box (x, y, w, h)
   - Ekstraksi 5 facial landmarks (mata kiri, mata kanan, hidung, sudut mulut)
          │
          ▼
\[2. Alignment \& Normalization]
   - Rotasi \& crop wajah berdasarkan sudut kemiringan mata (alignment)
   - Resize ke dimensi standar model (misal: 160x160 px untuk FaceNet)
   - Normalisasi nilai piksel \[-1, 1] atau standar z-score
          │
          ▼
\[3. Feature Extraction (FaceNet / MobileFaceNet)]
   - Menghasilkan 512-dimensional embedding vector (L2 normalized)
          │
          ▼
\[4. Matching \& Verification]
   - Hitung Cosine Similarity / Euclidean Distance dengan database embedding
   - Aturan Keputusan:
     \* Similarity > 0.75 (Cosine) atau Distance < 0.6 (Euclidean) -> Wajah Teridentifikasi
     \* Similarity < 0.75 -> 'Unknown / Wajah Tidak Dikenali'
          │
          ▼
\[5. Anti-Spam \& Debounce Attendance Engine]
   - Cegah pencatatan ganda: Siswa yang sama tidak bisa absen dua kali dalam selang waktu < 1 jam
   - Konfirmasi multi-frame (harus terdeteksi konsisten minimal 2 dari 3 frame berurutan)
```

\---

## 💻 6. DETAIL FITUR \& ANTARMUKA PENGGUNA (UI/UX)

### A. Kiosk Mode Absensi (`/kiosk`)

* **Full-Screen Responsive Layout:** Tampilan bersih, kontras warna yang nyaman, tanpa tombol yang membingungkan siswa.
* **Live Video Box dengan Canvas Dynamic HUD:**

  * Kotak deteksi wajah berubah warna: Kuning (*Mencari Wajah*), Hijau (*Wajah Terverifikasi: \[Nama Siswa]*), Merah (*Tidak Dikenali*).
* **Celebration Card Popup:**

  * Saat absensi berhasil, muncul kartu animasi besar berisi foto siswa, nama panggilan, kelas, dan jam hadir.
  * Memutar efek suara ramah (*pleasant chime sound*) + Web Speech API bersuara ramah.
  * Kartu otomatis hilang dalam 3 detik untuk melayani antrean siswa berikutnya.

### B. Student Face Enrollment (`/students/register`)

* Alur pendaftaran wajah siswa baru:

  * Wizard multi-step: Isi Data Siswa -> Ambil 5 Foto Sampel (Lurus, Senyum, Sedikit Miring Kiri/Kanan, Menunduk sedikit).
  * Sistem otomatis mengekstrak embedding dari 5 foto dan menyimpan rata-rata (*centroid embedding*) ke database.

### C. Admin \& Teacher Dashboard (`/dashboard` \& `/reports`)

* **Live Attendance Counter:** Total Siswa, Hadir Hari Ini, Terlambat, Belum Hadir.
* **Filter Berdasarkan Kelas:** Mempermudah guru wali kelas memantau murid kelasnya masing-masing.
* **Manual Check-In Override:** Tombol cepat bagi guru untuk menandai hadir/izin jika siswa berhalangan scan wajah.
* **Export Data:** Tombol export laporan presensi ke format Excel (.xlsx) dan PDF harian/bulanan.

\---

## 📡 7. SPESIFIKASI REST API (ENDPOINTS UTAMA)

1. `POST /api/v1/recognition/verify-frame`

   * **Request:** `{ "image\_base64": "data:image/jpeg;base64,...", "class\_id": "optional" }`
   * **Response:**

```json
     {
       "status": "MATCHED",
       "student": {
         "id": "std-001",
         "name": "Budi Santoso",
         "nickname": "Budi",
         "class\_name": "Kelas 1 Autis"
       },
       "confidence": 0.89,
       "attendance\_status": "RECORDED\_SUCCESS",
       "time": "07:15:30",
       "message": "Selamat Pagi Budi, presensi berhasil dicatat!"
     }
     ```

2. `POST /api/v1/students/enroll-face`

   * **Request:** `multipart/form-data` (data siswa + 3-5 file gambar wajah)
   * **Response:** `{ "status": "SUCCESS", "embeddings\_extracted": 5, "student\_id": "std-001" }`
3. `GET /api/v1/attendance/today`

   * **Query:** `?class\_name=Kelas+1+Autis\&status=HADIR`
   * **Response:** List record presensi hari ini.
4. `POST /api/v1/attendance/manual-override`

   * **Request:** `{ "student\_id": "std-001", "status": "HADIR", "notes": "Didampingi Ibu Guru Ani" }`
5. `GET /api/v1/reports/export-excel`

   * **Query:** `?month=08\&year=2026\&class\_name=all`
   * **Response:** File stream `.xlsx`.

\---

## 🚀 8. PANDUAN MENJALANKAN APLIKASI (QUICK START)

### 1. Menjalankan Backend (FastAPI Python)

Aplikasi backend menggunakan Python 3.11 dan FastAPI dengan penyimpanan SQLite otomatis.

```bash
# Dari root direktori proyek (c:\beng\Absensi-SKH)
# Menggunakan portable python yang telah terpasang:
backend\python\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload

# Atau jika menggunakan Python sistem global:
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

* **Swagger API Docs:** `http://127.0.0.1:8000/docs`
* **Health Check Endpoint:** `http://127.0.0.1:8000/`

### 2. Menjalankan Frontend PWA (React + Vite + Tailwind CSS)

```bash
# Masuk ke direktori frontend
cd frontend

# Install dependensi (jika belum)
npm install

# Jalankan server pengembangan Vite
npm run dev

# Atau build bundle produksi PWA
npm run build
```

* **URL Aplikasi PWA Kiosk & Dashboard:** `http://localhost:5173/`

---

## 📱 FITUR PWA & KIOSK READY

1. **Instalasi PWA 1-Klik:** Klik tombol **"Install PWA"** di navbar untuk menginstal aplikasi sebagai standalone app di tablet / kiosk PC / layar sentuh sekolah.
2. **Kiosk Mode Absensi (`/kiosk`):**
   - Stream kamera continuous multi-frame (interval 450ms).
   - Dynamic HUD Canvas: 🟡 Kuning (mencari), 🟢 Hijau (terverifikasi), 🔴 Merah (tidak dikenali).
   - Suara chime Web Audio + Text-to-Speech bahasa Indonesia ramah anak (*"Selamat Pagi, [Nama Siswa]!"*).
   - Kartu animasi popup + confetti reward dengan auto-dismiss 3 detik.
   - Mode Simulasi Siswa untuk pengujian tanpa webcam fisik.
3. **Pendaftaran Wajah 5-Pose (`/students/register`):**
   - Wizard 3-langkah: Biodata -> Ambil 5 Pose (Lurus, Senyum, Miring Kiri, Miring Kanan, Menunduk) -> Ekstraksi centroid embedding 512-d ke SQLite.
4. **Dashboard Guru & Admin (`/dashboard`):**
   - Real-time attendance counters, live check-in stream, filter kelas, dan tombol Manual Check-in Override.
5. **Laporan Excel (`/reports`):**
   - Download rekap bulanan berformat Excel resmi (`.xlsx`) dengan pewarnaan kehadiran harian.

---

*Dokumen ini dibuat khusus untuk memandu dan mendokumentasikan sistem presensi Face Recognition berbasis PWA di SKH Santo Fransiskus Asisi.*

