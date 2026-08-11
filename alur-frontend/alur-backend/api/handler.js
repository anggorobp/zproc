// Vercel memuat file ini sebagai serverless function. Express app itu sendiri
// sudah punya bentuk (req, res) => {...}, jadi cukup diekspor apa adanya —
// tidak perlu app.listen() di sini, Vercel yang menangani itu.
module.exports = require("../src/app");
