const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/database');
const { authenticate } = require('../middleware/auth');
const audit = require('../utils/audit');
const { sendTwoFactorCode } = require('../services/emailService');

const router = express.Router();

const TWO_FACTOR_ENABLED = process.env.TWO_FACTOR_ENABLED === 'true';

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/login
// If 2FA enabled: returns { requiresTwoFactor: true, tempToken }
// If 2FA disabled: returns { token, user }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND active = true', [email.toLowerCase()]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (!TWO_FACTOR_ENABLED) {
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
      );
      await audit.log({ userId: user.id, action: 'LOGIN', ipAddress: req.ip });
      return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }

    // 2FA: generate code, save to DB, send email
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await pool.query(
      `INSERT INTO two_factor_codes (user_id, code, expires_at) VALUES ($1, $2, $3)`,
      [user.id, code, expiresAt]
    );

    await sendTwoFactorCode(user.email, code, user.name);

    // Temp token (short-lived, only for 2FA verification)
    const tempToken = jwt.sign(
      { id: user.id, twoFactor: true },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ requiresTwoFactor: true, tempToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/auth/verify-2fa
router.post('/verify-2fa', async (req, res) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) return res.status(400).json({ error: 'Token e código obrigatórios' });

  try {
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (!decoded.twoFactor) return res.status(401).json({ error: 'Token inválido' });

    const result = await pool.query(
      `SELECT * FROM two_factor_codes 
       WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [decoded.id, code]
    );

    if (!result.rows[0]) return res.status(401).json({ error: 'Código inválido ou expirado' });

    // Mark code as used
    await pool.query('UPDATE two_factor_codes SET used = true WHERE id = $1', [result.rows[0].id]);

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1 AND active = true', [decoded.id]);
    const user = userResult.rows[0];
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await audit.log({ userId: user.id, action: 'LOGIN_2FA', ipAddress: req.ip });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
