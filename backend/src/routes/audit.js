const express = require('express');
const pool = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, requireAdmin, async (req, res) => {
  const { tenantId, userId, limit = 100, offset = 0 } = req.query;
  let query = `
    SELECT al.*, u.name as user_name, t.name as tenant_name
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    LEFT JOIN tenants t ON al.tenant_id = t.id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (tenantId) { query += ` AND al.tenant_id = $${idx++}`; params.push(tenantId); }
  if (userId) { query += ` AND al.user_id = $${idx++}`; params.push(userId); }

  query += ` ORDER BY al.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(parseInt(limit), parseInt(offset));

  const result = await pool.query(query, params);
  res.json(result.rows);
});

module.exports = router;
