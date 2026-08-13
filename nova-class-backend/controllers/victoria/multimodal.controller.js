const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const mammoth = require("mammoth");
const { completeText, transcribeAudio } = require("../../services/ai/groqText");

// Extract text from any file via RAG server (handles OCR for image-based PDFs)
async function extractViaRag(filePath, filename) {
  const RAG_URL = process.env.RAG_URL || "http://localhost:8000";
  const tempId = `mm_tmp_${Date.now()}`;
  try {
    const FormData = require("form-data");
    const form = new FormData();
    form.append("material_id", tempId);
    form.append("file", fs.createReadStream(filePath), { filename });

    const ingestRes = await fetch(`${RAG_URL}/ingest`, {
      method: "POST", body: form, headers: form.getHeaders(),
      signal: AbortSignal.timeout(60000),
    });
    if (!ingestRes.ok) return "";

    const retrieveRes = await fetch(`${RAG_URL}/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "summarize the main content of this document", material_id: tempId, n_results: 8 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!retrieveRes.ok) return "";
    const data = await retrieveRes.json();
    return (data.chunks || []).join("\n").slice(0, 10000);
  } catch { return ""; }
  finally {
    fetch(`${RAG_URL}/sources/${tempId}`, { method: "DELETE" }).catch(() => {});
  }
}

// Analyze image using Groq vision (llama-3.2-11b-vision-preview)
async function analyzeImageWithGroq(filePath, question) {
  const imageBuffer = fs.readFileSync(filePath);
  const base64Image = imageBuffer.toString("base64");
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
  const mimeType = mimeMap[ext] || "image/jpeg";

  const Groq = require("groq-sdk");
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const response = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          { type: "text", text: question || "Describe this image in detail. If it contains text or study material, explain what it shows." },
        ],
      },
    ],
    max_tokens: 1024,
  });
  return response.choices[0].message.content;
}

exports.analyzeFile = async (req, res) => {
  const { question } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ error: "No file uploaded" });

  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;
  const filePath = file.path;

  try {
    let result;

    // ── IMAGE ── (Groq Vision — no Google credentials needed)
    if (mime.startsWith("image/")) {
      const answer = await analyzeImageWithGroq(filePath, question);
      result = { type: "image", answer };
    }

    // ── AUDIO ──
    else if (mime.startsWith("audio/") || [".mp3", ".mp4", ".wav", ".m4a", ".ogg", ".flac", ".webm"].includes(ext)) {
      const transcription = await transcribeAudio({
        file: fs.createReadStream(filePath),
        responseFormat: "text",
      });

      if (question && question.trim()) {
        const chat = await completeText({
          messages: [
            { role: "system", content: "You are a helpful study assistant." },
            { role: "user", content: `Audio transcription:\n${transcription}\n\nQuestion: ${question}` },
          ],
          maxTokens: 1024,
        });
        result = { type: "audio", transcription, answer: chat.choices[0].message.content };
      } else {
        result = { type: "audio", transcription, answer: transcription };
      }
    }

    // ── PDF ── (text PDF → pdf-parse, image PDF → RAG OCR)
    else if (mime === "application/pdf" || ext === ".pdf") {
      let text = "";
      try {
        const buffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(buffer);
        text = pdfData.text?.slice(0, 12000) || "";
      } catch { /* unreadable */ }

      // Image-based PDF: fall back to RAG OCR
      if (text.trim().length < 300) {
        text = await extractViaRag(filePath, file.originalname);
      }

      const chat = await completeText({
        messages: [
          { role: "system", content: "You are a helpful study assistant. Analyze documents and answer questions clearly." },
          { role: "user", content: `Document content:\n${text}\n\n${question || "Summarize this document."}` },
        ],
        maxTokens: 1024,
      });
      result = { type: "pdf", answer: chat.choices[0].message.content };
    }

    // ── DOCX ──
    else if (ext === ".docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const { value: text } = await mammoth.extractRawText({ path: filePath });
      const chat = await completeText({
        messages: [
          { role: "system", content: "You are a helpful study assistant. Analyze documents and answer questions clearly." },
          { role: "user", content: `Document content:\n${text.slice(0, 12000)}\n\n${question || "Summarize this document."}` },
        ],
        maxTokens: 1024,
      });
      result = { type: "docx", answer: chat.choices[0].message.content };
    }

    else {
      fs.unlink(filePath, () => {});
      return res.status(400).json({ error: "Unsupported file type. Supported: image, audio, PDF, DOCX" });
    }

    fs.unlink(filePath, () => {});
    res.json(result);
  } catch (err) {
    fs.unlink(filePath, () => {});
    console.error("Multimodal error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
