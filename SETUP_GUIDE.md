# Keith Dashboard — Setup Guide

How to stand this dashboard up from scratch, or recreate it in a new repo. Covers both scheduled GitHub Actions and the two live Vercel API endpoints.

---

## What you're building

- A static `index.html` dashboard hosted on Vercel
- Two GitHub Actions workflows that run **4x/day** (6:30 AM, 11:30 AM, 4:30 PM, 9:30 PM Pacific) and commit fresh JSON data back to the repo, which Vercel then redeploys
- Two Vercel serverless functions that respond live, on every page load — not on the schedule above

---

## Step 1 — Fork or create the repo

Repo needs this structure:

```
your-repo/
├── .github/workflows/
│   ├── daily_agenda.yml
│   └── auto-commit-json.yml
├── api/
│   ├── ai-corner.js
│   └── smartermail-email.js
├── scripts/
│   ├── fetch_calendar.py
│   ├── fetch_rss.py
│   ├── fetch_weather.py
│   ├── build_agenda.py
│   └── generate_json.py
├── agenda/.gitkeep
├── output/.gitkeep
└── index.html
```

---

## Step 2 — Deploy to Vercel

1. Go to vercel.com, sign in, **Add New → Project**, import the repo.
2. Leave build settings default (this is a static `index.html` + serverless `api/` functions — Vercel detects both automatically).
3. Deploy. Note the resulting domain (e.g. `your-project.vercel.app`).

**Watch out for duplicate projects** — if you ever re-import the same repo under a slightly different name, Vercel will happily run two live "Production" deployments side by side from the same code. That's confusing to debug later (one may be missing env vars the other has). If it happens, delete the extra one in Project Settings → scroll to bottom → Delete Project.

---

## Step 3 — Set Vercel environment variables

Vercel project → **Settings → Environment Variables**. These are separate from GitHub Actions secrets (Step 5) — don't mix them up.

| Variable | Value |
|---|---|
| `SMARTERMAIL_USER` | Your SmarterMail inbox username |
| `SMARTERMAIL_PASS` | Your SmarterMail inbox password |
| `GEMINI_API_KEY` | From [aistudio.google.com](https://aistudio.google.com) → Get API key |

After adding these, trigger a redeploy (any new commit, or Vercel's "Redeploy" button) so the functions pick them up.

### About the Gemini model

`api/ai-corner.js` currently targets `gemini-3.6-flash`. Google periodically retires free-tier Flash model names — if AI Research starts responding with `"source": "fallback"` instead of `"source": "gemini"`, check the actual response at `your-domain.vercel.app/api/ai-corner` (a plain GET shows the raw JSON), then check Vercel's function logs for that request for the exact error. A `404` with a message like *"model no longer available to new users"* means it's time to swap the `MODEL` constant for whatever's current at [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing).

---

## Step 4 — Get a Google Calendar iCal URL (optional)

Only needed if you want `fetch_calendar.py` doing anything — note the dashboard's Calendar card isn't currently wired up to display this data, so this step is optional infrastructure, not something you'll see on screen yet.

1. Open [Google Calendar](https://calendar.google.com), hover the calendar in the sidebar → **⋮ → Settings and sharing**.
2. Scroll to **Integrate calendar** → copy **Secret address in iCal format**.
3. That URL is what goes in the GitHub secret below. Treat it like a password — anyone with it can read your calendar.

---

## Step 5 — Add GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Value |
|---|---|
| `GCAL_ICAL_URL` | The iCal URL from Step 4 |

`fetch_calendar.py` fails soft — if this secret is missing, it writes an empty calendar file instead of crashing the workflow, so the rest of the pipeline (news, weather) still runs fine either way.

---

## Step 6 — Verify each workflow manually

1. Repo → **Actions** tab → click **Daily Agenda Builder** → **Run workflow**.
2. Watch it finish (green checkmark, ~10-15s). If it fails, click the red step to see the exact error.
3. Repeat for **Auto Commit JSON**.
4. Check that `output/weather.json` and `scripts/rss_headlines.json` now have real content, not placeholders.

Once both pass manually, they'll run automatically at the four scheduled times going forward.

---

## Customizing the schedule

Both workflow files use the same four cron lines:

```yaml
schedule:
  - cron: '30 13 * * *'   # 6:30 AM Pacific (PDT)
  - cron: '30 18 * * *'   # 11:30 AM Pacific (PDT)
  - cron: '30 23 * * *'   # 4:30 PM Pacific (PDT)
  - cron: '30 4 * * *'    # 9:30 PM Pacific (PDT, lands on next UTC date)
```

Cron runs in UTC only and does not know about daylight saving. Use [crontab.guru](https://crontab.guru) to work out new UTC times, and expect to manually adjust these twice a year (~March and ~November) if you want the local times to stay fixed.

---

## Troubleshooting

| Problem | Likely cause / fix |
|---|---|
| AI Research always shows `"source": "fallback"` | Model name retired — see "About the Gemini model" above |
| Email Watch shows "SmarterMail not configured" | Check you're on the real Vercel domain, not a duplicate project missing env vars |
| Email Watch only shows old bot notifications | Add real senders to the `priorityFrom` array in `api/smartermail-email.js` — only listed senders show up at all |
| Workflow fails with a Python `IndentationError` | A script got pasted/edited with its indentation stripped — re-check the file's whitespace carefully, Python is whitespace-sensitive |
| Inbox flooded with GitHub Action failure emails | github.com/settings/notifications → Actions → turn off email, or per-repo via the "Watch" dropdown → Custom → uncheck Actions |
| Weather/news look stale all day | These only update at the 4 scheduled times, not on page load — check the workflow's last successful run time in the Actions tab |
| Health Hub / Tasks / Notes empty on a different device | Expected — all three are localStorage-only, per-device, never synced |
