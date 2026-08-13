const test = require("node:test");
const assert = require("node:assert/strict");

const service = require("../services/ai/elevenLabs");
const originalFetch = global.fetch;
const originalApiKey = process.env.ELEVENLABS_API_KEY;
const originalVoiceId = process.env.ELEVENLABS_VOICE_ID;

test.afterEach(() => {
  global.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.ELEVENLABS_API_KEY;
  else process.env.ELEVENLABS_API_KEY = originalApiKey;
  if (originalVoiceId === undefined) delete process.env.ELEVENLABS_VOICE_ID;
  else process.env.ELEVENLABS_VOICE_ID = originalVoiceId;
});

test("textToSpeech posts to the default voice with the API key header and returns audio bytes", async () => {
  process.env.ELEVENLABS_API_KEY = "test-key";
  delete process.env.ELEVENLABS_VOICE_ID;

  let capturedUrl, capturedOptions;
  global.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("fake-mp3-bytes").buffer,
    };
  };

  const audio = await service.textToSpeech("Hello there");

  assert.equal(capturedUrl, "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM");
  assert.equal(capturedOptions.headers["xi-api-key"], "test-key");
  assert.equal(JSON.parse(capturedOptions.body).text, "Hello there");
  assert.ok(Buffer.isBuffer(audio));
  assert.equal(audio.toString(), "fake-mp3-bytes");
});

test("textToSpeech uses ELEVENLABS_VOICE_ID when set, overridable per call", async () => {
  process.env.ELEVENLABS_API_KEY = "test-key";
  process.env.ELEVENLABS_VOICE_ID = "env-voice-id";

  let capturedUrl;
  global.fetch = async (url) => {
    capturedUrl = url;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
  };

  await service.textToSpeech("hi");
  assert.match(capturedUrl, /\/env-voice-id$/);

  await service.textToSpeech("hi", "explicit-voice-id");
  assert.match(capturedUrl, /\/explicit-voice-id$/);
});

test("textToSpeech throws a coded error without calling fetch when unconfigured", async () => {
  delete process.env.ELEVENLABS_API_KEY;
  global.fetch = async () => { throw new Error("fetch should not be called"); };

  await assert.rejects(
    () => service.textToSpeech("hi"),
    (err) => {
      assert.equal(err.code, "ELEVENLABS_NOT_CONFIGURED");
      return true;
    },
  );
});

test("textToSpeech throws a coded error on a non-OK response", async () => {
  process.env.ELEVENLABS_API_KEY = "test-key";
  global.fetch = async () => ({ ok: false, status: 401, text: async () => "Invalid API key" });

  await assert.rejects(
    () => service.textToSpeech("hi"),
    (err) => {
      assert.equal(err.code, "ELEVENLABS_REQUEST_FAILED");
      assert.match(err.message, /401/);
      return true;
    },
  );
});
