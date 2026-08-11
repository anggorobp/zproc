const jwt = require("jsonwebtoken");
const { ApiError } = require("./errorHandler");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, "Belum login. Silakan login dulu."));

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new ApiError(401, "Sesi berakhir. Silakan login ulang."));
  }
}

// ADMIN passes every role check, so one account can walk the whole flow when testing.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, "Belum login."));
    if (req.user.role === "ADMIN" || roles.includes(req.user.role)) return next();
    next(new ApiError(403, `Akses ditolak. Fitur ini untuk role: ${roles.join(" / ")}.`));
  };
}

module.exports = { requireAuth, requireRole };
