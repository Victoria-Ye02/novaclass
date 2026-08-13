const fs = require("fs");
const vision = require("@google-cloud/vision");

let client;

function assertVisionConfigured() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath && fs.existsSync(credentialsPath)) return;

  // google-auth-library's application-default-credentials discovery throws a
  // second, genuinely unhandled internal exception (separate from the promise
  // callers await) when no ADC source is configured, crashing the whole
  // process regardless of any try/catch here. Never let it start that
  // discovery: fail fast and synchronously before constructing a real client.
  const error = new Error(
    "Google Cloud Vision is not configured (GOOGLE_APPLICATION_CREDENTIALS is unset or unreadable)"
  );
  error.code = "VISION_NOT_CONFIGURED";
  throw error;
}

function getClient() {
  if (!client) {
    assertVisionConfigured();
    client = new vision.ImageAnnotatorClient();
  }
  return client;
}

async function extractImageContext(buffer) {
  const [result] = await getClient().annotateImage({
    image: { content: buffer },
    features: [
      { type: "DOCUMENT_TEXT_DETECTION" },
      { type: "LABEL_DETECTION", maxResults: 12 },
      { type: "OBJECT_LOCALIZATION", maxResults: 12 },
    ],
  });

  return {
    text: (result.fullTextAnnotation?.text || "").slice(0, 12000),
    labels: (result.labelAnnotations || []).map(item => item.description).filter(Boolean),
    objects: (result.localizedObjectAnnotations || []).map(item => item.name).filter(Boolean),
  };
}

async function detectDocumentText(buffer) {
  const [result] = await getClient().documentTextDetection({ image: { content: buffer } });
  return result.fullTextAnnotation || { text: "", pages: [] };
}

function setVisionClientForTests(nextClient) { client = nextClient; }

module.exports = { extractImageContext, detectDocumentText, setVisionClientForTests };
