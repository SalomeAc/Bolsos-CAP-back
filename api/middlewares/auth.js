const jwt = require("jsonwebtoken");


function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; 

  console.log("DEBUG auth middleware:", {
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
    jwtSecretExists: !!process.env.JWT_SECRET,
    jwtSecretValue: process.env.JWT_SECRET
  });

  if (!token) return res.status(401).json({ message: "Token missing" });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("JWT Verification Error:", {
        error: err.message,
        name: err.name,
        expiredAt: err.expiredAt
      });
      return res.status(403).json({ message: "Invalid token" });
    }

    console.log("JWT Decoded successfully:", decoded);
    req.user = decoded;
    next(); 
  });
}


module.exports = authenticateToken;
