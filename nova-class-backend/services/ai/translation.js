const MAX_CHARS_PER_REQUEST = 5000;

const TARGET_LANGUAGES = {
  my: "Burmese (Myanmar)",
  en: "English",
};

function splitText(text) {
  const chunks = [];
  let remaining = text.trim();

  while (remaining.length > MAX_CHARS_PER_REQUEST) {
    let splitAt = remaining.lastIndexOf(" ", MAX_CHARS_PER_REQUEST);
    if (splitAt <= 0) splitAt = MAX_CHARS_PER_REQUEST;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

async function translateText({ text, targetLanguage, completeText }) {
  if (!text || !text.trim()) throw new Error("text is required");
  if (!TARGET_LANGUAGES[targetLanguage]) {
    throw new Error("targetLanguage must be my or en");
  }
  if (typeof completeText !== "function") throw new Error("translation service is unavailable");

  const translations = [];
  for (const chunk of splitText(text)) {
    const completion = await completeText({
      maxTokens: 2048,
      messages: [
        {
          role: "system",
          content: `Translate the user's text faithfully into ${TARGET_LANGUAGES[targetLanguage]}. Return only the translation. Do not add explanations, labels, markdown, or the source text.`,
        },
        { role: "user", content: chunk },
      ],
    });
    translations.push(completion.choices[0].message.content.trim());
  }

  return translations.join("\n\n");
}

module.exports = { MAX_CHARS_PER_REQUEST, splitText, translateText };
