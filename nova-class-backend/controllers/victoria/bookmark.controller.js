const pool = require("../../config/db");
const { getAccessibleMaterial } = require("../../services/access/materialAccess");

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

exports.listBookmarks = async (req, res) => {
  const materialId = positiveInteger(req.params.materialId);
  if (!materialId) return res.status(400).json({ error: "Invalid materialId" });

  try {
    const access = await getAccessibleMaterial(materialId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const [rows] = await pool.query(
      `SELECT page_number
       FROM material_page_bookmarks
       WHERE user_id = ? AND material_id = ?
       ORDER BY page_number ASC`,
      [req.user.id, materialId]
    );
    res.json({ pages: rows.map((row) => Number(row.page_number)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.saveBookmark = async (req, res) => {
  const materialId = positiveInteger(req.params.materialId);
  const pageNumber = positiveInteger(req.body.pageNumber);
  if (!materialId) return res.status(400).json({ error: "Invalid materialId" });
  if (!pageNumber) {
    return res.status(400).json({ error: "pageNumber must be a positive integer" });
  }

  try {
    const access = await getAccessibleMaterial(materialId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    await pool.query(
      `INSERT IGNORE INTO material_page_bookmarks (user_id, material_id, page_number)
       VALUES (?, ?, ?)`,
      [req.user.id, materialId, pageNumber]
    );
    res.status(201).json({ pageNumber, saved: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.removeBookmark = async (req, res) => {
  const materialId = positiveInteger(req.params.materialId);
  const pageNumber = positiveInteger(req.params.pageNumber);
  if (!materialId) return res.status(400).json({ error: "Invalid materialId" });
  if (!pageNumber) {
    return res.status(400).json({ error: "pageNumber must be a positive integer" });
  }

  try {
    const access = await getAccessibleMaterial(materialId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    await pool.query(
      `DELETE FROM material_page_bookmarks
       WHERE user_id = ? AND material_id = ? AND page_number = ?`,
      [req.user.id, materialId, pageNumber]
    );
    res.json({ pageNumber, saved: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
