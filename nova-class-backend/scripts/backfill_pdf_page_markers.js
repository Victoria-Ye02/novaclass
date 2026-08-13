// One-time backfill: materials uploaded before extractPdfTextWithPageMarkers()
// existed have plain, unmarked text_content, so the AI chat can't map "page N"
// to that page's actual text. Re-extracts every PDF material from its
// original uploaded file and rewrites text_content with page markers.
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const pool = require("../config/db");
const { extractPdfTextWithPageMarkers } = require("../controllers/victoria/classroom.controller");

const UPLOADS_DIR = path.join(__dirname, "../uploads");
const ALREADY_MARKED_RE = /\f<<PAGE \d+>>\f/;

async function run() {
  const [materials] = await pool.query(
    "SELECT id, title, file_path, text_content FROM materials WHERE file_path IS NOT NULL AND file_path LIKE '%.pdf'"
  );

  let updated = 0, skippedAlreadyMarked = 0, skippedMissingFile = 0, failed = 0;

  for (const m of materials) {
    if (m.text_content && ALREADY_MARKED_RE.test(m.text_content)) {
      skippedAlreadyMarked++;
      continue;
    }

    const filePath = path.join(UPLOADS_DIR, path.basename(m.file_path));
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠ material ${m.id} ("${m.title}"): file missing at ${filePath}, skipped`);
      skippedMissingFile++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(filePath);
      const text = await extractPdfTextWithPageMarkers(buffer);
      await pool.query("UPDATE materials SET text_content = ? WHERE id = ?", [text || null, m.id]);
      console.log(`✅ material ${m.id} ("${m.title}"): re-extracted with page markers`);
      updated++;
    } catch (err) {
      console.error(`❌ material ${m.id} ("${m.title}"): ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. updated=${updated} already-marked=${skippedAlreadyMarked} missing-file=${skippedMissingFile} failed=${failed}`);
  await pool.end();
}

run().catch(err => { console.error("❌", err.message); process.exit(1); });
