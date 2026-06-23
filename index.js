const express = require("express");
require("dotenv").config();

const cors = require("cors");
const routes = require("./api/routes/routes.js");
const { connectDB } = require("./api/config/database");

const app = express();


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());


connectDB();


app.use("/api/", routes);

app.use((err, req, res, next) => {
  if (err instanceof require("multer").MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "La imagen no puede superar 5 MB" });
    }
    return res.status(400).json({ message: err.message });
  }

  if (err) {
    return res.status(400).json({ message: err.message || "Error en la solicitud" });
  }

  next();
});

app.get("/", (req, res) => res.send("Server is running"));


if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}