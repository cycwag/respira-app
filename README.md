# RESPIRA — Sistem Peringatan Dini ISPA Berbasis Machine Learning

**Integrasi Regresi Linear Multivariat dan Weighted Scoring Model dalam Sistem Peringatan Dini ISPA untuk Mendukung Transformasi Kesehatan Nasional**

Proyek Problem-Based Learning (PBL) Mata Kuliah **Pembelajaran Mesin (Machine Learning)** — Program Studi Teknologi Rekayasa Komputer (2026).

---

## 👥 Tim Pengembang (Kelompok 1 / 3)
1. **Bagas Aditya Putra Rinaldi** (`J0404241080`)
2. **Syamil Abdillah** (`J0404241139`)
3. **Muhammad Kevin Almer** (`J0404241163`)

---

## 🏗️ Arsitektur & Teknologi
Aplikasi ini menggunakan arsitektur terpisah (*decoupled frontend-backend*) dengan scoring hybrid: model regresi eksternal dan Odds Ratio faktor internal. Model regresi baru aktif setelah artefak hasil training dan data lag kasus Dinkes tersedia.

* **Frontend**: Next.js 14 (App Router, JavaScript `.js`, Vanilla CSS Modules, HTML5 Canvas Particle System).
* **Backend**: Node.js + Express.js (REST API, Hybrid Scoring Engine, News Scraper & Reader View).
* **Database & Auth**: Supabase (PostgreSQL + Row Level Security + Supabase Auth).
* **Integrasi Data Eksternal**:
  - **Open-Meteo Weather API**: Data meteorologi real-time DKI Jakarta (Suhu, Kelembapan, Curah Hujan, Kecepatan Angin).
  - **Open-Meteo Air Quality API**: Konsentrasi polutan partikulat halus ($\text{PM}_{2.5}$) real-time.
  - **Health News Scraper**: Kurasi berita ISPA & polusi udara terkini dengan fitur *Reader View* bebas iklan.

---

## 📂 Struktur Direktori Proyek

```text
respira/
├── frontend/                   # Aplikasi Web Frontend (Next.js - Port 3000)
│   ├── app/
│   │   ├── page.js             # Halaman Login & Registrasi (Animasi Sliding Split-Screen)
│   │   ├── assessment/page.js  # Formulir Asesmen Klinis (TB, BB, BMI, Komorbid, Perokok)
│   │   └── dashboard/page.js   # Dashboard 3-Panel (Sidebar, Feed Utama, Detail Risiko)
│   ├── components/
│   │   ├── ParticleCanvas.js   # Animasi partikel udara & PM2.5 melayang
│   │   └── NewsModal.js        # Modal daftar berita & Reader View artikel
│   ├── public/assets/          # Aset ilustrasi & maskot paru-paru RESPIRA
│   ├── lib/api.js              # Client helper ke Backend API & Supabase
│   └── .env.local.example      # Template environment frontend
│
├── backend/                    # Server REST API & Mesin Kalkulasi (Express.js - Port 5000)
│   ├── src/
│   │   ├── index.js            # Entrypoint API, Auth, Rate Limiter, & Security Guards
│   │   ├── scoring.js          # Trainer/prediktor regresi & Weighted Scoring (60:40)
│   │   ├── weatherService.js   # Integrasi cuaca/PM2.5 live dan historis
│   │   ├── dinkesService.js    # Kasus ISPA rawat jalan Dinkes DKI
│   │   ├── newsService.js      # Scraper berita kesehatan & ekstraktor artikel
│   │   └── supabase.js         # Inisialisasi koneksi Supabase Client & Admin
│   ├── scripts/
│   │   ├── collect-dinkes-weekly.js # Koleksi kasus Dinkes per minggu
│   │   ├── build-regression-dataset.js # Join kasus dan lingkungan historis
│   │   └── train-regression.js # Training model dari dataset JSON
│   ├── test/
│   │   ├── scoring.test.js     # Tes training, prediksi, dan penggabungan skor
│   │   └── dinkesService.test.js # Tes periode Dinkes
│   └── .env.example            # Template environment backend
│
└── supabase/
    └── schema.sql              # Skema tabel PostgreSQL (profiles, risk_assessments) & RLS
```

---

## 🚀 Panduan Instalasi & Menjalankan di Lokal (Untuk Rekan Tim)

### 1. Prasyarat
Pastikan di komputer Anda sudah terpasang:
* **Node.js** (v18 atau lebih baru)
* **Git**

### 2. Clone Repositori
```bash
git clone <URL_REPOSITORI_GITHUB_ANDA>
cd respira
```

### 3. Konfigurasi Database Supabase
1. Buat proyek gratis di [supabase.com](https://supabase.com).
2. Buka menu **SQL Editor**, salin isi file `supabase/schema.sql`, lalu klik **Run**.
3. Ambil **Project URL**, **anon public key**, dan **service_role secret key** di menu *Project Settings -> API*.

### 4. Menyiapkan File Environment (`.env`)

#### A. Setup Environment Backend
Salin file `.env.example` di dalam folder `backend` menjadi `.env`:
```bash
cd backend
cp .env.example .env
```
Isi file `backend/.env` dengan kredensial Supabase Anda:
```env
PORT=5000
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

#### B. Setup Environment Frontend
Salin file `.env.local.example` di dalam folder `frontend` menjadi `.env.local`:
```bash
cd ../frontend
cp .env.local.example .env.local
```
Isi file `frontend/.env.local`:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

---

### 5. Menjalankan Aplikasi

Buka **2 terminal terpisah**:

**Terminal 1 — Jalankan Server Backend (Port 5000):**
```bash
cd backend
npm install
npm start
```

**Terminal 2 — Jalankan Aplikasi Frontend Next.js (Port 3000):**
```bash
cd frontend
npm install
npm run dev
```

Buka browser dan akses: **[http://localhost:3000](http://localhost:3000)**

---

## 🧠 Regresi Linear Multivariat & Weighted Scoring

Implementasi training OLS multi-output, prediksi, dan penggabungan skor berada di **`backend/src/scoring.js`**. Satu model dilatih dari enam input: PM2.5, empat parameter lingkungan lain (suhu, kelembapan, hujan, angin), dan total kasus Dinkes J00+J02+J06 dari minggu sebelumnya. Model yang sama menghasilkan tiga target sekaligus: kasus rawat jalan minggu berikutnya untuk J00, J02, dan J06. Secara teknis ini regresi linear multivariat (multiple input, multiple output), dengan satu matriks fitur dan tiga kolom target yang di-fit bersama. Untuk OLS standar, hasil koefisiennya setara dengan meng-fit setiap output terpisah; model ini tidak mengklaim mempelajari korelasi residual antar-kategori. Data kasus endpoint Dinkes merupakan agregat DKI, jadi variabel lingkungan juga menggunakan satu titik referensi Jakarta Pusat/Monas.

### Fitur model
| Nama Parameter | Satuan | Sumber Data |
| :--- | :--- | :--- |
| `pm25` | $\mu\text{g/m}^3$ | Open-Meteo Air Quality API |
| `temperature` | $^\circ\text{C}$ | Open-Meteo Weather API |
| `humidity` | $\%$ | Open-Meteo Weather API |
| `rainfall` | $\text{mm}$ | Open-Meteo Weather API |
| `windSpeed` | $\text{km/h}$ | Open-Meteo Weather API |
| `prevCases` | Jumlah kasus minggu sebelumnya | Dinkes DKI Jakarta |

Alur dataset menggunakan minggu penuh Senin-Minggu. Untuk setiap baris training, fitur lingkungan dan total kasus berasal dari satu minggu lengkap; target kasus berasal dari minggu tepat setelahnya. Fitur lingkungan mingguan adalah rata-rata PM2.5/suhu/kelembapan/kecepatan angin dan total curah hujan. Jika respons Open-Meteo memiliki cakupan kurang dari 90% untuk salah satu fitur, pembentukan dataset berhenti dengan error alih-alih mengisi atau mengasumsikan nilai. Contoh baris training:

```json
{
  "featurePeriodStart": "2023-06-05",
  "featurePeriodEnd": "2023-06-11",
  "targetPeriodStart": "2023-06-12",
  "targetPeriodEnd": "2023-06-18",
  "pm25": 42.8,
  "temperature": 29.4,
  "humidity": 78,
  "rainfall": 8.2,
  "windSpeed": 5.4,
  "prevCases": 1200,
  "j00Cases": 820,
  "j02Cases": 510,
  "j06Cases": 1082
}
```

Ambil data Dinkes per minggu penuh. Contoh pengambilan data tahun 2023 (tanggal mulai Senin dan tanggal akhir Minggu):

```bash
npm run collect:dinkes -- 2023-01-02 2023-12-31
npm run build:regression-dataset -- .\data\dinkes-weekly.json
npm run train:regression -- .\data\respira-regression-dataset.json
npm test
```

Collector memakai endpoint Dinkes yang sama dengan scraper awal, mengambil agregat rawat jalan dalam rentang mingguan, membatasi ukuran respons, memberi jeda setidaknya 1,1 detik antarpermintaan, dan menyimpan progres setelah setiap minggu. Maksimal 260 minggu per proses; kalau gagal, jalankan ulang dengan rentang yang sama untuk melanjutkan data yang belum terkumpul. Skrip pembangun dataset mengambil data lingkungan historis dari Open-Meteo dan memasangkan setiap minggu dengan minggu target berikutnya. Diperlukan beberapa minggu berurutan; untuk evaluasi yang lebih bermakna, kumpulkan setidaknya satu tahun data mingguan.

Training menghasilkan satu artefak multi-output `backend/models/respira-regression.json` (format model versi 3). Koefisien tiap fitur memetakan ke ketiga target dalam satu model, dan inference menghitung J00/J02/J06 dalam satu pemanggilan. Model juga menyimpan persentil ke-95 kasus training untuk masing-masing target sebagai skala faktor eksternal di weighted scoring; fallback placeholder lama tetap memakai skala tetapnya. Atur `RESPIRA_REGRESSION_MODEL_PATH=.\models\respira-regression.json` di `backend/.env`, lalu restart backend. Artefak versi sebelumnya tidak kompatibel dan perlu dibuat ulang lewat script training. Bila artefak itu dikonfigurasi, `/api/assess` otomatis mengambil kasus rawat jalan dari endpoint Dinkes dan rata-rata lingkungan dari minggu lengkap terakhir, lalu memprediksi jumlah kasus pada minggu berikutnya. Hasil API mencantumkan `regressionInput`, periode prediksi, dan `regressionModelStatus`. Jika model belum dikonfigurasi, dashboard tetap berada di mode placeholder. Jika model sudah dikonfigurasi tetapi Dinkes/Open-Meteo gagal, asesmen mengembalikan error—tidak diam-diam menyajikan placeholder sebagai hasil model.

Sebelum dipakai, evaluasi model pada minggu-minggu yang lebih baru dari data training (bukan pembagian acak), dan bandingkan MAE/RMSE tiap target dengan baseline kasus minggu sebelumnya.

### Faktor internal & Odds Ratio (Tabel 3.2 Proposal)
| Faktor Risiko Individu | Kondisi | Nilai Odds Ratio (OR) | Referensi |
| :--- | :--- | :--- | :--- |
| **BMI Underweight** | $\text{BMI} < 18.5\text{ kg/m}^2$ | $2.14$ | Hammond et al. (2021) |
| **Jenis Kelamin** | Laki-laki (`male`) | $1.30$ | Hammond et al. (2021) |
| **Penyakit Ginjal Kronis** | Ya (`true`) | $1.47$ | Hammond et al. (2021) |
| **Penyakit Hati Kronis** | Ya (`true`) | $1.30$ | Hammond et al. (2021) |
| **Perokok Aktif** | Ya (`true`) | $1.25$ | Cal et al. (2019) |

Regresi menghasilkan estimasi kasus mingguan untuk 3 sub-kategori ICD-10 ISPA:
* **`J00`**: *Acute nasopharyngitis (common cold)*
* **`J02`**: *Acute pharyngitis*
* **`J06`**: *Acute upper respiratory infections of multiple and unspecified sites*

Hasil regresi eksternal dan skor Odds Ratio internal diteruskan ke **Weighted Scoring Model** (rasio bobot saat ini **60% Eksternal : 40% Internal**) untuk menghasilkan skor risiko. Skor ini adalah skor berbasis aturan dan belum dikalibrasi sebagai probabilitas medis.

### 4. Model Klasifikasi Kualitas Udara (ISPU 5 Wilayah DKI Jakarta)
Selain model regresi kasus, sistem dilengkapi model **Multiclass Classification** untuk mengevaluasi kualitas udara 5 wilayah administratif DKI Jakarta (Permen LHK No. 14 Tahun 2020):
* **Dataset Latih**: Data riil SPKU Dinas Lingkungan Hidup DKI Jakarta 2021-2022 (`ml/data/cleaned_ispu_dataset.csv`).
* **Algoritma Terlatih**: Random Forest Classifier (Akurasi: **99.44%**, F1-Score: **98.76%**), SVM, dan Logistic Regression.
* **Fitur Input**: $\text{PM}_{2.5}$, $\text{PM}_{10}$, $\text{SO}_2$, $\text{CO}$, $\text{O}_3$, dan $\text{NO}_2$.
* **Target Kelas**: `BAIK` (Hijau), `SEDANG` (Kuning), `TIDAK SEHAT` (Merah).
* **Integrasi UI**: Peta Vektor SVG Interaktif 5 Wilayah dengan tooltip polutan saat di-hover dan sinkronisasi rincian stasiun SPKU saat di-klik.

---

## 📡 Daftar Endpoint REST API Backend (`Port 5000`)

| Endpoint | Method | Deskripsi |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Cek status kesehatan server backend |
| `/api/auth/register` | `POST` | Registrasi akun baru ke Supabase Auth & inisialisasi profil |
| `/api/auth/login` | `POST` | Autentikasi pengguna & pengambilan sesi profil |
| `/api/profile/:id` | `GET` | Mengambil data profil klinis pengguna (memerlukan Bearer Token) |
| `/api/profile` | `POST` | Menyimpan/memperbarui data TB, BB, BMI, & komorbid pengguna |
| `/api/environment` | `GET` | Mengambil data cuaca & $\text{PM}_{2.5}$ live DKI Jakarta |
| `/api/environment/history` | `GET` | Mengambil data historis cuaca & $\text{PM}_{2.5}$ 7 hari terakhir |
| `/api/environment/regions` | `GET` | Mengambil status klasifikasi ISPU 5 wilayah administratif DKI Jakarta (Live) |
| `/api/assess` | `POST` | Menjalankan kalkulasi hybrid risiko ISPA & menyimpan riwayat |
| `/api/news` | `GET` | Mengambil daftar kurasi berita ISPA terkini |
| `/api/news/detail` | `GET` | Mengekstrak isi artikel lengkap untuk tampilan *Reader View* |
