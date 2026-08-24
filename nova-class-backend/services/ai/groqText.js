const Groq = require("groq-sdk");
const OpenAI = require("openai");

require("dotenv").config();

// Text completion goes through OpenRouter (Groq's own chat models were
// retired from this account — only reasoning models remain there, and those
// return empty `content` on the app's short max_tokens budgets). Whisper
// transcription stays on Groq directly; OpenRouter doesn't offer it.
const TEXT_MODEL = "z-ai/glm-5.2";
let textClient = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: "https://openrouter.ai/api/v1" });
let audioClient = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function completeText({ messages, maxTokens = 1024, responseFormat }) {
  return textClient.chat.completions.create({
    model: TEXT_MODEL,
    messages,
    max_tokens: maxTokens,
    // z-ai/glm-5.2 is also a reasoning model — without this it spends the
    // whole max_tokens budget on internal reasoning and content comes back empty.
    reasoning: { enabled: false },
    ...(responseFormat ? { response_format: responseFormat } : {}),
  });
}

async function transcribeAudio({ file, responseFormat = "text" }) {
  return audioClient.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    response_format: responseFormat,
  });
}

function setClientsForTests({ text, audio } = {}) {
  if (text) textClient = text;
  if (audio) audioClient = audio;
}

module.exports = { TEXT_MODEL, completeText, transcribeAudio, setClientsForTests };
