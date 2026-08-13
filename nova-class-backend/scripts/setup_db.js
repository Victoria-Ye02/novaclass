const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function setup() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      username VARCHAR(50) UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('teacher','student') DEFAULT 'student',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Nullable: existing accounts (and Google sign-ins, which never collect an
  // ID) simply can't log in by username until one is set.
  // This server doesn't support `ADD COLUMN IF NOT EXISTS` (unlike the
  // `materials` patches below) — ER_DUP_FIELDNAME is caught instead.
  await conn.query(`ALTER TABLE users ADD COLUMN username VARCHAR(50) UNIQUE`).catch(err => {
    if (err.code !== "ER_DUP_FIELDNAME") throw err;
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS classes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      subject VARCHAR(100) DEFAULT 'General',
      code CHAR(6) NOT NULL UNIQUE,
      teacher_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS class_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      user_id INT NOT NULL,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_member (class_id, user_id),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      instructions TEXT,
      week INT DEFAULT 1,
      file_path VARCHAR(255),
      uploaded_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);
  // Add columns for existing installations
  await conn.query(`ALTER TABLE materials ADD COLUMN IF NOT EXISTS instructions TEXT`).catch(() => {});
  await conn.query(`ALTER TABLE materials ADD COLUMN IF NOT EXISTS week INT DEFAULT 1`).catch(() => {});

  await conn.query(`
    CREATE TABLE IF NOT EXISTS material_summaries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      material_id INT NOT NULL UNIQUE,
      summary_short TEXT,
      summary_paragraph TEXT,
      summary_detailed TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS material_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      material_id INT NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS material_page_bookmarks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      material_id INT NOT NULL,
      page_number INT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_material_page_bookmark (user_id, material_id, page_number),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS material_highlight_analyses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      material_id INT NOT NULL,
      source_fingerprint CHAR(64) NOT NULL,
      analysis_version INT UNSIGNED NOT NULL DEFAULT 1,
      status ENUM('pending','processing','ready','failed') NOT NULL DEFAULT 'pending',
      total_pages INT UNSIGNED NOT NULL,
      completed_pages INT UNSIGNED NOT NULL DEFAULT 0,
      failure_code VARCHAR(80),
      attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_material_highlight_analysis (material_id, source_fingerprint, analysis_version),
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS material_highlight_pages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      analysis_id INT NOT NULL,
      page_number INT UNSIGNED NOT NULL,
      source_type ENUM('text','ocr') NOT NULL,
      candidates_json LONGTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_material_highlight_page (analysis_id, page_number),
      FOREIGN KEY (analysis_id) REFERENCES material_highlight_analyses(id) ON DELETE CASCADE
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS material_pdf_highlights (
      id INT AUTO_INCREMENT PRIMARY KEY,
      analysis_id INT NOT NULL,
      page_number INT UNSIGNED NOT NULL,
      excerpt TEXT NOT NULL,
      explanation TEXT,
      category VARCHAR(80),
      rects_json JSON NOT NULL,
      display_order INT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (analysis_id) REFERENCES material_highlight_analyses(id) ON DELETE CASCADE
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      link_url VARCHAR(500),
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notifications_user (user_id, is_read, created_at)
    )
  `);

  console.log("✅ All tables created successfully");
  await conn.end();
}

setup().catch(err => { console.error("❌", err.message); process.exit(1); });
