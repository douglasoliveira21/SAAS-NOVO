const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const audit = require('../utils/audit');

const router = express.Router();

// GET /api/users - list system users (admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email, role, active, created_at FROM users ORDER BY name'
  );
  res.json(result.rows);
});

// POST /api/users - create system user (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, email, password, role' });
  }
  if (!['admin', 'tecnico'].includes(role)) {
    return res.status(400).json({ error: 'Role inválido' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, active`,
      [name, email.toLowerCase(), hash, role]
    );
    await audit.log({ userId: req.user.id, action: 'CREATE_USER', details: { email }, ipAddress: req.ip });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email já cadastrado' });
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PATCH /api/users/:id - update user (admin only)
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  const { name, role, active, password } = req.body;
  const updates = [];
  const values = [];
  let idx = 1;

  if (name) { updates.push(`name = $${idx++}`); values.push(name); }
  if (role) { updates.push(`role = $${idx++}`); values.push(role); }
  if (active !== undefined) { updates.push(`active = $${idx++}`); values.push(active); }
  if (password) {
    const hash = await bcrypt.hash(password, 12);
    updates.push(`password_hash = $${idx++}`);
    values.push(hash);
  }

  if (!updates.length) return res.status(400).json({ error: 'Nada para atualizar' });

  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);

  const result = await pool.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role, active`,
    values
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });

  await audit.log({ userId: req.user.id, action: 'UPDATE_USER', details: { targetId: req.params.id }, ipAddress: req.ip });
  res.json(result.rows[0]);
});

// DELETE /api/users/:id (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Não pode excluir a si mesmo' });
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  await audit.log({ userId: req.user.id, action: 'DELETE_USER', details: { targetId: req.params.id }, ipAddress: req.ip });
  res.json({ success: true });
});

module.exports = router;
