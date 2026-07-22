const pool = require("../../config/db");
const groq = require("../ai/groqText");
const { normalizeCandidates } = require("./candidates");
const { withRetries } = require("./retry");

const MAX_BATCH_PAGES = 20;
const MAX_BATCH_CANDIDATES = 6000;
const MAX_BATCH_TEXT_CHARACTERS = 50000;
const MAX_SELECTIONS = 100;
const MAX_CANDIDATES_PER_SELECTION = 20;
const CATEGORIES = new Set(["concept", "formula", "definition", "conclusion"]);

const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "pdf_highlight_selection",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["highlights"],
      properties: {
        highlights: {
          type: "array",
          maxItems: MAX_SELECTIONS,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["pageNumber", "candidateIds", "explanation", "category"],
            properties: {
              pageNumber: { type: "integer", minimum: 1 },
              candidateIds: {
                type: "array",
                minItems: 1,
                maxItems: MAX_CANDIDATES_PER_SELECTION,
                items: { type: "string" },
              },
              explanation: { type: "string" },
              category: {
                type: "string",
                enum: ["concept", "formula", "definition", "conclusion"],
              },
            },
          },
        },
      },
    },
  },
};

function candidatesForPage(row) {
  let parsed;
  try {
    parsed = typeof row.candidates_json === "string"
      ? JSON.parse(row.candidates_json)
      : row.candidates_json;
  } catch {
    throw new Error("Invalid stored candidate payload");
  }

  const pageNumber = Number(row.page_number);
  return normalizeCandidates(parsed).map(candidate => ({
    ...candidate,
    pageNumber,
  }));
}

function boundedBatch(rows) {
  const pages = [];
  let candidateCount = 0;
  let textCharacters = 0;

  for (const row of rows.slice(0, MAX_BATCH_PAGES)) {
    const allCandidates = candidatesForPage(row);
    const pageCharacters = allCandidates.reduce(
      (total, candidate) => total + candidate.text.length,
      0
    );
    const exceedsBatch = candidateCount + allCandidates.length > MAX_BATCH_CANDIDATES
      || textCharacters + pageCharacters > MAX_BATCH_TEXT_CHARACTERS;
    if (pages.length > 0 && exceedsBatch) break;

    const candidates = [];
    let acceptedCharacters = 0;
    for (const candidate of allCandidates) {
      if (candidateCount + candidates.length >= MAX_BATCH_CANDIDATES) break;
      if (textCharacters + acceptedCharacters + candidate.text.length
        > MAX_BATCH_TEXT_CHARACTERS) break;
      candidates.push(candidate);
      acceptedCharacters += candidate.text.length;
    }
    pages.push({ pageNumber: Number(row.page_number), candidates });
    candidateCount += candidates.length;
    textCharacters += acceptedCharacters;
  }

  return pages;
}

function requestFor(pages) {
  const candidates = pages.flatMap(page => page.candidates.map(candidate => ({
    pageNumber: candidate.pageNumber,
    id: candidate.id,
    text: candidate.text,
  })));
  return {
    messages: [
      {
        role: "system",
        content: "Select only the most important study passages. Return candidate IDs exactly as supplied and do not reproduce unrelated text.",
      },
      {
        role: "user",
        content: JSON.stringify({ candidates }),
      },
    ],
    maxTokens: 4000,
    responseFormat: RESPONSE_FORMAT,
  };
}

function validateModelOutput(completion) {
  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Invalid highlight model output");

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Invalid highlight model output");
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.highlights)
    || parsed.highlights.length > MAX_SELECTIONS) {
    throw new Error("Invalid highlight model output");
  }

  for (const selection of parsed.highlights) {
    if (!selection || typeof selection !== "object"
      || !Number.isInteger(selection.pageNumber) || selection.pageNumber <= 0
      || !Array.isArray(selection.candidateIds) || selection.candidateIds.length === 0
      || selection.candidateIds.length > MAX_CANDIDATES_PER_SELECTION
      || !selection.candidateIds.every(id => typeof id === "string")
      || typeof selection.explanation !== "string"
      || !CATEGORIES.has(selection.category)) {
      throw new Error("Invalid highlight model output");
    }
  }
  return parsed.highlights;
}

function adjacent(left, right) {
  const leftBottom = left.y + left.height;
  const rightBottom = right.y + right.height;
  const verticalOverlap = Math.min(leftBottom, rightBottom) - Math.max(left.y, right.y);
  const minimumHeight = Math.min(left.height, right.height);
  const horizontalGap = right.x - (left.x + left.width);
  return verticalOverlap >= minimumHeight * 0.5 && horizontalGap <= 0.02;
}

function mergeAdjacentRects(candidates) {
  const unique = new Map();
  for (const candidate of candidates) {
    const rect = candidate.rect;
    unique.set([rect.x, rect.y, rect.width, rect.height].join(":"), { ...rect });
  }
  const ordered = [...unique.values()].sort((left, right) => left.y - right.y || left.x - right.x);
  const merged = [];

  for (const rect of ordered) {
    const previous = merged.at(-1);
    if (!previous || !adjacent(previous, rect)) {
      merged.push(rect);
      continue;
    }
    const right = Math.max(previous.x + previous.width, rect.x + rect.width);
    const bottom = Math.max(previous.y + previous.height, rect.y + rect.height);
    previous.x = Math.min(previous.x, rect.x);
    previous.y = Math.min(previous.y, rect.y);
    previous.width = right - previous.x;
    previous.height = bottom - previous.y;
  }
  return merged;
}

function acceptedHighlights(selections, pages) {
  const candidatesByPage = new Map(
    pages.map(page => [page.pageNumber, page.candidates])
  );
  const accepted = [];

  for (const selection of selections) {
    const pageCandidates = candidatesByPage.get(selection.pageNumber);
    if (!pageCandidates) continue;
    const selectedIds = new Set(selection.candidateIds);
    const selected = pageCandidates.filter(candidate => selectedIds.has(candidate.id));
    if (selected.length === 0) continue;

    accepted.push({
      pageNumber: selection.pageNumber,
      excerpt: selected.map(candidate => candidate.text).join(" ").slice(0, 10000),
      explanation: selection.explanation.trim().slice(0, 1000),
      category: selection.category,
      rects: mergeAdjacentRects(selected),
    });
  }
  return accepted;
}

async function persistBatch(db, analysisId, expectedAttemptCount, pages, highlights) {
  const connection = await db.getConnection();
  const pageNumbers = pages.map(page => page.pageNumber);
  const lastPage = pageNumbers.at(-1);
  const displayOrders = new Map();

  try {
    await connection.beginTransaction();
    const placeholders = pageNumbers.map(() => "?").join(", ");
    await connection.query(
      `DELETE FROM material_pdf_highlights
       WHERE analysis_id = ? AND page_number IN (${placeholders})`,
      [analysisId, ...pageNumbers]
    );

    for (const highlight of highlights) {
      const displayOrder = displayOrders.get(highlight.pageNumber) || 0;
      await connection.query(
        `INSERT INTO material_pdf_highlights
           (analysis_id, page_number, excerpt, explanation, category, rects_json, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          analysisId,
          highlight.pageNumber,
          highlight.excerpt,
          highlight.explanation,
          highlight.category,
          JSON.stringify(highlight.rects),
          displayOrder,
        ]
      );
      displayOrders.set(highlight.pageNumber, displayOrder + 1);
    }

    const [progress] = await connection.query(
      `UPDATE material_highlight_analyses
       SET completed_pages = ?
       WHERE id = ? AND status = 'processing' AND attempt_count = ?`,
      [lastPage, analysisId, expectedAttemptCount]
    );
    if (progress.affectedRows !== 1) throw new Error("Highlight analysis claim was lost");
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function analyzeHighlights(
  analysisId,
  {
    db = pool,
    completeText = groq.completeText,
    expectedAttemptCount,
    retryBaseDelayMs = 250,
  } = {}
) {
  const [[analysis]] = await db.query(
    `SELECT id, status, total_pages, completed_pages, attempt_count
     FROM material_highlight_analyses
     WHERE id = ?`,
    [analysisId]
  );
  if (!analysis || analysis.status !== "processing") return;
  const activeAttemptCount = Number(analysis.attempt_count || 0);
  if (expectedAttemptCount !== undefined
    && Number(expectedAttemptCount) !== activeAttemptCount) return;

  const totalPages = Number(analysis.total_pages);
  const [[submitted]] = await db.query(
    `SELECT COUNT(*) AS submitted_pages,
            MIN(page_number) AS first_page,
            MAX(page_number) AS last_page
     FROM material_highlight_pages
     WHERE analysis_id = ?`,
    [analysisId]
  );
  if (Number(submitted.submitted_pages) !== totalPages
    || Number(submitted.first_page) !== 1
    || Number(submitted.last_page) !== totalPages) {
    throw new Error("Highlight pages are incomplete");
  }

  let completedPages = Number(analysis.completed_pages || 0);
  while (completedPages < totalPages) {
    const [rows] = await db.query(
      `SELECT page_number, candidates_json
       FROM material_highlight_pages
       WHERE analysis_id = ? AND page_number > ?
       ORDER BY page_number ASC
       LIMIT ${MAX_BATCH_PAGES}`,
      [analysisId, completedPages]
    );
    const pages = boundedBatch(rows);
    if (pages.length === 0) throw new Error("Highlight pages are incomplete");

    let selections = [];
    if (pages.some(page => page.candidates.length > 0)) {
      selections = await withRetries(async () => {
        const completion = await completeText(requestFor(pages));
        return validateModelOutput(completion);
      }, { retries: 3, baseDelayMs: retryBaseDelayMs });
    }
    const highlights = acceptedHighlights(selections, pages);
    await persistBatch(db, analysisId, activeAttemptCount, pages, highlights);
    completedPages = pages.at(-1).pageNumber;
  }

  const [ready] = await db.query(
    `UPDATE material_highlight_analyses
     SET status = 'ready', failure_code = NULL
     WHERE id = ? AND status = 'processing' AND completed_pages = ? AND attempt_count = ?`,
    [analysisId, totalPages, activeAttemptCount]
  );
  if (ready.affectedRows !== 1) throw new Error("Highlight analysis was not finalized");
}

module.exports = {
  analyzeHighlights,
  mergeAdjacentRects,
};
