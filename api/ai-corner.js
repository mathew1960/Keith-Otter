// api/ai-corner.js
// Vercel serverless function — calls Gemini and returns a daily AI Corner
// tip set. Reads GEMINI_API_KEY from Vercel's environment variables.

export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const prompt = `You write a tiny daily "AI Corner" widget for a restaurant chef/owner's
personal dashboard. Give exactly 3 short items, each 1 sentence, practical and
specific to running a restaurant (kitchen ops, menu, wine/cocktails, staff,
guests). Respond ONLY as JSON, no markdown, no code fences, in this exact shape:
{"personal": "...", "tool": "...", "workflow": "..."}`;

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
    let rawText = data.candidates[0].content.parts[0].text.trim();
    rawText = rawText.replace(/^```(json)?/, '').replace(/```$/, '').trim();

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
    console.error('AI Corner fetch failed:', err);
    return res.status(200).json({
      personal: 'Walk the pass 15 minutes before service to check plating consistency.',
      tool: "Ask an AI to draft a quick 86'd-items list from a photo of your prep sheet.",
      workflow: "End-of-night notes → AI turns them into 3 bullets for tomorrow's pre-shift.",
      generated_at: new Date().toISOString(),
      source: 'fallback',
    });
  }
}
