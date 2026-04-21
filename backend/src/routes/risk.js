const express = require('express');
const pool = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const audit = require('../utils/audit');
const { RISK_ACTIONS } = require('../utils/riskControl');

const router = express.Router();

// GET /api/risk/actions — list all defined risk actions (for frontend)
router.get('/actions', authenticate, (req, res) => {
  res.json(RISK_ACTIONS);
});

// GET /api/risk/approvals — list pending approvals (admin sees all, others see own)
router.get('/approvals', authenticate, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'admin') {
      query = `
        SELECT ra.*, u.name as requested_by_name, u.email as requested_by_email,
               t.name as tenant_name, a.name as approved_by_name
        FROM risk_approvals ra
        LEFT JOIN users u ON ra.requested_by = u.id
        LEFT JOIN tenants t ON ra.tenant_id = t.id
        LEFT JOIN users a ON ra.approved_by = a.id
        WHERE ra.status = 'pending' AND ra.expires_at > NOW()
        ORDER BY ra.created_at DESC
      `;
      params = [];
    } else {
      query = `
        SELECT ra.*, u.name as requested_by_name, t.name as tenant_name
        FROM risk_approvals ra
        LEFT JOIN users u ON ra.requested_by = u.id
        LEFT JOIN tenants t ON ra.tenant_id = t.id
        WHERE ra.requested_by = $1 AND ra.expires_at > NOW()
        ORDER BY ra.created_at DESC
      `;
      params = [req.user.id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/risk/approvals/history — resolved approvals
router.get('/approvals/history', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ra.*, u.name as requested_by_name, t.name as tenant_name, a.name as approved_by_name
      FROM risk_approvals ra
      LEFT JOIN users u ON ra.requested_by = u.id
      LEFT JOIN tenants t ON ra.tenant_id = t.id
      LEFT JOIN users a ON ra.approved_by = a.id
      WHERE ra.status != 'pending'
      ORDER BY ra.resolved_at DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/risk/approvals — request approval for a critical action
router.post('/approvals', authenticate, async (req, res) => {
  const { action, tenantId, resource, details, reason } = req.body;
  if (!action) return res.status(400).json({ error: 'action obrigatório' });

  try {
    const result = await pool.query(
      `INSERT INTO risk_approvals (requested_by, tenant_id, action, resource, details, risk_level)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, tenantId || null, action, resource || null,
       details ? JSON.stringify({ ...details, reason }) : JSON.stringify({ reason }),
       RISK_ACTIONS[action]?.level || 'high']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/risk/approvals/:id/approve (admin only)
router.patch('/approvals/:id/approve', authenticate, requireAdmin, async (req, res) => {
  try {
    const approval = await pool.query('SELECT * FROM risk_approvals WHERE id = $1', [req.params.id]);
    if (!approval.rows[0]) return res.status(404).json({ error: 'Aprovação não encontrada' });
    if (approval.rows[0].requested_by === req.user.id) {
      return res.status(403).json({ error: 'Você não pode aprovar sua própria solicitação' });
    }
    if (approval.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Aprovação já resolvida' });
    }

    const result = await pool.query(
      `UPDATE risk_approvals SET status = 'approved', approved_by = $1, resolved_at = NOW() WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );

    await audit.log({
      userId: req.user.id,
      tenantId: approval.rows[0].tenant_id,
      action: 'APPROVE_RISK_ACTION',
      details: { approvalId: req.params.id, originalAction: approval.rows[0].action },
      riskLevel: 'high',
      ipAddress: req.ip,
    });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/risk/approvals/:id/reject (admin only)
router.patch('/approvals/:id/reject', authenticate, requireAdmin, async (req, res) => {
  const { reason } = req.body;
  try {
    const result = await pool.query(
      `UPDATE risk_approvals SET status = 'rejected', approved_by = $1, rejection_reason = $2, resolved_at = NOW() WHERE id = $3 AND status = 'pending' RETURNING *`,
      [req.user.id, reason || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Aprovação não encontrada ou já resolvida' });

    await audit.log({
      userId: req.user.id,
      action: 'REJECT_RISK_ACTION',
      details: { approvalId: req.params.id, reason },
      riskLevel: 'medium',
      ipAddress: req.ip,
    });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/risk/approvals/:id/status — check if approval was granted (polling)
router.get('/approvals/:id/status', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT status, approved_by, rejection_reason, resolved_at FROM risk_approvals WHERE id = $1 AND requested_by = $2`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
