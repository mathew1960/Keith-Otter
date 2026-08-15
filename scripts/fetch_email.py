"""
fetch_email.py
Checks Gmail and SmarterMail via IMAP for the day's priority emails.
Filters to a short list of important senders/domains and writes the
top 4 most recent to output/email_watch.json for the dashboard.

Required environment variables:
GMAIL_USER, GMAIL_APP_PASSWORD
SMARTERMAIL_HOST, SMARTERMAIL_USER_NEW, SMARTERMAIL_PASS_NEW
"""
import imaplib
import email
from email.header import decode_header
from email.utils import parsedate_to_datetime
import json
import os
from datetime import datetime, timezone

OUTPUT_FILE = "output/email_watch.json"
MAX_RESULTS = 4
SCAN_LIMIT = 20  # how many recent messages per mailbox to check

PRIORITY_MATCHES = [
    "kgf@comcast.net",
    "notifications@vercel.com",
    "github.com",
    "onedrive.com",
    "noreply@paymentus.com",
]

def decode_str(value):
    if not value:
        return ""
    parts = decode_header(value)
    decoded = ""
    for text, enc in parts:
        if isinstance(text, bytes):
            decoded += text.decode(enc or "utf-8", errors="ignore")
        else:
            decoded += text
    return decoded

def matches_priority(from_addr):
    from_addr = from_addr.lower()
    return any(p in from_addr for p in PRIORITY_MATCHES)

def fetch_from_account(host, user, password, label):
    results = []
    try:
        imap = imaplib.IMAP4_SSL(host)
        imap.login(user, password)
        imap.select("INBOX")
        status, data = imap.search(None, "ALL")
        if status != "OK":
            imap.logout()
            return results
        ids = data[0].split()[-SCAN_LIMIT:]
        for msg_id in reversed(ids):
            status, msg_data = imap.fetch(msg_id, "(RFC822)")
            if status != "OK":
                continue
            msg = email.message_from_bytes(msg_data[0][1])
            from_addr = decode_str(msg.get("From", ""))
            if not matches_priority(from_addr):
                continue
            subject = decode_str(msg.get("Subject", "(No subject)"))
            date_str = msg.get("Date", "")
            try:
                dt = parsedate_to_datetime(date_str)
            except Exception:
                dt = datetime.now(timezone.utc)
            results.append({
                "source": label,
                "from": from_addr,
                "subject": subject,
                "date": dt.isoformat(),
            })
        imap.logout()
        print(f"  {label}: {len(results)} priority match(es)")
    except Exception as e:
        print(f"  {label}: error — {e}")
    return results

all_emails = []

gmail_user = os.environ.get("GMAIL_USER")
gmail_pass = os.environ.get("GMAIL_APP_PASSWORD")
if gmail_user and gmail_pass:
    print("Checking Gmail...")
    all_emails += fetch_from_account("imap.gmail.com", gmail_user, gmail_pass, "Gmail")

sm_host = os.environ.get("SMARTERMAIL_HOST")
sm_user = os.environ.get("SMARTERMAIL_USER_NEW")
sm_pass = os.environ.get("SMARTERMAIL_PASS_NEW")
if sm_host and sm_user and sm_pass:
    print("Checking SmarterMail...")
    all_emails += fetch_from_account(sm_host, sm_user, sm_pass, "Work")

all_emails.sort(key=lambda e: e["date"], reverse=True)
top_emails = all_emails[:MAX_RESULTS]

os.makedirs("output", exist_ok=True)
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(top_emails, f, indent=2, ensure_ascii=False)

print(f"Wrote {len(top_emails)} priority email(s) to {OUTPUT_FILE}")
