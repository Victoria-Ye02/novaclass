const MAX_CANDIDATES = 2000;
const MAX_TEXT_LENGTH = 1000;

function clampUnit(value) {
  return Math.min(1, Math.max(0, value));
}

function normalizeCandidates(input) {
  if (!Array.isArray(input)) return [];

  const normalized = [];
  const seenIds = new Set();

  for (const candidate of input) {
    if (normalized.length >= MAX_CANDIDATES) break;
    if (!candidate || typeof candidate !== "object") continue;

    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const text = typeof candidate.text === "string"
      ? candidate.text.trim().slice(0, MAX_TEXT_LENGTH)
      : "";
    const rect = candidate.rect;

    if (!id || !text || seenIds.has(id) || !rect || typeof rect !== "object") continue;

    const { x, y, width, height } = rect;
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) continue;

    const left = clampUnit(x);
    const top = clampUnit(y);
    const normalizedWidth = Math.min(width - Math.max(0, -x), 1 - left);
    const normalizedHeight = Math.min(height - Math.max(0, -y), 1 - top);

    if (normalizedWidth <= 0 || normalizedHeight <= 0) continue;

    seenIds.add(id);
    normalized.push({
      id,
      text,
      rect: { x: left, y: top, width: normalizedWidth, height: normalizedHeight },
    });
  }

  return normalized;
}

module.exports = { normalizeCandidates };
