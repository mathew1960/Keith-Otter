export default async function handler(req, res) {
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
return res.status(500).json({ summary: "Missing GEMINI_API_KEY" });
}

const url =
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
const prompt = "Write a short, warm 'good morning' message for a
restaurant chef/owner named Keith, 2-3 sentences, mentioning it's a
fresh start to the day. No agenda items needed, just a friendly
greeting.";

try {
const response = await fetch(url, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }]
})
});
const data = await response.json();
const summary =
data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Good
morning, Keith.";
res.status(200).json({ summary, generatedAt: new
Date().toISOString() });
} catch (err) {
res.status(500).json({ summary: "Good morning, Keith. (Agenda brief
temporarily unavailable.)" });
}
}
