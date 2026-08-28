const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

// Burmese TTS. ElevenLabs has no Burmese voice at all (it returns mispronounced
// audio, not an error), so Burmese replies use the Azure Neural voice
// "my-MM-NilarNeural" instead. That voice is reachable two ways, and this
// module picks automatically:
//
//   1. Official Azure Speech REST — used when AZURE_SPEECH_KEY + REGION are
//      set (higher quota, an SLA, supported for production).
//   2. Microsoft Edge's free "Read Aloud" endpoint via msedge-tts — the *same*
//      neural voices with no account, key, or card. This is the default so
//      Burmese voice works out of the box. It's an undocumented endpoint, fine
//      for a class app; the audio is identical to (1), so adding a key later
//      changes nothing a listener hears.
const DEFAULT_VOICE = "my-MM-NilarNeural";
const DEFAULT_LOCALE = "my-MM";
const REQUEST_TIMEOUT_MS = 20000;

// The SSML body (Azure REST path) is XML, so these five characters in the
// reply text would otherwise break the document or, for < and &, let injected
// markup through. Escape them before interpolating.
function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function synthesizeWithAzureRest(text, voiceName) {
  const region = process.env.AZURE_SPEECH_REGION;
  const ssml =
    `<speak version='1.0' xml:lang='${DEFAULT_LOCALE}'>` +
    `<voice xml:lang='${DEFAULT_LOCALE}' name='${voiceName}'>${escapeXml(text)}</voice>` +
    `</speak>`;

  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "NovaClass",
    },
    body: ssml,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const error = new Error(`Azure TTS request failed: ${res.status} ${detail}`.slice(0, 300));
    error.code = "BURMESE_TTS_REQUEST_FAILED";
    throw error;
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Microsoft Edge's Read Aloud service — same neural voices, no auth. Streams
// MP3 chunks over a WebSocket; collect them into one Buffer so the caller gets
// the same shape (an MP3 Buffer) as every other TTS path.
async function synthesizeWithEdge(text, voiceName) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);

  return new Promise((resolve, reject) => {
    const chunks = [];
    const fail = (message) => {
      try { tts.close(); } catch { /* best-effort */ }
      const error = new Error(message);
      error.code = "BURMESE_TTS_REQUEST_FAILED";
      reject(error);
    };
    const timer = setTimeout(() => fail("Edge TTS request timed out"), REQUEST_TIMEOUT_MS);
    audioStream.on("data", (chunk) => chunks.push(chunk));
    audioStream.on("end", () => {
      clearTimeout(timer);
      try { tts.close(); } catch { /* best-effort */ }
      resolve(Buffer.concat(chunks));
    });
    audioStream.on("error", (err) => {
      clearTimeout(timer);
      fail(`Edge TTS request failed: ${err.message}`);
    });
  });
}

async function textToSpeech(text, voice) {
  const voiceName = voice || process.env.AZURE_SPEECH_VOICE || DEFAULT_VOICE;
  if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) {
    return synthesizeWithAzureRest(text, voiceName);
  }
  return synthesizeWithEdge(text, voiceName);
}

module.exports = { textToSpeech, DEFAULT_VOICE };
