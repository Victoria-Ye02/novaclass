const { completeText } = require("../../services/ai/groqText");
const { translateText } = require("../../services/ai/translation");

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

    const completion = await completeText({
      maxTokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    let out = completion.choices[0].message.content.trim()
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
      { role: "system", content: "You are a helpful study assistant for students. Answer questions clearly and concisely. Support multiple languages." },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    const completion = await completeText({
      maxTokens: 1024,
      messages,
    });

    const response = completion.choices[0].message.content;
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/ai/translate { text, targetLanguage }
exports.translate = async (req, res) => {
  try {
    const translation = await translateText({
      text: req.body.text,
      targetLanguage: req.body.targetLanguage,
      completeText,
    });
    res.json({ translation });
  } catch (err) {
    const invalidInput = /text is required|targetLanguage must be my or en/.test(err.message);
    res.status(invalidInput ? 400 : 502).json({
      error: invalidInput ? err.message : "Translation is temporarily unavailable",
    });
  }
};
