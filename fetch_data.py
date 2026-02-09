import json
import requests
import datetime
import pandas as pd
import pytz

# --- 設定 ---
# アメダス地点の定義ファイル（緯度経度などが含まれる）
TABLE_URL = "https://www.jma.go.jp/bosai/amedas/const/amedastable.json"

# --- 日時計算（最新の観測データを探す） ---
# 気象庁のデータは「10分ごと」に更新されます。
# 現在時刻から少し戻って、確実にあるデータ（例えば20分前のデータ）を狙います。
now = datetime.datetime.now(pytz.timezone('Asia/Tokyo'))
delta = datetime.timedelta(minutes=20)
target_time = now - delta

# 分を10分単位に丸める（例: 14:38 -> 14:30）
rounded_minute = (target_time.minute // 10) * 10
target_time = target_time.replace(minute=rounded_minute, second=0, microsecond=0)

# URL用にフォーマット（例: 20260209190000）
time_str = target_time.strftime("%Y%m%d%H%M00")
DATA_URL = f"https://www.jma.go.jp/bosai/amedas/data/map/{time_str}.json"

print(f"Fetching data for: {time_str}")

# --- データ取得 ---
try:
    # 1. 地点リストの取得
    resp_table = requests.get(TABLE_URL)
    resp_table.raise_for_status()
    table_data = resp_table.json()

    # 2. 観測データの取得
    resp_data = requests.get(DATA_URL)
    resp_data.raise_for_status()
    obs_data = resp_data.json()

    # --- データ結合 ---
    result_list = []

    for station_id, info in table_data.items():
        # "temp"（気温）のデータがある地点のみ処理
        if station_id in obs_data and "temp" in obs_data[station_id]:
            temp_list = obs_data[station_id]["temp"]
            
            # temp_list は [気温, 品質フラグ] の形。品質フラグが0（正常）か確認しても良いが、今回は簡易的に取得。
            if temp_list and temp_list[0] is not None:
                current_temp = temp_list[0]
                
                # 必要な情報だけを辞書にする
                station_data = {
                    "id": station_id,
                    "name": info.get("kjName", "不明"),  # 日本語名
                    "lat": info.get("lat", [0, 0])[0] + info.get("lat", [0, 0])[1] / 60, # 度分を度に変換
                    "lon": info.get("lon", [0, 0])[0] + info.get("lon", [0, 0])[1] / 60,
                    "current": current_temp
                }
                result_list.append(station_data)

    # --- JSONファイルとして保存 ---
    with open("weather_data.json", "w", encoding="utf-8") as f:
        json.dump(result_list, f, ensure_ascii=False, indent=2)

    print(f"Success! Saved {len(result_list)} stations.")

except Exception as e:
    print(f"Error: {e}")
    # エラー時は空のリストなどは作らず、前のファイルを残すか、何もしない
    exit(1)