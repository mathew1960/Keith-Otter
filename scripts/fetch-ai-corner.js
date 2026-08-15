// scripts/fetch-ai-corner.js
// Fetches a short AI-generated tip for the dashboard's AI Corner card
// Requires GEMINI_API_KEY as an environment variable (set via GitHub
Actions secret)

import fs from "fs";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.0-flash"; // swap if you want a different Gemini
model
const OUTPUT_FILE = "ai_corner_output.json";

const PROMPT = "Give me one short, practical tip for a restaurant
chef/owner today — under 40 words, no preamble.";

async function fetchAiCorner() {
if (!API_KEY) {
console.error("Missing GEMINI_API_KEY environment variable.");
process.exit(1);
}

const url =
`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

const body = {
contents: [{ parts: [{ text: PROMPT }] }]
};

try {
const response = await fetch(url, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(body)
});

if (!response.ok) {
throw new Error(`Gemini API error: ${response.status}
${response.statusText}`);
}

const data = await response.json();
const text =
data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
"No tip available right now.";

fs.writeFileSync(
OUTPUT_FILE,
JSON.stringify({ tip: text, generatedAt: new Date().toISOString()
}, null, 2)
);
console.log("AI Corner updated:", text);
} catch (err) {
console.error("Failed to fetch AI Corner content:", err.message);
fs.writeFileSync(
OUTPUT_FILE,
JSON.stringify(
{ tip: "AI Corner temporarily unavailable.", generatedAt: new
Date().toISOString() },
null,
2
)
);
process.exit(1);
}
}

fetchAiCorner();
