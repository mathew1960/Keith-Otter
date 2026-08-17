// api/ai-corner.js
// Vercel serverless function — AI Research chat box.
// Accepts POST { message, history } and returns { reply } from Gemini.
// Reads GEMINI_API_KEY from Vercel's environment variables.
//
// NOTE: gemini-2.5-flash was retired for new API keys as of Aug 2026.
// gemini-3.6-flash is Google's current free-tier default (as of July
// 2026). If this breaks again, check ai.google.dev/gemini-api/docs/pricing
// for the current free Flash model name and swap MODEL below.

const MODEL = 'gemini-3.6-flash';

export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ reply: 'GEMINI_API_KEY not configured.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ reply: 'This endpoint expects a POST with a message.' });
  }

  const { message, history } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ reply: 'No message provided.' });
  }

  const contents = [];

  if (Array.isArray(history)) {
    history.forEach(m => {
      if (!m || !m.text) return;
      contents.push({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(m.text) }],
      });
    });
  }

  contents.push({ role: 'user', parts: [{ text: message }] });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({ contents }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', response.status, errText);
      return res.status(200).json({
        reply: 'AI is temporarily unavailable — try again in a bit.',
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    return res.status(200).json({ reply: text || 'No response received.' });
  } catch (err) {
    console.error('AI chat failed:', err.message);
    return res.status(200).json({
      reply: 'AI is temporarily unavailable — try again in a bit.',
    });
  }
}