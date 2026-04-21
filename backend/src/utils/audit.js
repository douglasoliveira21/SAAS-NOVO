const pool = require('../db/database');

async function log({ userId, tenantId, action, resource, details, ipAddress, riskLevel = 'low', approvedBy = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, tenant_id, action, resource, details, ip_address, risk_level, approved_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId || null, tenantId || null, action, resource || null, details ? JSON.stringify(details) : null, ipAddress || null, riskLevel, approvedBy || null]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

module.exports = { log };
