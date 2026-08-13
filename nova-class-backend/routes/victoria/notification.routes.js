const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth.middleware");
const ctrl = require("../../controllers/victoria/notification.controller");

router.get("/", auth, ctrl.list);
router.get("/unread-count", auth, ctrl.unreadCount);
router.post("/:id/read", auth, ctrl.markRead);
router.post("/read-all", auth, ctrl.markAllRead);

module.exports = router;
