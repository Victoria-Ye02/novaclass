const jwt = require("jsonwebtoken");

function verify(req, res, next, token) {
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  verify(req, res, next, token);
};

// Same check, but also accepts ?token=... — needed for <iframe>/<img>/<video> src
// requests, which the browser issues without an Authorization header.
module.exports.viaQueryOrHeader = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1] || req.query.token;
  verify(req, res, next, token);
};
