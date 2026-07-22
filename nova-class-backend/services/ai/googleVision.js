const vision = require("@google-cloud/vision");

let client;

function getClient() {
  if (!client) client = new vision.ImageAnnotatorClient();
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
