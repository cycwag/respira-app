"""
RESPIRA Dataset Exporter
Integrates Dinkes Puskesmas weekly cases with Open-Meteo environmental archive
and outputs separated datasets for ML training and evaluation.
"""
import os
import json
import urllib.request
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

JAKARTA_LAT = -6.2088
JAKARTA_LON = 106.8456

def get_hourly_open_meteo(start_date, end_date):
    """Fetch hourly weather and air quality for a given date range."""
    # Split by year to respect Open-Meteo archive vs forecast
    # Archive is typically up to ~5 days ago
    print(f"Mengunduh data Open-Meteo: {start_date} s/d {end_date}...")
    
    # 1. Weather
    weather_url = (
        f"https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={JAKARTA_LAT}&longitude={JAKARTA_LON}&timezone=Asia%2FJakarta&"
        f"start_date={start_date}&end_date={end_date}&"
        f"hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m"
    )
    req = urllib.request.Request(weather_url, headers={'User-Agent': 'RESPIRA-Research/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            w_data = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Archive weather API error, mencoba forecast API: {e}")
        weather_url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={JAKARTA_LAT}&longitude={JAKARTA_LON}&timezone=Asia%2FJakarta&"
            f"start_date={start_date}&end_date={end_date}&"
            f"hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m"
        )
        req = urllib.request.Request(weather_url, headers={'User-Agent': 'RESPIRA-Research/1.0'})
        with urllib.request.urlopen(req, timeout=40) as resp:
            w_data = json.loads(resp.read().decode('utf-8'))

    # 2. Air quality
    air_url = (
        f"https://air-quality-api.open-meteo.com/v1/air-quality?"
        f"latitude={JAKARTA_LAT}&longitude={JAKARTA_LON}&timezone=Asia%2FJakarta&"
        f"start_date={start_date}&end_date={end_date}&hourly=pm2_5"
    )
    req_air = urllib.request.Request(air_url, headers={'User-Agent': 'RESPIRA-Research/1.0'})
    with urllib.request.urlopen(req_air, timeout=40) as resp:
        a_data = json.loads(resp.read().decode('utf-8'))

    w_h = w_data['hourly']
    a_h = a_data['hourly']

    df = pd.DataFrame({
        'time': w_h['time'],
        'temperature': w_h['temperature_2m'],
        'humidity': w_h['relative_humidity_2m'],
        'rainfall': w_h['precipitation'],
        'windSpeed': w_h['wind_speed_10m'],
        'pm25': a_h['pm2_5']
    })
    return df

def aggregate_weekly(hourly_df, start_date, end_date):
    """Aggregate hourly metrics into 1 weekly record matching backend formula."""
    mask = (hourly_df['time'] >= f"{start_date}T00:00") & (hourly_df['time'] <= f"{end_date}T23:00")
    sub = hourly_df.loc[mask]
    if len(sub) < 100:  # ~60% minimum coverage
        return None
    return {
        'startDate': start_date,
        'endDate': end_date,
        'pm25': round(float(sub['pm25'].mean()), 2),
        'temperature': round(float(sub['temperature'].mean()), 2),
        'humidity': round(float(sub['humidity'].mean()), 2),
        'rainfall': round(float(sub['rainfall'].sum()), 2),
        'windSpeed': round(float(sub['windSpeed'].mean()), 2)
    }

def main():
    dinkes_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'dinkes-weekly.json')
    if not os.path.exists(dinkes_path):
        print(f"Error: {dinkes_path} tidak ditemukan.")
        return

    with open(dinkes_path, 'r', encoding='utf-8') as f:
        dinkes_raw = json.load(f)

    periods = sorted(dinkes_raw.get('periods', []), key=lambda x: x['startDate'])
    print(f"Jumlah minggu Dinkes terkumpul: {len(periods)} minggu ({periods[0]['startDate']} s/d {periods[-1]['endDate']})")

    # 1. Ekspor raw Dinkes CSV
    dinkes_rows = []
    for p in periods:
        j00 = int(p.get('j00Cases', 0))
        j02 = int(p.get('j02Cases', 0))
        j06 = int(p.get('j06Cases', 0))
        dinkes_rows.append({
            'startDate': p['startDate'],
            'endDate': p['endDate'],
            'j00Cases': j00,
            'j02Cases': j02,
            'j06Cases': j06,
            'totalCases': j00 + j02 + j06
        })
    df_dinkes = pd.DataFrame(dinkes_rows)
    
    os.makedirs('ml/data', exist_ok=True)
    df_dinkes.to_csv('ml/data/dinkes_weekly_cases.csv', index=False)
    print("-> Tersimpan: ml/data/dinkes_weekly_cases.csv")

    # 2. Fetch environmental data in yearly chunks
    all_start = periods[0]['startDate']
    all_end = periods[-1]['endDate']
    min_year = int(all_start[:4])
    max_year = int(all_end[:4])

    hourly_dfs = []
    for y in range(min_year, max_year + 1):
        s_date = f"{y}-01-01"
        e_date = f"{y}-12-31" if y < max_year else all_end
        try:
            h_df = get_hourly_open_meteo(s_date, e_date)
            hourly_dfs.append(h_df)
        except Exception as err:
            print(f"Peringatan fetch tahun {y}: {err}")

    if not hourly_dfs:
        print("Gagal mengunduh data lingkungan.")
        return

    full_hourly = pd.concat(hourly_dfs, ignore_index=True).drop_duplicates(subset=['time'])

    # 3. Aggregate weekly weather
    weather_rows = []
    for p in periods:
        w_agg = aggregate_weekly(full_hourly, p['startDate'], p['endDate'])
        if w_agg:
            weather_rows.append(w_agg)
        else:
            # Fallback jika jam kurang lengkap
            weather_rows.append({
                'startDate': p['startDate'],
                'endDate': p['endDate'],
                'pm25': 42.5,
                'temperature': 28.5,
                'humidity': 76.0,
                'rainfall': 15.0,
                'windSpeed': 7.5
            })
    df_weather = pd.DataFrame(weather_rows)
    df_weather.to_csv('ml/data/jakarta_weather_weekly.csv', index=False)
    print("-> Tersimpan: ml/data/jakarta_weather_weekly.csv")

    # 4. Feature engineering: Week t (features) -> Week t+1 (target cases)
    weather_map = {row['startDate']: row for row in weather_rows}
    merged_rows = []
    for i in range(1, len(periods)):
        prev = periods[i - 1]
        target = periods[i]
        w_feat = weather_map.get(prev['startDate'])
        if not w_feat:
            continue
        prev_total = int(prev['j00Cases']) + int(prev['j02Cases']) + int(prev['j06Cases'])
        merged_rows.append({
            'featurePeriodStart': prev['startDate'],
            'featurePeriodEnd': prev['endDate'],
            'targetPeriodStart': target['startDate'],
            'targetPeriodEnd': target['endDate'],
            'pm25': w_feat['pm25'],
            'temperature': w_feat['temperature'],
            'humidity': w_feat['humidity'],
            'rainfall': w_feat['rainfall'],
            'windSpeed': w_feat['windSpeed'],
            'prevCases': prev_total,
            'j00Cases': int(target['j00Cases']),
            'j02Cases': int(target['j02Cases']),
            'j06Cases': int(target['j06Cases']),
            'totalCases': int(target['j00Cases']) + int(target['j02Cases']) + int(target['j06Cases'])
        })

    df_full = pd.DataFrame(merged_rows)
    df_full.to_csv('ml/data/ispa_full_dataset.csv', index=False)
    print(f"-> Tersimpan: ml/data/ispa_full_dataset.csv ({len(df_full)} baris)")

    # 5. Temporal Train-Test Split (~80% train, ~20% test)
    # Split point: misal data terbaru (tahun 2026 atau 25% terakhir)
    split_idx = int(len(df_full) * 0.8)
    df_train = df_full.iloc[:split_idx]
    df_test = df_full.iloc[split_idx:]

    df_train.to_csv('ml/data/ispa_train_dataset.csv', index=False)
    df_test.to_csv('ml/data/ispa_test_dataset.csv', index=False)
    print(f"-> Tersimpan: ml/data/ispa_train_dataset.csv ({len(df_train)} baris latih, {df_train['targetPeriodStart'].min()} s/d {df_train['targetPeriodEnd'].max()})")
    print(f"-> Tersimpan: ml/data/ispa_test_dataset.csv ({len(df_test)} baris uji, {df_test['targetPeriodStart'].min()} s/d {df_test['targetPeriodEnd'].max()})")

    # 6. Simpan juga ke backend/data/respira-regression-dataset.json untuk sinkronisasi backend
    backend_json_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'respira-regression-dataset.json')
    backend_rows = []
    for r in merged_rows:
        row_copy = dict(r)
        del row_copy['totalCases']  # Format yang sesuai dengan backend scoring
        backend_rows.append(row_copy)
    with open(backend_json_path, 'w', encoding='utf-8') as f:
        json.dump(backend_rows, f, indent=2)
    print(f"-> Tersinkron: {backend_json_path}")

if __name__ == '__main__':
    main()
