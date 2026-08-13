const express = require("express");
const router = express.Router();
const { register, login, googleLogin, me, updateMe, deleteMe } = require("../../controllers/victoria/auth.controller");
const auth = require("../../middleware/auth.middleware");

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.get("/me", auth, me);
router.put("/me", auth, updateMe);
router.delete("/me", auth, deleteMe);

module.exports = router;
