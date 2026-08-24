const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { extractPdfTextWithPageMarkers } = require("../controllers/victoria/classroom.controller");

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [mats] = await conn.query(
    "SELECT id, file_path FROM materials WHERE class_id = (SELECT id FROM classes WHERE code='DEMO01') AND file_path IS NOT NULL"
  );

  for (const m of mats) {
    const filePath = path.join(__dirname, "../uploads", m.file_path);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping material ${m.id} — file not found: ${filePath}`);
      continue;
    }
    const buffer = fs.readFileSync(filePath);
    try {
      const text = await extractPdfTextWithPageMarkers(buffer);
      await conn.query("UPDATE materials SET text_content = ? WHERE id = ?", [text, m.id]);
      console.log(`✅ Material ${m.id} — extracted ${text.length} chars`);
    } catch (err) {
      console.log(`❌ Material ${m.id} — extraction failed: ${err.message}`);
    }
  }

  // Clear any stale AI cache from the earlier hallucinated runs
  await conn.query(
    "DELETE FROM material_ai_cache WHERE material_id IN (SELECT id FROM materials WHERE class_id = (SELECT id FROM classes WHERE code='DEMO01'))"
  ).catch(() => {});

  await conn.end();
  console.log("Done!");
}

run().catch(err => { console.error(err); process.exit(1); });
