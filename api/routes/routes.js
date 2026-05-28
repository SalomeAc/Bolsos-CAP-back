const express = require("express");
const userRoutes = require("./userRoutes");

const router = express.Router();
const productRoutes = require("./productRoutes");
const quotationRoutes = require("./quotationRoutes");


router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/quotations", quotationRoutes);


router.get("/", (req, res) => {
  res.send("API funcionando");
});


module.exports = router;
