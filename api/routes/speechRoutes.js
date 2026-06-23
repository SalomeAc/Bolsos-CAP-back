const express = require("express");
const authenticateToken = require("../middlewares/auth");
const { getSpeechToken, textToSpeech } = require("../controllers/speechController");

const router = express.Router();

router.get("/token", authenticateToken, getSpeechToken);
router.post("/", textToSpeech);

module.exports = router;