import os
import pandas as pd
import numpy as np

def preprocess_ispu_data():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data")
    
    file_1 = os.path.join(data_dir, "ispu_2010_2021.csv")
    file_2 = os.path.join(data_dir, "ispu_2022.csv")
    
    print("=" * 60)
    print("RESPIRA - PREPROCESSING DATASET ISPU DKI JAKARTA")
    print("=" * 60)
    
    # 1. Load File 1 (2010 - 2021)
    print(f"\n[1/4] Membaca file 1: {file_1}...")
    df1 = pd.read_csv(file_1)
    print(f"Total baris awal file 1: {len(df1)}")
    
    # Filter rows that have PM2.5 measurements (PM2.5 started being widely measured in ~2020-2021)
    df1['pm25'] = pd.to_numeric(df1['pm25'], errors='coerce')
    df1 = df1.dropna(subset=['pm25'])
    print(f"Baris file 1 dengan PM2.5 valid: {len(df1)}")
    
    # Select columns
    df1_clean = pd.DataFrame({
        'pm25': df1['pm25'],
        'pm10': pd.to_numeric(df1['pm10'], errors='coerce'),
        'so2': pd.to_numeric(df1['so2'], errors='coerce'),
        'co': pd.to_numeric(df1['co'], errors='coerce'),
        'o3': pd.to_numeric(df1['o3'], errors='coerce'),
        'no2': pd.to_numeric(df1['no2'], errors='coerce'),
        'category_raw': df1['categori'].astype(str).str.strip().str.upper()
    })
    
    # 2. Load File 2 (2022)
    print(f"\n[2/4] Membaca file 2: {file_2}...")
    df2 = pd.read_csv(file_2, sep=';')
    print(f"Total baris awal file 2: {len(df2)}")
    
    # Fix comma decimals if any and numeric conversion
    for col in ['PM_25', 'PM_10', 'SO2', 'CO', 'O3', 'NO2']:
        if col in df2.columns:
            df2[col] = df2[col].astype(str).str.replace(',', '.')
    
    df2_clean = pd.DataFrame({
        'pm25': pd.to_numeric(df2['PM_25'], errors='coerce'),
        'pm10': pd.to_numeric(df2['PM_10'], errors='coerce'),
        'so2': pd.to_numeric(df2['SO2'], errors='coerce'),
        'co': pd.to_numeric(df2['CO'], errors='coerce'),
        'o3': pd.to_numeric(df2['O3'], errors='coerce'),
        'no2': pd.to_numeric(df2['NO2'], errors='coerce'),
        'category_raw': df2['Kategori'].astype(str).str.strip().str.upper()
    })
    
    # 3. Combine both real datasets
    print("\n[3/4] Menggabungkan kedua dataset...")
    df_combined = pd.concat([df1_clean, df2_clean], ignore_index=True)
    print(f"Total gabungan data: {len(df_combined)} baris")
    
    # Clean missing values in features using median per feature
    features = ['pm25', 'pm10', 'so2', 'co', 'o3', 'no2']
    for f in features:
        median_val = df_combined[f].median()
        df_combined[f] = df_combined[f].fillna(median_val)
        
    # Standardize category labels
    valid_categories = {'BAIK', 'SEDANG', 'TIDAK SEHAT'}
    df_final = df_combined[df_combined['category_raw'].isin(valid_categories)].copy()
    
    label_map = {
        'BAIK': 0,
        'SEDANG': 1,
        'TIDAK SEHAT': 2
    }
    df_final['category_code'] = df_final['category_raw'].map(label_map)
    df_final['category'] = df_final['category_raw']
    df_final = df_final.drop(columns=['category_raw'])
    
    # Round numerical features to 1 decimal place
    for f in features:
        df_final[f] = df_final[f].round(1)
        
    # 4. Save Cleaned Dataset
    output_path = os.path.join(data_dir, "cleaned_ispu_dataset.csv")
    df_final.to_csv(output_path, index=False)
    
    print("\n[4/4] Preprocessing Selesai!")
    print(f"File disimpan di: {output_path}")
    print(f"Total sampel bersih final: {len(df_final)} baris data riil")
    print("\nDistribusi Kelas Target:")
    print(df_final['category'].value_counts())
    print("\nStatistik Deskriptif Fitur Polutan:")
    print(df_final[features].describe().round(2))
    print("=" * 60)
    
    return df_final

if __name__ == "__main__":
    preprocess_ispu_data()
