"""
fetch_rss.py
Fetches the latest headlines from Fox News RSS feeds, prioritizing
Trump-related coverage at the top of the list.
Writes results to scripts/rss_headlines.json for the agenda builder.
"""

import json
import feedparser

LATEST_FEEDS = [
    "https://moxie.foxnews.com/google-publisher/latest.xml",
    "https://feeds.foxnews.com/foxnews/latest",
]
POLITICS_FEEDS = [
    "https://moxie.foxnews.com/google-publisher/politics.xml",
]
OUTPUT_FILE  = "scripts/rss_headlines.json"
MAX_ARTICLES = 10   # Number of top headlines to include

def try_feed(url: str):
    print(f"  Trying feed: {url}")
    feed = feedparser.parse(url)
    if feed.entries:
        print(f"  OK — {len(feed.entries)} entries found")
        return feed
    print("  No entries; trying next feed...")
    return None

def fetch_first_working(urls):
    for url in urls:
        feed = try_feed(url)
        if feed:
            return feed
    return None

latest_feed = fetch_first_working(LATEST_FEEDS)
politics_feed = fetch_first_working(POLITICS_FEEDS)

all_entries = []
if latest_feed:
    all_entries.extend(latest_feed.entries)
if politics_feed:
    all_entries.extend(politics_feed.entries)

if not all_entries:
    print("WARNING: Could not fetch any Fox News entries. Writing empty list.")
    headlines = []
else:
    # Dedupe by link, keeping first occurrence
    seen_links = set()
    deduped = []
    for entry in all_entries:
        link = entry.get("link", "")
        if link and link not in seen_links:
            seen_links.add(link)
            deduped.append(entry)

    # Bump Trump-related headlines to the front
    trump_entries = [e for e in deduped if "trump" in e.get("title", "").lower()]
    other_entries = [e for e in deduped if "trump" not in e.get("title", "").lower()]
    ordered = trump_entries + other_entries

    headlines = []
    for entry in ordered[:MAX_ARTICLES]:
        headlines.append({
            "title":   entry.get("title", "(No title)"),
            "link":    entry.get("link", ""),
            "summary": entry.get("summary", ""),
        })
    print(f"  Collected {len(headlines)} headlines ({len(trump_entries)} Trump-related)")

with open(OUTPUT_FILE, "w") as f:
    json.dump(headlines, f, indent=2)

print(f"  Saved to {OUTPUT_FILE}")
