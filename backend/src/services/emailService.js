const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendTwoFactorCode(toEmail, code, userName) {
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"M365 Manager" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Código de verificação — M365 Manager',
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0f1117; color: #e2e8f0; border-radius: 12px; padding: 32px;">
        <h2 style="margin: 0 0 8px; font-size: 20px;">Verificação de acesso</h2>
        <p style="color: #94a3b8; margin: 0 0 24px; font-size: 14px;">Olá, ${userName}. Use o código abaixo para concluir o login.</p>
        <div style="background: #1a1d27; border: 1px solid #2d3748; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 10px; color: #3b82f6;">${code}</span>
        </div>
        <p style="color: #64748b; font-size: 12px; margin: 0;">Este código expira em <strong>10 minutos</strong>. Se não foi você, ignore este email.</p>
      </div>
    `,
  });
}

module.exports = { sendTwoFactorCode };
