const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth.middleware");
const { summary, todayPlan } = require("../../controllers/victoria/progress.controller");

router.get("/summary", auth, summary);
router.get("/today-plan", auth, todayPlan);

module.exports = router;
