const express = require("express");
const userRoutes = require("./userRoutes");

const router = express.Router();


router.use("/users", userRoutes);



router.get("/", (req, res) => {
  res.send("API funcionando");
});


module.exports = router;
