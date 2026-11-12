"""
=============================================================================
RESPIRA ML - Pelatihan dan Komparasi Model Klasifikasi ISPU DKI Jakarta
Dataset: Data Riil Pengukuran SPKU Dinas Lingkungan Hidup DKI Jakarta (2021-2022)
Model: Random Forest vs Support Vector Machine (SVM) vs Logistic Regression
=============================================================================
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
import joblib

def load_real_dataset():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(base_dir, "data", "cleaned_ispu_dataset.csv")
    
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Dataset belum ditemukan di: {data_path}. Jalankan ml/preprocess.py terlebih dahulu.")
        
    df = pd.read_csv(data_path)
    return df

def train_and_evaluate():
    print("=" * 72)
    print("RESPIRA - PELATIHAN MODEL KLASIFIKASI ISPU DKI JAKARTA (DATASET RIIL)")
    print("=" * 72)
    
    # 1. Muat Dataset Riil
    print("\n[1/5] Memuat dataset riil dari ml/data/cleaned_ispu_dataset.csv...")
    df = load_real_dataset()
    print(f"Total Sampel Riil : {len(df)} baris")
    print("\nDistribusi Kelas Aktual (DLH DKI Jakarta):")
    print(df['category'].value_counts())
    
    features = ['pm25', 'pm10', 'so2', 'co', 'o3', 'no2']
    X = df[features]
    y = df['category_code']
    class_names = ["BAIK", "SEDANG", "TIDAK SEHAT"]
    
    # 2. Train-Test Split (80% Train, 20% Test, Stratified)
    print("\n[2/5] Membagi dataset (80% Data Latih, 20% Data Uji - Stratified)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"Data Latih (Train) : {len(X_train)} sampel")
    print(f"Data Uji (Test)    : {len(X_test)} sampel")
    
    # Scaling fitur untuk algoritma berbasis jarak (SVM & Logistic Regression)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # 3. Inisialisasi 3 Model Pembanding
    models = {
        "Random Forest Classifier": {
            "model": RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42),
            "use_scaled": False
        },
        "Support Vector Machine (SVM)": {
            "model": SVC(kernel='rbf', C=1.5, random_state=42),
            "use_scaled": True
        },
        "Logistic Regression": {
            "model": LogisticRegression(max_iter=1000, random_state=42),
            "use_scaled": True
        }
    }
    
    # 4. Pelatihan dan Evaluasi pada Data Riil
    print("\n[3/5] Melatih dan menguji 3 model pada data uji riil...")
    results = {}
    
    for name, config in models.items():
        print(f"\n---> Training: {name}...")
        m = config["model"]
        X_tr = X_train_scaled if config["use_scaled"] else X_train
        X_te = X_test_scaled if config["use_scaled"] else X_test
        
        m.fit(X_tr, y_train)
        y_pred = m.predict(X_te)
        
        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, average='macro', zero_division=0)
        rec = recall_score(y_test, y_pred, average='macro', zero_division=0)
        f1 = f1_score(y_test, y_pred, average='macro', zero_division=0)
        cm = confusion_matrix(y_test, y_pred).tolist()
        
        results[name] = {
            "model_obj": m,
            "use_scaled": config["use_scaled"],
            "accuracy": round(acc * 100, 2),
            "precision": round(prec * 100, 2),
            "recall": round(rec * 100, 2),
            "f1_score": round(f1 * 100, 2),
            "confusion_matrix": cm,
            "report": classification_report(y_test, y_pred, target_names=class_names, output_dict=True)
        }
        print(f"     Akurasi: {results[name]['accuracy']}% | F1-Score: {results[name]['f1_score']}%")
        
    # 5. Tabel Komparasi Hasil Eksperimen Riil
    print("\n" + "=" * 72)
    print("TABEL HASIL KOMPARASI MODEL MACHINE LEARNING (DATASET RIIL DKI JAKARTA)")
    print("=" * 72)
    print(f"{'Model':<30} | {'Akurasi':<10} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10}")
    print("-" * 76)
    for name, r in results.items():
        print(f"{name:<30} | {r['accuracy']:<9}% | {r['precision']:<9}% | {r['recall']:<9}% | {r['f1_score']:<9}%")
    print("=" * 72)
    
    best_name = max(results, key=lambda k: results[k]['f1_score'])
    best_result = results[best_name]
    print(f"\nModel Terbaik Terpilih: {best_name}")
    print(f"Skor Akurasi Riil      : {best_result['accuracy']}%")
    print(f"Skor F1-Score Riil     : {best_result['f1_score']}%")
    
    # 6. Simpan Model & Aturan Inferensi
    print("\n[4/5] Menyimpan model dan aturan evaluasi ke file...")
    ml_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Simpan binary model
    model_export_path = os.path.join(ml_dir, "ispu_model.joblib")
    joblib.dump({
        "model": best_result["model_obj"],
        "scaler": scaler if best_result["use_scaled"] else None,
        "features": features,
        "classes": class_names
    }, model_export_path)
    print(f"Model Joblib tersimpan di: {model_export_path}")
    
    # Simpan laporan evaluasi JSON untuk bukti laporan PBL
    report_json_path = os.path.join(ml_dir, "ispu_model_report.json")
    exportable = {
        name: {k: v for k, v in data.items() if k not in ["model_obj", "use_scaled"]}
        for name, data in results.items()
    }
    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(exportable, f, indent=2)
    print(f"Laporan Metrik Evaluasi tersimpan di: {report_json_path}")
    
    # Ekspor aturan baku mutu ISPU Permen LHK No. 14 Tahun 2020 untuk evaluasi instan di backend
    rules_json_path = os.path.join(ml_dir, "ispu_classifier_rules.json")
    backend_rules = {
        "best_model": best_name,
        "features": features,
        "classes": class_names,
        "metrics": {
            "accuracy": best_result["accuracy"],
            "f1_score": best_result["f1_score"],
            "precision": best_result["precision"],
            "recall": best_result["recall"]
        },
        "permen_lhk_thresholds": {
            "pm25": {"baik_max": 15.5, "sedang_max": 55.4},
            "pm10": {"baik_max": 50.0, "sedang_max": 100.0},
            "so2": {"baik_max": 50.0, "sedang_max": 180.0},
            "co": {"baik_max": 25.0, "sedang_max": 50.0},
            "o3": {"baik_max": 50.0, "sedang_max": 100.0},
            "no2": {"baik_max": 50.0, "sedang_max": 100.0}
        }
    }
    with open(rules_json_path, "w", encoding="utf-8") as f:
        json.dump(backend_rules, f, indent=2)
    print(f"Aturan Evaluasi Backend tersimpan di: {rules_json_path}")
    
    print("\n[5/5] Pelatihan & Evaluasi Dataset Riil Selesai 100%!")

if __name__ == "__main__":
    train_and_evaluate()
