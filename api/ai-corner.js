// api/ai-corner.js
// Vercel serverless function — calls Gemini and returns a daily AI Corner
// tip set. Reads GEMINI_API_KEY from Vercel's environment variables.
//
// NOTE: gemini-2.5-flash is scheduled to shut down Oct 16, 2026 (Gemini
// Developer API). Revisit this before then and swap the MODEL constant
// for whatever the current Gemini Flash model is at that time.

const MODEL = 'gemini-2.5-flash';

// Used only if the Gemini call fails outright (bad key, quota, network).
// Multiple sets so a failure doesn't show the exact same text every time.
const FALLBACKS = [
  {
    personal: 'Walk the pass 15 minutes before service to check plating consistency.',
    tool: "Ask an AI to draft a quick 86'd-items list from a photo of your prep sheet.",
    workflow: 'End-of-night notes → AI turns them into 3 bullets for tomorrow\'s pre-shift.',
  },
  {
    personal: 'Taste one dish from every station before doors open, not just the specials.',
    tool: 'Photograph your par sheet and ask an AI to flag anything trending low.',
    workflow: 'Voice-memo service notes on your walk out → turn them into next-day prep list.',
  },
  {
    personal: 'Check in with your newest hire for two minutes before the rush starts.',
    tool: 'Have an AI turn a supplier invoice photo into a price-change summary.',
    workflow: 'Weekly: photograph the whiteboard specials board → archive it as a dated note.',
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

  const prompt = `You write a tiny daily "AI Corner" widget for a restaurant chef/owner's
personal dashboard. Today is ${today}. Give exactly 3 short items, each 1 sentence,
practical and specific to running a restaurant (kitchen ops, menu, wine/cocktails,
staff, guests). Vary your wording and ideas from typical generic advice — be specific
and concrete. Respond in this exact JSON shape:
{"personal": "...", "tool": "...", "workflow": "..."}`;

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
      workflow: tip.workflow || '',
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
