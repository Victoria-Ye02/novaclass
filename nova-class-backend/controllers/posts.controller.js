const pool = require("../config/db");

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

// GET /api/classroom/classes/:id/posts
exports.getPosts = async (req, res) => {
  try {
    const access = await checkAccess(req.params.id, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const [posts] = await pool.query(
      `SELECT p.id, p.content, p.type, p.material_id, p.created_at,
              u.id AS author_id, u.name AS author_name,
              m.title AS material_title, m.file_path AS material_file,
              m.instructions AS material_instructions
       FROM class_posts p
       JOIN users u ON u.id = p.author_id
       LEFT JOIN materials m ON m.id = p.material_id
       WHERE p.class_id = ?
       ORDER BY p.created_at DESC`,
      [req.params.id]
    );

    const [comments] = await pool.query(
      `SELECT c.id, c.post_id, c.content, c.created_at,
              u.id AS author_id, u.name AS author_name
       FROM post_comments c
       JOIN users u ON u.id = c.author_id
       WHERE c.post_id IN (
         SELECT id FROM class_posts WHERE class_id = ?
       )
       ORDER BY c.created_at ASC`,
      [req.params.id]
    );

    const commentsByPost = {};
    comments.forEach(c => {
      if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
      commentsByPost[c.post_id].push(c);
    });

    const result = posts.map(p => ({
      ...p,
      material_file_url: p.material_file ? `/uploads/${p.material_file}` : null,
      comments: commentsByPost[p.id] || [],
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/classroom/classes/:id/posts
exports.createPost = async (req, res) => {
  try {
    const access = await checkAccess(req.params.id, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Only teachers can post" });

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Content is required" });

    const [result] = await pool.query(
      "INSERT INTO class_posts (class_id, author_id, content, type) VALUES (?, ?, ?, 'announcement')",
      [req.params.id, req.user.id, content.trim()]
    );

    const [[post]] = await pool.query(
      `SELECT p.id, p.content, p.type, p.created_at, u.name AS author_name
       FROM class_posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ ...post, comments: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/classroom/posts/:postId/comments
exports.addComment = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Content is required" });

    const [[post]] = await pool.query("SELECT * FROM class_posts WHERE id = ?", [req.params.postId]);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const access = await checkAccess(post.class_id, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const [result] = await pool.query(
      "INSERT INTO post_comments (post_id, author_id, content) VALUES (?, ?, ?)",
      [req.params.postId, req.user.id, content.trim()]
    );

    const [[comment]] = await pool.query(
      `SELECT c.id, c.content, c.created_at, u.name AS author_name
       FROM post_comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?`,
      [result.insertId]
    );

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/classroom/posts/:postId  (teacher: edit)
exports.editPost = async (req, res) => {
  try {
    const [[post]] = await pool.query("SELECT * FROM class_posts WHERE id=?", [req.params.postId]);
    if (!post) return res.status(404).json({ error: "Post not found" });
    const access = await checkAccess(post.class_id, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });
    const { content } = req.body;
    await pool.query("UPDATE class_posts SET content=? WHERE id=?", [content, req.params.postId]);
    res.json({ id: post.id, content });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// DELETE /api/classroom/posts/:postId  (teacher: delete)
exports.deletePost = async (req, res) => {
  try {
    const [[post]] = await pool.query("SELECT * FROM class_posts WHERE id=?", [req.params.postId]);
    if (!post) return res.status(404).json({ error: "Post not found" });
    const access = await checkAccess(post.class_id, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });
    await pool.query("DELETE FROM class_posts WHERE id=?", [req.params.postId]);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
