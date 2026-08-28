const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const mammoth = require("mammoth");
const { completeText, transcribeAudio } = require("../../services/ai/groqText");
const { speechToText: elevenLabsSpeechToText } = require("../../services/ai/elevenLabs");
const { extractImageContext } = require("../../services/ai/googleVision");

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

// Google Vision reads the image's text/labels/objects, then the text model
// answers the question from that context — keeps image understanding on the
// same standardized text model as every other file type instead of a
// separate vision-model integration.
async function analyzeImage(filePath, question) {
  const imageBuffer = fs.readFileSync(filePath);
  const context = await extractImageContext(imageBuffer);

  const chat = await completeText({
    messages: [
      { role: "system", content: "You are a helpful study assistant. Use the extracted image text, labels, and objects to answer the student's question about the image." },
      {
        role: "user",
        content: `Image text:\n${context.text || "(none)"}\n\nLabels: ${context.labels.join(", ") || "(none)"}\n\nObjects: ${context.objects.join(", ") || "(none)"}\n\n${question || "Describe this image in detail."}`,
      },
    ],
    maxTokens: 1024,
  });
  return chat.choices[0].message.content;
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

    // ── IMAGE ──
    if (mime.startsWith("image/")) {
      const answer = await analyzeImage(filePath, question);
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

// Whisper reliably returns *something* for a clip even when nothing was
// actually said — near-silent/noise-only audio comes back hallucinated as
// plausible filler ("Okay.", "Thank you.", "Tchau.") instead of empty.
// Segment-level no_speech_prob (response_format=verbose_json) catches this
// — but only for languages Whisper is actually confident in. Live-tested
// against the real Groq API: a hallucinated "Thank you." on 1.5s of noise
// scored no_speech_prob 0.79, a genuine Korean utterance scored 0.047 (huge,
// safe margin) — but a genuine Burmese clip scored *0.84*, higher than the
// hallucination. Whisper just isn't confident in Burmese overall, so
// no_speech_prob alone can't separate "real Burmese" from "silence" there.
//
// Previously we skipped the filter entirely for Burmese and trusted the raw
// transcript — but that let silence-hallucinations (which come back as
// English/Portuguese filler) through, and in voice mode Nova would answer
// them and hear its own reply, talking to itself in a loop. The fix: keep a
// segment if Whisper is confident it's speech OR it's written in Burmese
// script. The script is a signal the Latin-filler hallucinations never carry,
// so it rescues real Burmese without reopening the silence-loop.
const NO_SPEECH_PROB_THRESHOLD = 0.5;
// Myanmar Unicode block (U+1000–U+109F).
const BURMESE_SCRIPT_RE = /[က-႟]/;
// The app's other supported languages, in the full lowercase names Whisper's
// verbose_json reports auto-detection as (e.g. "korean", not "ko").
const OTHER_SUPPORTED_WHISPER_LANGUAGES = new Set(["english", "korean", "vietnamese"]);

function confidentText(transcription) {
  const segments = Array.isArray(transcription?.segments) ? transcription.segments : [];
  return segments
    .filter(segment => {
      const isSpeech = (segment.no_speech_prob ?? 0) < NO_SPEECH_PROB_THRESHOLD;
      return isSpeech || BURMESE_SCRIPT_RE.test(segment.text || "");
    })
    .map(segment => segment.text.trim())
    .join(" ")
    .trim();
}

// POST /api/multimodal/transcribe — raw speech-to-text for a recorded voice
// question. The browser's own SpeechRecognition doesn't cover every language
// this app supports (Burmese, notably), so voice input records audio
// client-side and transcribes it here.
//
// Two engines: Groq Whisper (free) for the languages it handles well, and
// ElevenLabs Scribe for Burmese — Whisper can't transcribe Burmese at all (it
// returns script gibberish, verified live against the real API), while Scribe
// does it accurately.
exports.transcribe = async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No audio uploaded" });

  const uiLangIsBurmese = req.body?.lang === "my";

  try {
    // Burmese UI → straight to Scribe; running it through Whisper first would
    // only ever return gibberish.
    if (uiLangIsBurmese) {
      const text = await elevenLabsSpeechToText(fs.readFileSync(file.path));
      return res.json({ text });
    }

    // Everything else → Whisper, with the silence-hallucination filtering in
    // confidentText.
    const transcription = await transcribeAudio({
      file: fs.createReadStream(file.path),
      responseFormat: "verbose_json",
    });
    const text = confidentText(transcription);

    // The UI language is a weak signal — someone with English selected can
    // still speak Burmese, which Whisper has no Burmese in its own language-ID
    // space for, so it mis-hears as another language entirely (Hindi and Tamil,
    // per live testing) rather than failing outright. If auto-detect landed
    // outside the app's other supported languages and still found real speech,
    // re-transcribe with Scribe and use that only if it actually came back in
    // Burmese script, so a genuine other-language utterance Whisper correctly
    // identified is never overwritten.
    const detected = transcription.language;
    if (text && detected && !OTHER_SUPPORTED_WHISPER_LANGUAGES.has(detected.toLowerCase())) {
      const scribeText = await elevenLabsSpeechToText(fs.readFileSync(file.path));
      if (BURMESE_SCRIPT_RE.test(scribeText)) {
        return res.json({ text: scribeText });
      }
    }

    res.json({ text });
  } catch (err) {
    res.status(502).json({ error: err.message });
  } finally {
    fs.unlink(file.path, () => {});
  }
};
