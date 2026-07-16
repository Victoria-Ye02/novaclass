const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const { summary } = require("../controllers/progress.controller");

router.get("/summary", auth, summary);

module.exports = router;
