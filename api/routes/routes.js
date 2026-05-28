const express = require("express");
const userRoutes = require("./userRoutes");

const router = express.Router();
const productRoutes = require("./productRoutes");


router.use("/users", userRoutes);
router.use("/products", productRoutes);


router.get("/", (req, res) => {
  res.send("API funcionando");
});


module.exports = router;
