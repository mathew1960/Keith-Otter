"""
fetch_weather.py
Fetches current, hourly, and 5-day weather for La Quinta from Open-Meteo
(no API key needed). Writes output/weather.json for the dashboard to fetch.
"""
import json
import requests
from pathlib import Path
from datetime import datetime, timezone

OUTPUT_FILE = Path("output/weather.json")
LAT, LON = 33.6634, -116.31

URL = (
    "https://api.open-meteo.com/v1/forecast"
    f"?latitude={LAT}&longitude={LON}"
    "&current=temperature_2m,weather_code"
    "&hourly=temperature_2m,weather_code"
    "&daily=temperature_2m_max,temperature_2m_min,weather_code"
    "&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles"
    "&forecast_days=5"
)

WEATHER_CODES = {
    0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Fog", 51: "Light drizzle", 61: "Light rain",
    63: "Rain", 65: "Heavy rain", 71: "Snow", 80: "Rain showers",
    95: "Thunderstorm",
}

DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

response = requests.get(URL, timeout=30)
response.raise_for_status()
data = response.json()

code = data["current"]["weather_code"]

# Next 12 hours starting from now
now_iso = data["current"]["time"]
hourly_times = data["hourly"]["time"]
start_index = hourly_times.index(now_iso) if now_iso in hourly_times else 0

hourly = []
for t, temp, wcode in zip(
    hourly_times[start_index:start_index + 12],
    data["hourly"]["temperature_2m"][start_index:start_index + 12],
    data["hourly"]["weather_code"][start_index:start_index + 12],
):
    dt = datetime.fromisoformat(t)
    hourly.append({
        "time": dt.strftime("%-I %p"),
        "temp": round(temp),
        "conditions": WEATHER_CODES.get(wcode, "Unknown"),
    })

daily = []
for t, hi, lo, wcode in zip(
    data["daily"]["time"],
    data["daily"]["temperature_2m_max"],
    data["daily"]["temperature_2m_min"],
    data["daily"]["weather_code"],
):
    dt = datetime.fromisoformat(t)
    daily.append({
        "day": DAY_NAMES[dt.weekday()],
        "high": round(hi),
        "low": round(lo),
        "conditions": WEATHER_CODES.get(wcode, "Unknown"),
    })

payload = {
    "temp": round(data["current"]["temperature_2m"]),
    "high": daily[0]["high"],
    "low": daily[0]["low"],
    "conditions": WEATHER_CODES.get(code, "Unknown"),
    "updated": datetime.now(timezone.utc).isoformat(),
    "hourly": hourly,
    "daily": daily,
}

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
with OUTPUT_FILE.open("w") as f:
    json.dump(payload, f, indent=2)

print(f"Wrote weather: {payload['temp']}°F, {len(hourly)} hourly, {len(daily)} daily")
