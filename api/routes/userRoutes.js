const express = require("express");
const router = express.Router();
const authenticateToken = require("../middlewares/auth");

const UserController = require("../controllers/userController");


router.get("/user-profile", authenticateToken, (req, res) =>
  UserController.getUserProfile(req, res),
);


router.post("/login", (req, res) => UserController.loginUser(req, res));


router.put("/update-profile", authenticateToken, (req, res) =>
  UserController.updateUserProfile(req, res),
);


router.delete("/delete-user", authenticateToken, (req, res) =>
  UserController.deleteUser(req, res),
);


router.put("/deactivate", authenticateToken, (req, res) =>
  UserController.deactivateUser(req, res)
);


module.exports = router;
