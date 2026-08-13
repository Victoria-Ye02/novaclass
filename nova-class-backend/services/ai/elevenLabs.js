const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";
// "Rachel" — ElevenLabs' original default premade voice, stable across accounts.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

function assertConfigured() {
  if (process.env.ELEVENLABS_API_KEY) return;
  const error = new Error("ElevenLabs is not configured (ELEVENLABS_API_KEY is unset)");
  error.code = "ELEVENLABS_NOT_CONFIGURED";
  throw error;
}

async function textToSpeech(text, voiceId) {
  assertConfigured();
  const res = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      // Multilingual model: this app's lessons and chat span English, Korean, and Myanmar.
      model_id: "eleven_multilingual_v2",
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

module.exports = { textToSpeech, DEFAULT_VOICE_ID };
