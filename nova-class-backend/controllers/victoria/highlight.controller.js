const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const pool = require("../../config/db");
const ocr = require("../../services/ai/googleVisionOcr");
const { normalizeCandidates } = require("../../services/highlights/candidates");
const analyzer = require("../../services/highlights/analyze");

const ANALYSIS_VERSION = 1;
const MAX_PAGES = 2000;

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

async function getAccessibleMaterial(materialId, userId) {
  const [[material]] = await pool.query(
    "SELECT id, class_id, file_path FROM materials WHERE id = ?",
    [materialId]
  );
  if (!material) return { error: "Material not found", status: 404 };

  const [[classroom]] = await pool.query(
    "SELECT teacher_id FROM classes WHERE id = ?",
    [material.class_id]
  );
  if (!classroom) return { error: "Class not found", status: 404 };
  if (Number(classroom.teacher_id) === Number(userId)) return { material };

  const [memberships] = await pool.query(
    "SELECT 1 AS allowed FROM class_members WHERE class_id = ? AND user_id = ? LIMIT 1",
    [material.class_id, userId]
  );
  if (memberships.length === 0) {
    return { error: "Not a member of this class", status: 403 };
  }
  return { material };
}

async function sourceFingerprint(material) {
  const storedFilename = path.basename(material.file_path || "");
  if (!storedFilename) {
    const error = new Error("Material file not found");
    error.code = "MATERIAL_FILE_MISSING";
    throw error;
  }

  const filePath = path.join(__dirname, "../../uploads", storedFilename);
  const stat = await fs.promises.stat(filePath);
  return crypto
    .createHash("sha256")
    .update(JSON.stringify([storedFilename, stat.size, stat.mtimeMs]))
    .digest("hex");
}

async function currentAnalysis(materialId, fingerprint) {
  const [[analysis]] = await pool.query(
    `SELECT id, status, total_pages, completed_pages, attempt_count
     FROM material_highlight_analyses
     WHERE material_id = ? AND source_fingerprint = ? AND analysis_version = ?`,
    [materialId, fingerprint, ANALYSIS_VERSION]
  );
  return analysis;
}

async function analysisById(analysisId, materialId, fingerprint) {
  const [[analysis]] = await pool.query(
    `SELECT id, status, total_pages, completed_pages, attempt_count
     FROM material_highlight_analyses
     WHERE id = ? AND material_id = ? AND source_fingerprint = ? AND analysis_version = ?`,
    [analysisId, materialId, fingerprint, ANALYSIS_VERSION]
  );
  return analysis;
}

async function recoverStaleAnalysis(materialId, fingerprint) {
  return pool.query(
    `UPDATE material_highlight_analyses
     SET status = 'failed', failure_code = 'stale_processing'
     WHERE material_id = ? AND source_fingerprint = ? AND analysis_version = ?
       AND status = 'processing'
       AND updated_at <= DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
    [materialId, fingerprint, ANALYSIS_VERSION]
  );
}

async function submittedPages(analysisId) {
  const [rows] = await pool.query(
    `SELECT page_number
     FROM material_highlight_pages
     WHERE analysis_id = ?
     ORDER BY page_number ASC`,
    [analysisId]
  );
  return rows.map(row => Number(row.page_number));
}

function progressFor(analysis) {
  return {
    completedPages: Number(analysis?.completed_pages || 0),
    totalPages: Number(analysis?.total_pages || 0),
  };
}

function parseRects(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function groupedHighlights(analysisId) {
  const [rows] = await pool.query(
    `SELECT id, page_number, excerpt, explanation, category, rects_json
     FROM material_pdf_highlights
     WHERE analysis_id = ?
     ORDER BY page_number ASC, display_order ASC, id ASC`,
    [analysisId]
  );

  const grouped = {};
  for (const row of rows) {
    const pageNumber = Number(row.page_number);
    if (!grouped[pageNumber]) grouped[pageNumber] = [];
    grouped[pageNumber].push({
      id: Number(row.id),
      excerpt: row.excerpt,
      explanation: row.explanation,
      category: row.category,
      rects: parseRects(row.rects_json),
    });
  }
  return grouped;
}

function clientError(res, status, error) {
  return res.status(status).json({ error });
}

function serviceError(res, error) {
  if (error?.code === "ENOENT" || error?.code === "MATERIAL_FILE_MISSING") {
    return clientError(res, 404, "Material file not found");
  }
  return clientError(res, 500, "Highlight service unavailable");
}

async function accessAndFingerprint(req, res, materialId) {
  const access = await getAccessibleMaterial(materialId, req.user.id);
  if (access.error) {
    clientError(res, access.status, access.error);
    return null;
  }
  return {
    material: access.material,
    fingerprint: await sourceFingerprint(access.material),
  };
}

async function pageCount(analysisId) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS submitted_pages
     FROM material_highlight_pages
     WHERE analysis_id = ?`,
    [analysisId]
  );
  return Number(row.submitted_pages);
}

async function claimAnalysis(analysisId) {
  const [result] = await pool.query(
    `UPDATE material_highlight_analyses
     SET status='processing', failure_code=NULL, attempt_count=attempt_count + 1
     WHERE id=? AND status IN ('pending','failed')`,
    [analysisId]
  );
  return result.affectedRows === 1;
}

function launchAnalysis(analysisId, expectedAttemptCount) {
  Promise.resolve()
    .then(() => analyzer.analyzeHighlights(analysisId, { expectedAttemptCount }))
    .catch(async () => {
      try {
        await pool.query(
          `UPDATE material_highlight_analyses
           SET status = 'failed', failure_code = 'analysis_failed'
           WHERE id = ? AND status = 'processing' AND attempt_count = ?`,
          [analysisId, expectedAttemptCount]
        );
      } catch {
        // Keep provider and document details out of logs and API responses.
      }
    });
}

exports.getHighlights = async (req, res) => {
  const materialId = positiveInteger(req.params.materialId);
  if (!materialId) return clientError(res, 400, "Invalid materialId");

  try {
    const context = await accessAndFingerprint(req, res, materialId);
    if (!context) return;

    const analysis = await currentAnalysis(materialId, context.fingerprint);
    if (!analysis) {
      return res.json({
        status: "missing",
        progress: { completedPages: 0, totalPages: 0 },
        submittedPages: [],
        highlights: {},
      });
    }

    const pages = await submittedPages(analysis.id);
    const highlights = analysis.status === "ready"
      ? await groupedHighlights(analysis.id)
      : {};
    return res.json({
      status: analysis.status,
      progress: progressFor(analysis),
      submittedPages: pages,
      highlights,
    });
  } catch (error) {
    return serviceError(res, error);
  }
};

exports.startHighlights = async (req, res) => {
  const materialId = positiveInteger(req.params.materialId);
  const totalPages = positiveInteger(req.body.totalPages);
  if (!materialId) return clientError(res, 400, "Invalid materialId");
  if (!totalPages || totalPages > MAX_PAGES) {
    return clientError(res, 400, `totalPages must be an integer from 1 to ${MAX_PAGES}`);
  }

  try {
    const context = await accessAndFingerprint(req, res, materialId);
    if (!context) return;
    await recoverStaleAnalysis(materialId, context.fingerprint);

    await pool.query(
      `INSERT INTO material_highlight_analyses
         (material_id, source_fingerprint, analysis_version, total_pages)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [materialId, context.fingerprint, ANALYSIS_VERSION, totalPages]
    );
    const analysis = await currentAnalysis(materialId, context.fingerprint);
    if (!analysis) throw new Error("Analysis was not created");

    return res.json({
      analysisId: Number(analysis.id),
      status: analysis.status,
      progress: progressFor(analysis),
      submittedPages: await submittedPages(analysis.id),
    });
  } catch (error) {
    return serviceError(res, error);
  }
};

exports.submitHighlightPage = async (req, res) => {
  const materialId = positiveInteger(req.params.materialId);
  const analysisId = positiveInteger(req.body.analysisId);
  const pageNumber = positiveInteger(req.body.pageNumber);
  const sourceType = req.body.sourceType;
  if (!materialId) return clientError(res, 400, "Invalid materialId");
  if (!analysisId) return clientError(res, 400, "Invalid analysisId");
  if (!pageNumber) return clientError(res, 400, "pageNumber must be a positive integer");
  if (!new Set(["text", "ocr"]).has(sourceType)) {
    return clientError(res, 400, "sourceType must be text or ocr");
  }

  try {
    const context = await accessAndFingerprint(req, res, materialId);
    if (!context) return;
    const analysis = await analysisById(
      analysisId,
      materialId,
      context.fingerprint
    );
    if (!analysis) return clientError(res, 404, "Highlight analysis not found");
    if (pageNumber > Number(analysis.total_pages)) {
      return clientError(res, 400, "pageNumber exceeds analysis totalPages");
    }
    if (!["pending", "failed"].includes(analysis.status)) {
      return clientError(res, 409, "Highlight analysis is not accepting pages");
    }

    let candidates;
    if (sourceType === "ocr") {
      if (!Buffer.isBuffer(req.file?.buffer)) {
        return clientError(res, 400, "An in-memory page image is required for OCR");
      }
      candidates = await ocr.ocrPage(req.file.buffer);
    } else {
      let parsed;
      try {
        parsed = typeof req.body.candidates === "string"
          ? JSON.parse(req.body.candidates)
          : req.body.candidates;
      } catch {
        return clientError(res, 400, "Invalid candidates payload");
      }
      if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 2000) {
        return clientError(res, 400, "Invalid candidates payload");
      }
      candidates = normalizeCandidates(parsed);
      if (candidates.length !== parsed.length) {
        return clientError(res, 400, "Invalid candidates payload");
      }
    }

    const storedCandidates = candidates.map(candidate => ({
      ...candidate,
      pageNumber,
    }));
    await pool.query(
      `INSERT INTO material_highlight_pages
         (analysis_id, page_number, source_type, candidates_json)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         source_type = VALUES(source_type),
         candidates_json = VALUES(candidates_json)`,
      [analysisId, pageNumber, sourceType, JSON.stringify(storedCandidates)]
    );

    return res.status(201).json({
      analysisId,
      pageNumber,
      sourceType,
      candidateCount: storedCandidates.length,
    });
  } catch (error) {
    return serviceError(res, error);
  }
};

exports.completeHighlights = async (req, res) => {
  const materialId = positiveInteger(req.params.materialId);
  const analysisId = positiveInteger(req.body.analysisId);
  if (!materialId) return clientError(res, 400, "Invalid materialId");
  if (!analysisId) return clientError(res, 400, "Invalid analysisId");

  try {
    const context = await accessAndFingerprint(req, res, materialId);
    if (!context) return;
    await recoverStaleAnalysis(materialId, context.fingerprint);
    const analysis = await analysisById(
      analysisId,
      materialId,
      context.fingerprint
    );
    if (!analysis) return clientError(res, 404, "Highlight analysis not found");
    if (await pageCount(analysis.id) !== Number(analysis.total_pages)) {
      return clientError(res, 409, "All PDF pages must be submitted before analysis");
    }

    const claimed = await claimAnalysis(analysis.id);
    if (claimed) {
      launchAnalysis(analysis.id, Number(analysis.attempt_count || 0) + 1);
    }
    const status = claimed || analysis.status !== "ready" ? "processing" : "ready";
    return res.status(status === "processing" ? 202 : 200).json({
      analysisId: Number(analysis.id),
      status,
    });
  } catch (error) {
    return serviceError(res, error);
  }
};

exports.retryHighlights = async (req, res) => {
  const materialId = positiveInteger(req.params.materialId);
  if (!materialId) return clientError(res, 400, "Invalid materialId");

  try {
    const context = await accessAndFingerprint(req, res, materialId);
    if (!context) return;
    await recoverStaleAnalysis(materialId, context.fingerprint);
    const analysis = await currentAnalysis(materialId, context.fingerprint);
    if (!analysis) return clientError(res, 404, "Highlight analysis not found");
    if (analysis.status === "ready") {
      return res.json({
        analysisId: Number(analysis.id),
        status: "ready",
        progress: progressFor(analysis),
      });
    }
    if (await pageCount(analysis.id) !== Number(analysis.total_pages)) {
      return clientError(res, 409, "All PDF pages must be submitted before analysis");
    }

    const claimed = await claimAnalysis(analysis.id);
    if (claimed) {
      launchAnalysis(analysis.id, Number(analysis.attempt_count || 0) + 1);
    }
    return res.status(202).json({
      analysisId: Number(analysis.id),
      status: "processing",
      progress: progressFor(analysis),
    });
  } catch (error) {
    return serviceError(res, error);
  }
};
