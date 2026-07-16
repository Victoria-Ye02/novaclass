const Groq = require("groq-sdk");
const pool = require("../../config/db");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// POST /api/kmate/ask  { question }
exports.ask = async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "question is required" });

  try {
    const chat = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      messages: [
        { role: "system", content: `You are K.MATE, an expert Korean language tutor specializing in TOPIK (Test of Proficiency in Korean).
Help students understand Korean grammar, vocabulary, reading, and writing.
Give clear explanations with examples. Support Korean, English, and Burmese explanations.
When explaining grammar, use the format: pattern → meaning → example.` },
        { role: "user", content: question },
      ],
    });

    const answer = chat.choices[0].message.content;

    // Save to history
    await pool.query(
      "INSERT INTO kmate_history (user_id, question, answer) VALUES (?, ?, ?)",
      [req.user.id, question, answer]
    );

    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    const chat = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    let out = chat.choices[0].message.content.trim()
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
