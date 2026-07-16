const Anthropic = require("@anthropic-ai/sdk");

const ai = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

// POST /api/ai/summarize  { text }
exports.summarize = async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });

  try {
    const prompt = `Summarize the following text. Return ONLY valid JSON:
{
  "short": "one sentence",
  "paragraph": "4-6 sentence paragraph",
  "detailed": "numbered step-by-step breakdown"
}
Detect language and reply in same language.

Text:
${text.slice(0, 30000)}`;

    const msg = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    let out = msg.content[0].text.trim()
      .replace(/```json\s*/g, "").replace(/```\s*/g, "");
    const start = out.indexOf("{");
    const end = out.lastIndexOf("}") + 1;
    const summary = JSON.parse(out.slice(start, end));
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/ai/chat  { message, history? }
exports.chat = async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    const msg = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: "You are a helpful study assistant for students. Answer questions clearly and concisely. Support multiple languages.",
      messages,
    });

    res.json({ response: msg.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
