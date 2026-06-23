const express = require("express");

const { textToSpeech } = require("../controllers/speechController");

const router = express.Router();

router.post("/", textToSpeech);

module.exports = router;