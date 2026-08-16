// api/agenda-brief.js
// Vercel serverless function — reads weather.json + rss_headlines.json
// from the deployed repo and asks Gemini to write a short morning brief.
// Reads GEMINI_API_KEY from Vercel's environment variables.

import fs from 'fs';
import path from 'path';

function safeReadJSON(relPath) {
  try {
    const filePath = path.join(process.cwd(), relPath);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;

  const weather = safeReadJSON('output/weather.json');
  const news = safeReadJSON('scripts/rss_headlines.json');
  const emailWatch = safeReadJSON('output/email_watch.json');

  const fallbackBrief =
    "Good morning, Keith.\n\nYour personal morning brief will appear here.\n\n" +
    "Weather • News • Email Watch • Personal Focus • Reminder Notes • AI Personal Block";

  if (!apiKey) {
    return res.status(200).json({ brief: fallbackBrief, source: 'fallback-no-key' });
  }

  const weatherLine = weather
    ? `Weather: ${weather.temp}°F and ${weather.conditions}, high ${weather.high}° / low ${weather.low}°.`
    : 'Weather data not available.';

  const newsLine = news && news.length
    ? `Top headline: "${news[0].title}".`
    : 'No news headlines available.';

  const emailLine = emailWatch && emailWatch.length
    ? `${emailWatch.length} priority email(s) waiting, most recent from ${emailWatch[0].from}.`
    : 'No priority emails right now.';

  const prompt = `Write a short, warm "good morning" brief (3-4 sentences, plain text,
no markdown) for Keith, a restaurant chef/owner in La Quinta, CA. Weave in these
facts naturally, don't just list them:
${weatherLine}
${newsLine}
${emailLine}
Start with "Good morning, Keith."`;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const brief = data.candidates[0].content.parts[0].text.trim();

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ brief, source: 'gemini' });
  } catch (err) {
    console.error('Agenda brief generation failed:', err);
    return res.status(200).json({ brief: fallbackBrief, source: 'fallback-error' });
  }
}
