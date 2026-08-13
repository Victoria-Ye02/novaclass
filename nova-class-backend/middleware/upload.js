const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});

// Document formats — for materials/resources (PDF, Word, PowerPoint, images, video)
const ALLOWED_DOCUMENT_MIMETYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
]);
const documentUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_DOCUMENT_MIMETYPES.has(file.mimetype)) cb(null, true);
    else cb(new Error("PDF, DOCX, PPTX, PNG, JPEG, WEBP, GIF, MP4, WEBM 파일만 업로드할 수 있습니다."), false);
  },
});

// Any file — for assignment submissions
const anyFile = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const highlightPageImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ["image/png", "image/jpeg"].includes(file.mimetype)),
});

// Materials — one primary document (drives PDF viewer/OCR/highlights,
// unchanged) plus any number of supplementary attachments.
const materialUpload = documentUpload.fields([
  { name: "file", maxCount: 1 },
  { name: "files", maxCount: 10 },
]);

module.exports = documentUpload;
module.exports.anyFile = anyFile;
module.exports.highlightPageImage = highlightPageImage;
module.exports.materialUpload = materialUpload;
