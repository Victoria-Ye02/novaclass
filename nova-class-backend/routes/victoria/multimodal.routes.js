const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const auth = require("../../middleware/auth.middleware");
const { analyzeFile, transcribe } = require("../../controllers/victoria/multimodal.controller");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post("/analyze", auth, upload.single("file"), analyzeFile);
router.post("/transcribe", auth, upload.single("audio"), transcribe);

module.exports = router;
