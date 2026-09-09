const pool = require("../../config/db");
const { completeText } = require("../../services/ai/groqText");

const KMATE_AI_URL = process.env.KMATE_AI_URL || "http://localhost:8082";

// POST /api/kmate/ask  { question }
// Proxies to nova-class-ai (Thine's Python FastAPI service: Gemini + ChromaDB
// RAG over the official TOPIK II exam papers) instead of the plain Groq
// completion this used to call directly — the RAG service grounds answers in
// the actual exam material instead of the model's own unaided knowledge.
exports.ask = async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "question is required" });

  try {
    const upstream = await fetch(`${KMATE_AI_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      signal: AbortSignal.timeout(30000),
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      throw new Error(`K.MATE AI service request failed: ${upstream.status} ${detail}`.slice(0, 300));
    }
    const { answer } = await upstream.json();

    // Save to history
    await pool.query(
      "INSERT INTO kmate_history (user_id, question, answer) VALUES (?, ?, ?)",
      [req.user.id, question, answer]
    );

    res.json({ answer });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};

// GET /api/kmate/history
exports.history = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, question, answer, created_at FROM kmate_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/kmate/quiz/generate  { topic, count, language }
exports.generateQuiz = async (req, res) => {
  const { topic = "TOPIK vocabulary", count = 5, language = "en" } = req.body;

  try {
    const prompt = `Generate ${count} multiple-choice Korean language quiz questions about: ${topic}.
Language for explanations: ${language === "my" ? "Burmese (Myanmar)" : "English"}.

Return ONLY valid JSON array:
[
  {
    "question": "question text in Korean or about Korean",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "answer": "A",
    "explanation": "brief explanation"
  }
]`;

    const completion = await completeText({
      maxTokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    let out = completion.choices[0].message.content.trim()
      .replace(/```json\s*/g, "").replace(/```\s*/g, "");
    const start = out.indexOf("[");
    const end = out.lastIndexOf("]") + 1;
    const questions = JSON.parse(out.slice(start, end));
    res.json({ questions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/kmate/quiz/check  { questions, answers }
exports.checkQuiz = async (req, res) => {
  const { questions, answers } = req.body;
  if (!questions || !answers) return res.status(400).json({ error: "questions and answers are required" });

  try {
    let correct = 0;
    const results = questions.map((q, i) => {
      const isCorrect = answers[i] === q.answer;
      if (isCorrect) correct++;
      return {
        question: q.question,
        yourAnswer: answers[i],
        correctAnswer: q.answer,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const score = Math.round((correct / questions.length) * 100);
    res.json({ score, correct, total: questions.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
