// api/ai-corner.js
// Vercel serverless function — calls Gemini and returns a daily AI Corner
// tip set. Reads GEMINI_API_KEY from Vercel's environment variables.
//
// NOTE: gemini-2.5-flash was retired for new API keys as of Aug 2026
// ("no longer available to new users" per Google's error response) —
// that's why this was stuck on fallback. gemini-3.6-flash is Google's
// current free-tier default (as of July 2026). If this breaks again,
// check ai.google.dev/gemini-api/docs/pricing for the current free
// Flash model name and swap MODEL below.

const MODEL = 'gemini-3.6-flash';

// Used only if the Gemini call fails outright (bad key, quota, network).
// Multiple sets so a failure doesn't show the exact same text every time.
const FALLBACKS = [
  {
    personal: 'Take ten minutes today for one thing that isn\'t on the to-do list.',
    tool: 'Ask an AI to summarize a long email thread into three bullet points.',
  },
  {
    personal: 'Check in with one person you haven\'t talked to in a while.',
    tool: 'Have an AI turn a messy handwritten note into a clean typed list.',
  },
  {
    personal: 'Step outside for a few minutes before the day gets busy.',
    tool: 'Ask an AI to draft a quick reply to an email you\'ve been putting off.',
  },
];

function pickFallback() {
  const dayIndex = new Date().getUTCDate() % FALLBACKS.length;
  return FALLBACKS[dayIndex];
}

export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const prompt = `You write a tiny daily "AI Corner" widget for a personal dashboard.
Today is ${today}. Give exactly 2 short items, each 1 sentence: a practical personal
tip for today, and a practical idea for using AI tools in everyday life. Be specific
and concrete, not generic advice. Respond in this exact JSON shape:
{"personal": "...", "tool": "..."}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.9,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', response.status, errText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error('Gemini response missing text:', JSON.stringify(data));
      throw new Error('Empty Gemini response');
    }

    const tip = JSON.parse(rawText);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({
      personal: tip.personal || '',
      tool: tip.tool || '',
      generated_at: new Date().toISOString(),
      source: 'gemini',
    });
  } catch (err) {
    console.error('AI Corner fetch failed:', err.message);
    const fallback = pickFallback();
    return res.status(200).json({
      ...fallback,
      generated_at: new Date().toISOString(),
      source: 'fallback',
    });
  }
}
