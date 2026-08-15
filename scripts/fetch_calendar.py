"""
fetch_calendar.py

Fetches today's Google Calendar events from a private iCal URL.
Outputs scripts/calendar_events.json for use by build_agenda.py.

Required environment variable:
GCAL_ICAL_URL
"""

import os
import json
import datetime

import pytz
import requests
from icalendar import Calendar
import recurring_ical_events


OUTPUT_FILE = "scripts/calendar_events.json"
TIMEZONE = "America/Los_Angeles"

ICAL_URL = os.environ.get("GCAL_ICAL_URL")

if not ICAL_URL:
raise RuntimeError("GCAL_ICAL_URL missing")


tz = pytz.timezone(TIMEZONE)
now = datetime.datetime.now(tz)

start = now.replace(
hour=0,
minute=0,
second=0,
microsecond=0
)

end = start + datetime.timedelta(days=1)

print(f"Fetching calendar for {now.strftime('%A, %B %d, %Y')} ...")

response = requests.get(
ICAL_URL,
timeout=30
)

response.raise_for_status()

calendar = Calendar.from_ical(response.content)

raw_events = recurring_ical_events.of(calendar).between(
start,
end
)

events = []

for event in raw_events:

dtstart = event.decoded("DTSTART")

if isinstance(dtstart, datetime.datetime):

if dtstart.tzinfo is None:
dtstart = tz.localize(dtstart)
else:
dtstart = dtstart.astimezone(tz)

time_str = dtstart.strftime("%I:%M %p")

else:
time_str = "All Day"

summary = str(
event.get("SUMMARY", "No title")
)

location = str(
event.get("LOCATION", "")
)

description = str(
event.get("DESCRIPTION", "")
)

events.append({
"time": time_str,
"summary": summary,
"location": location,
"description": description
})


def sort_key(item):

if item["time"] == "All Day":
return "00:00 AM"

return item["time"]


events.sort(
key=sort_key
)

with open(
OUTPUT_FILE,
"w",
encoding="utf-8"
) as f:

json.dump(
events,
f,
indent=2,
ensure_ascii=False
)

print(f"Found {len(events)} event(s)")
print(f"Calendar events written to {OUTPUT_FILE}")
