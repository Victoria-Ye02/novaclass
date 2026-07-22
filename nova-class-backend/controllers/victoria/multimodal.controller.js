const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const mammoth = require("mammoth");
const { completeText, transcribeAudio } = require("../../services/ai/groqText");
const { extractImageContext } = require("../../services/ai/googleVision");

exports.analyzeFile = async (req, res) => {
  const { question } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ error: "No file uploaded" });

  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;
  const filePath = file.path;

  try {
    let result;

    // ── IMAGE ──
    if (mime.startsWith("image/")) {
      const imageData = fs.readFileSync(filePath);
      const imageContext = await extractImageContext(imageData);
      const response = await completeText({
        messages: [
          { role: "system", content: "You are a helpful study assistant. Analyze extracted image context and answer clearly." },
          {
            role: "user",
            content: `Image text:\n${imageContext.text}\n\nLabels: ${imageContext.labels.join(", ")}\nObjects: ${imageContext.objects.join(", ")}\n\n${question || "Describe this image in detail. If it contains text, explain it. If it's a study material or assignment, explain what it shows."}`,
          },
        ],
        maxTokens: 1024,
      });

      result = { type: "image", answer: response.choices[0].message.content };
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
        result = {
          type: "audio",
          transcription,
          answer: chat.choices[0].message.content,
        };
      } else {
        result = { type: "audio", transcription, answer: transcription };
      }
    }

    // ── PDF ──
    else if (mime === "application/pdf" || ext === ".pdf") {
      const buffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(buffer);
      const text = pdfData.text.slice(0, 12000);

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
      const trimmed = text.slice(0, 12000);

      const chat = await completeText({
        messages: [
          { role: "system", content: "You are a helpful study assistant. Analyze documents and answer questions clearly." },
          { role: "user", content: `Document content:\n${trimmed}\n\n${question || "Summarize this document."}` },
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
