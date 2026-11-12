# Model Klasifikasi ISPU 5 Wilayah & Peta Interaktif DKI Jakarta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun pipeline Machine Learning klasifikasi kualitas udara ISPU (Baik, Sedang, Tidak Sehat) menggunakan data riil stasiun SPKU DKI Jakarta (2021-2022) serta menyajikan visualisasi peta interaktif 5 wilayah di dashboard RESPIRA.

**Architecture:** Data historis riil SPKU diunduh dan dipreproses di Python (`ml/`), kemudian dilatih menggunakan 3 model (Random Forest, SVM, Logistic Regression) untuk evaluasi komparatif. Model klasifikasi terbaik diekspor ke aturan inferensi backend Express (`backend/src/ispuClassifier.js`) yang mengonsumsi live Open-Meteo Air Quality API untuk 5 koordinat wilayah DKI Jakarta. Frontend Next.js menampilkan peta vektor SVG interaktif 5 wilayah dengan efek hover data polutan dan klik sinkronisasi ke panel detail.

**Tech Stack:** Python 3.15, pandas, scikit-learn, Express.js (Node.js), Next.js 14, SVG Vector Map, Open-Meteo API.

**Spec:** `docs/superpowers/plans/2026-11-12-ispu-classification-and-map.md`

## Global Constraints
- Bahasa Python untuk training: Python 3 dengan `scikit-learn`, `pandas`, `numpy`.
- Dataset sumber riil: Data resmi ISPU Dinas Lingkungan Hidup DKI Jakarta (SPKU 1 s.d. 5) 2021-2022.
- Backend tidak mengembalikan confidence score, hanya evaluasi kategori status (`BAIK`, `SEDANG`, `TIDAK SEHAT`) beserta parameter polutan.
- Frontend Next.js murni JavaScript (`.js`) dan CSS murni sesuai arsitektur yang sudah berjalan.
- Server backend tetap di port 5000, Next.js di port 3000.

## Review Focus
- Penanganan nilai `NaN` atau data sensor yang kosong pada CSV historis tanpa merusak integritas kelas.
- Pembagian data latih (80%) dan data uji (20%) secara stratified.
- Skalabilitas penarikan 5 titik koordinat wilayah secara paralel dari Open-Meteo API.
- Responsivitas peta SVG interaktif pada layar desktop dan mobile.

---

### Task 1: Unduh Dataset Riil & Preprocessing Data ISPU DKI Jakarta

**Files:**
- Create: `ml/data/raw_ispu_dki.csv`
- Create: `ml/preprocess.py`
- Create: `ml/data/cleaned_ispu_dataset.csv`

**Interfaces:**
- Produces: Dataset CSV bersih dengan kolom `pm25`, `pm10`, `so2`, `co`, `o3`, `no2`, `category_code`, `category` siap latih.

- [ ] **Step 1: Unduh dataset riil CSV dari repositori resmi ke `ml/data/raw_ispu_dki.csv`**
- [ ] **Step 2: Buat skrip `ml/preprocess.py` untuk pembersihan missing value, konversi tipe numerik, dan pemfilteran data 2021-2022 yang memiliki sensor PM2.5 aktif**
- [ ] **Step 3: Jalankan `py -3 ml/preprocess.py` dan verifikasi data bersih tersimpan di `ml/data/cleaned_ispu_dataset.csv`**
- [ ] **Step 4: Cetak ringkasan distribusi kelas (BAIK, SEDANG, TIDAK SEHAT)**

---

### Task 2: Pelatihan dan Evaluasi 3 Model Klasifikasi (Random Forest vs SVM vs Logistic Regression)

**Files:**
- Modify: `ml/train_ispu_classifier.py`
- Produces: `ml/ispu_model.joblib`, `ml/ispu_model_report.json`, `ml/ispu_classifier_rules.json`

**Interfaces:**
- Consumes: `ml/data/cleaned_ispu_dataset.csv`
- Produces: Metrik evaluasi akurasi riil, F1-score, precision, recall, confusion matrix, dan aturan inferensi backend.

- [ ] **Step 1: Perbarui `ml/train_ispu_classifier.py` untuk membaca `ml/data/cleaned_ispu_dataset.csv` (bukan data sintetis)**
- [ ] **Step 2: Terapkan stratified train-test split (80% train, 20% test)**
- [ ] **Step 3: Latih Random Forest, SVM (RBF kernel), dan Logistic Regression**
- [ ] **Step 4: Evaluasi metrik performa riil dan cetak tabel komparasi**
- [ ] **Step 5: Ekspor model terbaik dan aturan inferensi ke `ml/ispu_classifier_rules.json`**

---

### Task 3: Modul Inferensi Backend & Endpoint 5 Wilayah DKI Jakarta

**Files:**
- Create: `backend/src/ispuClassifier.js`
- Modify: `backend/src/weatherService.js`
- Modify: `backend/src/index.js`

**Interfaces:**
- Produces: Endpoint `GET /api/environment/regions` yang mengembalikan status kualitas udara 5 wilayah Jakarta (Pusat, Utara, Barat, Selatan, Timur).

- [ ] **Step 1: Buat modul `backend/src/ispuClassifier.js` untuk mengevaluasi parameter polutan menjadi kategori ISPU**
- [ ] **Step 2: Di `backend/src/weatherService.js`, tambahkan fungsi `fetchJakarta5RegionsAirQuality()` yang menarik live data 5 titik koordinat SPKU dari Open-Meteo secara paralel**
- [ ] **Step 3: Di `backend/src/index.js`, daftarkan rute `GET /api/environment/regions` lengkap dengan in-memory cache 10 menit**
- [ ] **Step 4: Uji endpoint backend via HTTP request lokal dan pastikan 5 wilayah terisi status valid**

---

### Task 4: Komponen Peta Interaktif SVG Jakarta di Frontend Next.js

**Files:**
- Create: `frontend/components/JakartaAirMap.js`
- Modify: `frontend/lib/api.js`
- Modify: `frontend/app/globals.css`
- Modify: `frontend/app/dashboard/page.js`

**Interfaces:**
- Consumes: Data dari `getRegionsAirQuality()` via `GET /api/environment/regions`
- Produces: Peta vektor interaktif di tab "Cuaca & PM2.5" dengan hover tooltip dan event click.

- [ ] **Step 1: Tambahkan fungsi `getRegionsAirQuality()` di `frontend/lib/api.js`**
- [ ] **Step 2: Buat komponen `frontend/components/JakartaAirMap.js` dengan path poligon SVG 5 wilayah DKI Jakarta dan warna dinamis (Hijau/Kuning/Merah)**
- [ ] **Step 3: Tambahkan efek hover tooltip (menampilkan nama wilayah, stasiun, polutan utama, dan status ISPU)**
- [ ] **Step 4: Pasang interaksi klik yang mengubah wilayah aktif dan memperbarui rincian di panel kanan (Pane 3)**
- [ ] **Step 5: Sematkan komponen peta di dalam tab "Cuaca & PM2.5" di `frontend/app/dashboard/page.js`**

---

### Task 5: Kompilasi, Verifikasi End-to-End, dan Laporan Akhir

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Jalankan `npm run build` di `frontend/` untuk memastikan kompilasi Next.js sukses**
- [ ] **Step 2: Nyalakan kedua server (Express port 5000 & Next.js port 3000)**
- [ ] **Step 3: Lakukan uji fungsional: hover peta, klik tiap wilayah, pastikan sinkronisasi panel kanan berjalan mulus**
- [ ] **Step 4: Dokumentasikan model klasifikasi baru dan endpoint 5 wilayah di `README.md`**
