const express = require("express");
const router = express.Router();
const { summarize, chat } = require("../controllers/ai.controller");
const auth = require("../middleware/auth.middleware");

router.post("/summarize", auth, summarize);
router.post("/chat", auth, chat);

module.exports = router;
