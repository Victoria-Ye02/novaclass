const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";
// "Rachel" — ElevenLabs' original default premade voice, stable across accounts.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
// Flash prioritizes time-to-first-audio, which is the right default for a live
// teaching conversation. A demo can still select a quality-first model (such
// as eleven_multilingual_v2) with ELEVENLABS_TTS_MODEL_ID.
const DEFAULT_TTS_MODEL_ID = "eleven_flash_v2_5";

function assertConfigured() {
  if (process.env.ELEVENLABS_API_KEY) return;
  const error = new Error("ElevenLabs is not configured (ELEVENLABS_API_KEY is unset)");
  error.code = "ELEVENLABS_NOT_CONFIGURED";
  throw error;
}

async function textToSpeech(text, voiceId) {
  assertConfigured();
  const activeVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_TTS_MODEL_ID || DEFAULT_TTS_MODEL_ID;
  const res = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${activeVoiceId}?optimize_streaming_latency=3`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const error = new Error(`ElevenLabs TTS request failed: ${res.status} ${detail}`.slice(0, 300));
    error.code = "ELEVENLABS_REQUEST_FAILED";
    throw error;
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Short-lived (15 min) signed WebSocket URL for a Conversational AI agent —
// lets the frontend's @elevenlabs/client SDK authenticate a real-time voice
// session directly, without ever handing it ELEVENLABS_API_KEY. The
// resulting session itself isn't time-limited by this URL's expiry; it only
// needs to be valid at the moment the connection is opened.
async function getSignedUrl(agentId) {
  assertConfigured();
  const res = await fetch(
    `${ELEVENLABS_API_URL}/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY }, signal: AbortSignal.timeout(10000) }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const error = new Error(`ElevenLabs signed-url request failed: ${res.status} ${detail}`.slice(0, 300));
    error.code = "ELEVENLABS_REQUEST_FAILED";
    throw error;
  }

  const data = await res.json();
  return data.signed_url;
}

// Speech-to-Text via the Scribe model. Used specifically for Burmese voice
// input: Groq's whisper-large-v3 can't transcribe Burmese at all (it returns
// script gibberish), whereas Scribe transcribes it accurately and auto-detects
// the language. `audio` is a Buffer of the recorded clip; languageCode (an
// ISO-639-3 code like "mya") is optional — Scribe auto-detects well without it.
async function speechToText(audio, { filename = "audio.webm", languageCode } = {}) {
  assertConfigured();
  const form = new FormData();
  form.append("file", new Blob([audio]), filename);
  form.append("model_id", "scribe_v1");
  if (languageCode) form.append("language_code", languageCode);

  const res = await fetch(`${ELEVENLABS_API_URL}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
    body: form,
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const error = new Error(`ElevenLabs speech-to-text request failed: ${res.status} ${detail}`.slice(0, 300));
    error.code = "ELEVENLABS_REQUEST_FAILED";
    throw error;
  }

  const data = await res.json();
  return (data.text || "").trim();
}

module.exports = { textToSpeech, getSignedUrl, speechToText, DEFAULT_VOICE_ID, DEFAULT_TTS_MODEL_ID };
