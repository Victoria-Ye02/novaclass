const mysql = require("mysql2/promise");
require("dotenv").config({ path: "../.env" });

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
      password VARCHAR(255) NOT NULL,
      role ENUM('teacher','student') DEFAULT 'student',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

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

  console.log("✅ All tables created successfully");
  await conn.end();
}

setup().catch(err => { console.error("❌", err.message); process.exit(1); });
