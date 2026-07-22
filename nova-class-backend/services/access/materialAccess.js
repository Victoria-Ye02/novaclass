const pool = require("../../config/db");

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

module.exports = { getAccessibleMaterial };
