const nodemailer = require("nodemailer");

// Email is optional. Without SMTP the app still works — the RFQ link comes back
// in the API response so it can be shared by hand.
function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendRfq({ to, vendorName, request, items, link }) {
  if (!isConfigured()) return { sent: false, reason: "SMTP belum diatur" };

  const rows = items
    .map((i) => `<tr><td>${i.name}</td><td>${i.spec || "-"}</td><td>${i.qty} ${i.unit}</td></tr>`)
    .join("");

  try {
    const port = Number(process.env.SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `Permintaan Penawaran ${request.no} — ${request.project}`,
      html: `
        <p>Yth. ${vendorName},</p>
        <p>Kami mengundang Anda untuk mengajukan penawaran atas kebutuhan berikut:</p>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">
          <tr><th>Material</th><th>Spesifikasi</th><th>Jumlah</th></tr>
          ${rows}
        </table>
        <p>Silakan isi harga melalui tautan berikut:</p>
        <p><a href="${link}">${link}</a></p>
        <p>Terima kasih atas kerja samanya.</p>`,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendRfq, isConfigured };
