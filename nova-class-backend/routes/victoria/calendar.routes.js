const router = require("express").Router();
const auth = require("../../middleware/auth.middleware");
const c = require("../../controllers/victoria/calendar.controller");

router.get("/events", auth, c.getEvents);
router.post("/events", auth, c.createEvent);
router.delete("/events/:id", auth, c.deleteEvent);

module.exports = router;
