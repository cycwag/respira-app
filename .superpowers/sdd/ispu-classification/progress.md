# SDD ledger — plan: docs/superpowers/plans/2026-11-12-ispu-classification-and-map.md

Pre-flight: scan interfaces between Task 1 (CSV producer), Task 2 (ML model trainer), Task 3 (Express backend), and Task 4 (Next.js frontend). No blocker conflicts found.
Task 1: complete (Dataset riil SPKU DLH 2021-2022 diunduh dan dipreproses menjadi 1.796 baris data bersih)
Task 2: complete (3 Model dilatih: Random Forest 99.44% Akurasi / 98.76% F1, SVM 95.56%, Logistic Regression 95.28%)
Task 3: complete (Modul backend/src/ispuClassifier.js & GET /api/environment/regions terhubung ke Open-Meteo 5 titik SPKU)
Task 4: complete (Komponen JakartaAirMap.js SVG interaktif dengan hover & click terpasang di Next.js dashboard)
Task 5: complete (Kompilasi Next.js 14 lolos 100%, verifikasi end-to-end sukses, README.md diperbarui)
Ruling: Tidak mengembalikan confidence score pada respon API maupun UI sesuai arahan pengguna — fokus evaluasi status klasifikasi ISPU, nama stasiun, polutan dominan, dan saran kesehatan.
