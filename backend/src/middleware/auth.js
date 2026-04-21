const jwt = require('jsonwebtoken');
const pool = require('../db/database');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('SELECT id, name, email, role, active FROM users WHERE id = $1', [decoded.id]);
    
    if (!result.rows[0] || !result.rows[0].active) {
      return res.status(401).json({ error: 'Usuário inativo ou não encontrado' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
}

async function requireTenantAccess(req, res, next) {
  const tenantId = req.params.tenantId || req.body.tenantId;
  if (!tenantId) return res.status(400).json({ error: 'Tenant ID obrigatório' });

  if (req.user.role === 'admin') return next();

  const result = await pool.query(
    'SELECT 1 FROM tenant_technicians WHERE tenant_id = $1 AND user_id = $2',
    [tenantId, req.user.id]
  );

  if (!result.rows.length) {
    return res.status(403).json({ error: 'Sem acesso a este tenant' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, requireTenantAccess };
