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
Aplikasi ini menggunakan arsitektur terpisah (*decoupled frontend-backend*) dengan pendekatan *Hybrid Machine Learning Scoring*:

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
│   │   └── dashboard/page.js   # Dashboard 3-Panel (Sidebar, Feed Utama, Detail Prediksi ML)
│   ├── components/
│   │   ├── ParticleCanvas.js   # Animasi partikel udara & PM2.5 melayang
│   │   └── NewsModal.js        # Modal daftar berita & Reader View artikel
│   ├── lib/api.js              # Client helper ke Backend API & Supabase
│   └── .env.local.example      # Template environment frontend
│
├── backend/                    # Server REST API & Mesin Kalkulasi (Express.js - Port 5000)
│   ├── src/
│   │   ├── index.js            # Entrypoint API, Auth, Rate Limiter, & Security Guards
│   │   ├── scoring.js          # Modul Regresi Linear Multivariat & Weighted Scoring (60:40)
│   │   ├── weatherService.js   # Integrasi satelit cuaca & PM2.5 DKI Jakarta
│   │   ├── newsService.js      # Scraper berita kesehatan & ekstraktor artikel
│   │   └── supabase.js         # Inisialisasi koneksi Supabase Client & Admin
│   └── .env.example            # Template environment backend
│
├── supabase/
│   └── schema.sql              # Skema tabel PostgreSQL (profiles, risk_assessments) & RLS
│
└── assets/                     # Aset ilustrasi & maskot paru-paru RESPIRA
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

## 🧠 Panduan Integrasi untuk Tim Machine Learning

Seluruh logika perhitungan risiko berada di file **`backend/src/scoring.js`**. Saat model regresi selesai dilatih menggunakan dataset Dinkes DKI Jakarta & Open-Meteo, tim ML cukup memperbarui fungsi `mockRegressionInference()` dengan koefisien hasil pelatihan ($\beta_0, \beta_1, \dots, \beta_6$):

### 1. Variabel Input Eksternal (Otomatis Disediakan Backend)
| Nama Parameter | Satuan | Sumber Data |
| :--- | :--- | :--- |
| `pm25` | $\mu\text{g/m}^3$ | Open-Meteo Air Quality API |
| `temperature` | $^\circ\text{C}$ | Open-Meteo Weather API |
| `humidity` | $\%$ | Open-Meteo Weather API |
| `rainfall` | $\text{mm}$ | Open-Meteo Weather API |
| `windSpeed` | $\text{km/h}$ | Open-Meteo Weather API |
| `prevCases` | Jumlah kasus | Historis Mingguan DKI Jakarta |

### 2. Variabel Faktor Internal & Odds Ratio (Tabel 3.2 Proposal)
| Faktor Risiko Individu | Kondisi | Nilai Odds Ratio (OR) | Referensi |
| :--- | :--- | :--- | :--- |
| **BMI Underweight** | $\text{BMI} < 18.5\text{ kg/m}^2$ | $2.14$ | Hammond et al. (2021) |
| **Jenis Kelamin** | Laki-laki (`male`) | $1.30$ | Hammond et al. (2021) |
| **Penyakit Ginjal Kronis** | Ya (`true`) | $1.47$ | Hammond et al. (2021) |
| **Penyakit Hati Kronis** | Ya (`true`) | $1.30$ | Hammond et al. (2021) |
| **Perokok Aktif** | Ya (`true`) | $1.25$ | Cal et al. (2019) |

### 3. Target Output Model Regresi
Model mengeluarkan estimasi kasus mingguan untuk 3 sub-kategori ICD-10 ISPA:
* **`J00`**: *Acute nasopharyngitis (common cold)*
* **`J02`**: *Acute pharyngitis*
* **`J06`**: *Acute upper respiratory infections of multiple and unspecified sites*

Hasil regresi eksternal dan skor Odds Ratio internal digabungkan menggunakan **Weighted Scoring Model** (rasio bobot default **60% Eksternal : 40% Internal**) untuk menghasilkan persentase kerentanan personal ($1\% - 99\%$).

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
| `/api/assess` | `POST` | Menjalankan kalkulasi hybrid risiko ISPA & menyimpan riwayat |
| `/api/news` | `GET` | Mengambil daftar kurasi berita ISPA terkini |
| `/api/news/detail` | `GET` | Mengekstrak isi artikel lengkap untuk tampilan *Reader View* |
