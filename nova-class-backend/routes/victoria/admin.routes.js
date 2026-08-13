const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/victoria/admin.controller");

function adminOnly(req, res, next) {
  const secret = req.headers["x-admin-secret"];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.get("/stats", adminOnly, ctrl.getStats);

module.exports = router;
