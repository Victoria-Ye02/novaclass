const Groq = require("groq-sdk");

require("dotenv").config();

const TEXT_MODEL = "openai/gpt-oss-120b";
let client = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function completeText({ messages, maxTokens = 1024, responseFormat }) {
  return client.chat.completions.create({
    model: TEXT_MODEL,
    messages,
    max_tokens: maxTokens,
    ...(responseFormat ? { response_format: responseFormat } : {}),
  });
}

async function transcribeAudio({ file, responseFormat = "text" }) {
  return client.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    response_format: responseFormat,
  });
}

function setGroqClientForTests(nextClient) { client = nextClient; }

module.exports = { TEXT_MODEL, completeText, transcribeAudio, setGroqClientForTests };
