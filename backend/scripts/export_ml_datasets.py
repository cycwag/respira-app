"""
RESPIRA - Multi-Source Dataset Builder & Exporter
Builds separated datasets in ml/data/ from Dinkes Puskesmas API & Open-Meteo
"""
import os
import json
import urllib.request
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

JAKARTA_LAT = -6.2088
JAKARTA_LON = 106.8456

def fetch_open_meteo_year(year):
    print(f"Fetching Open-Meteo weather & air quality for {year}...")
    start_date = f"{year}-01-01"
    # for 2026, up to current date or end of year
    end_date = f"{year}-12-31" if year < 2026 else "2026-11-15"
    
    # 1. Weather archive/forecast
    if year < 2026:
        weather_url = (
            f"https://archive-api.open-meteo.com/v1/archive?"
            f"latitude={JAKARTA_LAT}&longitude={JAKARTA_LON}&timezone=Asia%2FJakarta&"
            f"start_date={start_date}&end_date={end_date}&"
            f"hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m"
        )
    else:
        # For 2026, forecast/recent API
        weather_url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={JAKARTA_LAT}&longitude={JAKARTA_LON}&timezone=Asia%2FJakarta&"
            f"start_date={start_date}&end_date={end_date}&"
            f"hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m"
        )
        
    req = urllib.request.Request(weather_url, headers={'User-Agent': 'RESPIRA-ML/1.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        weather_data = json.loads(resp.read().decode('utf-8'))

    # 2. Air quality
    air_url = (
        f"https://air-quality-api.open-meteo.com/v1/air-quality?"
        f"latitude={JAKARTA_LAT}&longitude={JAKARTA_LON}&timezone=Asia%2FJakarta&"
        f"start_date={start_date}&end_date={end_date}&hourly=pm2_5"
    )
    req_air = urllib.request.Request(air_url, headers={'User-Agent': 'RESPIRA-ML/1.0'})
    with urllib.request.urlopen(req_air, timeout=30) as resp:
        air_data = json.loads(resp.read().decode('utf-8'))

    w_hourly = weather_data['hourly']
    a_hourly = air_data['hourly']

    df_year = pd.DataFrame({
        'time': w_hourly['time'],
        'temperature': w_hourly['temperature_2m'],
        'humidity': w_hourly['relative_humidity_2m'],
        'rainfall': w_hourly['precipitation'],
        'windSpeed': w_hourly['wind_speed_10m'],
        'pm25': a_hourly['pm2_5']
    })
    return df_year

print("Script template ready")
