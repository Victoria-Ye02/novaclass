const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { ask, history, generateQuiz, checkQuiz } = require("../controllers/kmate.controller");

router.post("/ask",           auth, ask);
router.get("/history",        auth, history);
router.post("/quiz/generate", auth, generateQuiz);
router.post("/quiz/check",    auth, checkQuiz);

module.exports = router;
