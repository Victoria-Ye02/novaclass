const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth.middleware");
const {
  getFreshExam,
  submitExam,
  getAnalytics,
  gradeWriting,
} = require("../../controllers/thine/exam.controller");

router.get("/exam/fresh",     auth, getFreshExam);
router.post("/exam/submit",   auth, submitExam);
router.get("/analytics",      auth, getAnalytics);
router.post("/writing/grade", auth, gradeWriting);

module.exports = router;
