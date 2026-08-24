const express = require("express");
const router = express.Router();
const { summarize, chat, translate } = require("../../controllers/victoria/ai.controller");
const auth = require("../../middleware/auth.middleware");

router.post("/summarize", auth, summarize);
router.post("/chat", auth, chat);
router.post("/translate", auth, translate);

module.exports = router;
