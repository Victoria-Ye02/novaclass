const test = require("node:test");
const assert = require("node:assert/strict");

const service = require("../services/ai/burmeseTts");
const originalFetch = global.fetch;
const originalKey = process.env.AZURE_SPEECH_KEY;
const originalRegion = process.env.AZURE_SPEECH_REGION;
const originalVoice = process.env.AZURE_SPEECH_VOICE;

function restore(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test.afterEach(() => {
  global.fetch = originalFetch;
  restore("AZURE_SPEECH_KEY", originalKey);
  restore("AZURE_SPEECH_REGION", originalRegion);
  restore("AZURE_SPEECH_VOICE", originalVoice);
});

// These tests cover the *official Azure* path, taken only when a key + region
// are configured. The default path (Microsoft Edge's free Read Aloud endpoint)
// hits a live network service and is verified manually rather than here, to
// keep the suite offline and deterministic.

test("uses the Azure REST endpoint with the subscription key and returns audio bytes when a key is configured", async () => {
  process.env.AZURE_SPEECH_KEY = "test-key";
  process.env.AZURE_SPEECH_REGION = "southeastasia";
  delete process.env.AZURE_SPEECH_VOICE;

  let capturedUrl, capturedOptions;
  global.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode("azure-mp3-bytes").buffer };
  };

  const audio = await service.textToSpeech("မင်္ဂလာပါ");

  assert.equal(capturedUrl, "https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1");
  assert.equal(capturedOptions.headers["Ocp-Apim-Subscription-Key"], "test-key");
  assert.equal(capturedOptions.headers["Content-Type"], "application/ssml+xml");
  assert.match(capturedOptions.body, /name='my-MM-NilarNeural'/);
  assert.match(capturedOptions.body, /မင်္ဂလာပါ/);
  assert.ok(Buffer.isBuffer(audio));
  assert.equal(audio.toString(), "azure-mp3-bytes");
});

test("XML-escapes special characters so they can't break or inject into the SSML", async () => {
  process.env.AZURE_SPEECH_KEY = "test-key";
  process.env.AZURE_SPEECH_REGION = "eastus";

  let body;
  global.fetch = async (_url, options) => {
    body = options.body;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
  };

  await service.textToSpeech(`Tom & Jerry say "<hi>"`);

  assert.match(body, /Tom &amp; Jerry say &quot;&lt;hi&gt;&quot;/);
  assert.doesNotMatch(body, /<hi>/); // the raw tag must not survive into the SSML
});

test("uses AZURE_SPEECH_VOICE when set, overridable per call", async () => {
  process.env.AZURE_SPEECH_KEY = "test-key";
  process.env.AZURE_SPEECH_REGION = "eastus";
  process.env.AZURE_SPEECH_VOICE = "my-MM-ThihaNeural";

  let body;
  global.fetch = async (_url, options) => {
    body = options.body;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
  };

  await service.textToSpeech("hi");
  assert.match(body, /name='my-MM-ThihaNeural'/);

  await service.textToSpeech("hi", "my-MM-NilarNeural");
  assert.match(body, /name='my-MM-NilarNeural'/);
});

test("throws a coded error on a non-OK Azure response", async () => {
  process.env.AZURE_SPEECH_KEY = "test-key";
  process.env.AZURE_SPEECH_REGION = "eastus";
  global.fetch = async () => ({ ok: false, status: 401, text: async () => "Unauthorized" });

  await assert.rejects(
    () => service.textToSpeech("hi"),
    (err) => {
      assert.equal(err.code, "BURMESE_TTS_REQUEST_FAILED");
      assert.match(err.message, /401/);
      return true;
    },
  );
});
