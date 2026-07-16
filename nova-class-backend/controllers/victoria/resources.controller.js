const pool = require("../../config/db");
const fs = require("fs");

async function checkAccess(classId, userId) {
  const [classes] = await pool.query("SELECT * FROM classes WHERE id = ?", [classId]);
  if (classes.length === 0) return { error: "Class not found", status: 404 };
  const cls = classes[0];
  if (cls.teacher_id === userId) return { cls, role: "teacher" };
  const [members] = await pool.query(
    "SELECT * FROM class_members WHERE class_id = ? AND user_id = ?",
    [classId, userId]
  );
  if (members.length === 0) return { error: "Not a member", status: 403 };
  return { cls, role: "student" };
}

// GET /api/classroom/classes/:id/resources
exports.listResources = async (req, res) => {
  try {
    const access = await checkAccess(req.params.id, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const [resources] = await pool.query(
      `SELECT r.*, u.name AS added_by_name FROM resources r
       JOIN users u ON u.id = r.added_by
       WHERE r.class_id = ? ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json(resources.map(r => ({
      ...r,
      file_url: r.file_path ? `/uploads/${r.file_path}` : null,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/classroom/classes/:id/resources
exports.addResource = async (req, res) => {
  try {
    const access = await checkAccess(req.params.id, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });

    const { title, url } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });

    const filePath = req.file ? req.file.filename : null;
    const type = filePath ? "file" : "link";
    if (type === "link" && !url?.trim()) return res.status(400).json({ error: "URL is required for link" });

    const [result] = await pool.query(
      "INSERT INTO resources (class_id, title, url, file_path, type, added_by) VALUES (?, ?, ?, ?, ?, ?)",
      [req.params.id, title.trim(), url || null, filePath, type, req.user.id]
    );

    const [[resource]] = await pool.query(
      `SELECT r.*, u.name AS added_by_name FROM resources r JOIN users u ON u.id = r.added_by WHERE r.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ ...resource, file_url: filePath ? `/uploads/${filePath}` : null });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/classroom/resources/:id
exports.deleteResource = async (req, res) => {
  try {
    const [[resource]] = await pool.query("SELECT * FROM resources WHERE id = ?", [req.params.id]);
    if (!resource) return res.status(404).json({ error: "Resource not found" });

    const access = await checkAccess(resource.class_id, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });

    if (resource.file_path) fs.unlink(`uploads/${resource.file_path}`, () => {});
    await pool.query("DELETE FROM resources WHERE id = ?", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
