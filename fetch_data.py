import json
import requests
import datetime
import pandas as pd
import pytz

# --- 設定 ---
# アメダス地点の定義ファイル（緯度経度などが含まれる）
TABLE_URL = "https://www.jma.go.jp/bosai/amedas/const/amedastable.json"

# --- 日時計算（過去24時間分を収集） ---
# ここでは過去24時間を1時間間隔で取得して、観測履歴として保存します。
HOURS = 24
now = datetime.datetime.now(pytz.timezone('Asia/Tokyo'))

def round_to_10min(dt: datetime.datetime) -> datetime.datetime:
    m = (dt.minute // 10) * 10
    return dt.replace(minute=m, second=0, microsecond=0)

# 取得する時刻リスト（最新から過去へ）
time_list = []
for h in range(0, HOURS + 1):
    t = now - datetime.timedelta(hours=h)
    t = round_to_10min(t)
    time_list.append(t)

print(f"Fetching data for {len(time_list)} timestamps from {time_list[-1]} to {time_list[0]}")

# --- データ取得 ---
try:
    # 1. 地点リストの取得
    resp_table = requests.get(TABLE_URL)
    resp_table.raise_for_status()
    table_data = resp_table.json()

    # 2. 各時刻の観測データを順次取得して、駅ごとの履歴を作る
    station_hist = {}  # station_id -> list of (time, temp)
    for t in time_list:
        time_str = t.strftime("%Y%m%d%H%M00")
        data_url = f"https://www.jma.go.jp/bosai/amedas/data/map/{time_str}.json"
        try:
            r = requests.get(data_url, timeout=10)
            if not r.ok:
                # 時刻に対応するデータがない場合もある
                # スキップして次へ
                # print(f"no data for {time_str}")
                continue
            obs = r.json()
        except Exception:
            continue

        for station_id, obs_item in obs.items():
            if "temp" not in obs_item:
                continue
            temp_list = obs_item.get("temp")
            if not temp_list or temp_list[0] is None:
                continue
            temp = temp_list[0]
            station_hist.setdefault(station_id, []).append({
                "time": t.isoformat(),
                "temp": temp
            })

    # --- 結果組み立て ---
    result_list = []

    for station_id, info in table_data.items():
        hist = station_hist.get(station_id, [])
        # 時系列を昇順に
        hist = sorted(hist, key=lambda x: x["time"]) if hist else []

        # 当日（nowの年月日）に該当する観測だけで日内極値を算出
        day_entries = [h for h in hist if datetime.datetime.fromisoformat(h["time"]).astimezone(pytz.timezone('Asia/Tokyo')).date() == now.date()]
        day_max = max([h["temp"] for h in day_entries]) if day_entries else None
        day_min = min([h["temp"] for h in day_entries]) if day_entries else None

        # 履歴全体からの最大/最小（簡易的な観測史）
        hist_max = max([h["temp"] for h in hist]) if hist else None
        hist_min = min([h["temp"] for h in hist]) if hist else None

        # 現在値は最新時刻の値を使う（履歴があれば）
        current = hist[-1]["temp"] if hist else None

        station_data = {
            "id": station_id,
            "name": info.get("kjName", "不明"),
            "lat": info.get("lat", [0, 0])[0] + info.get("lat", [0, 0])[1] / 60,
            "lon": info.get("lon", [0, 0])[0] + info.get("lon", [0, 0])[1] / 60,
            "current": current,
            "history": hist,
            "day_max": day_max,
            "day_min": day_min,
            "hist_max": hist_max,
            "hist_min": hist_min
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