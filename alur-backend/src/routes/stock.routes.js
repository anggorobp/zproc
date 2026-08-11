const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const { getStock } = require("../services/stock");

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  res.json(await getStock());
}));

module.exports = router;
