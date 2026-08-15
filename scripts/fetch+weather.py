"""
fetch_weather.py
Fetches current conditions for La Quinta from Open-Meteo (no API key needed).
Writes output/weather.json for the dashboard to fetch.
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
    "&daily=temperature_2m_max,temperature_2m_min"
    "&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles"
)

WEATHER_CODES = {
    0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Fog", 51: "Light drizzle", 61: "Light rain",
    63: "Rain", 65: "Heavy rain", 71: "Snow", 80: "Rain showers",
    95: "Thunderstorm",
}

response = requests.get(URL, timeout=30)
response.raise_for_status()
data = response.json()

code = data["current"]["weather_code"]
payload = {
    "temp": round(data["current"]["temperature_2m"]),
    "high": round(data["daily"]["temperature_2m_max"][0]),
    "low": round(data["daily"]["temperature_2m_min"][0]),
    "conditions": WEATHER_CODES.get(code, "Unknown"),
    "updated": datetime.now(timezone.utc).isoformat(),
}

OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
with OUTPUT_FILE.open("w") as f:
    json.dump(payload, f, indent=2)

print(f"Wrote weather: {payload}")



