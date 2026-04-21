const express = require('express');
const axios = require('axios');
const pool = require('../db/database');
const { authenticate, requireAdmin, requireTenantAccess } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');
const audit = require('../utils/audit');

const router = express.Router();

// GET /api/tenants
router.get('/', authenticate, async (req, res) => {
  let query, params;
  if (req.user.role === 'admin') {
    query = `SELECT t.*, u.name as created_by_name FROM tenants t LEFT JOIN users u ON t.created_by = u.id ORDER BY t.name`;
    params = [];
  } else {
    query = `SELECT t.*, u.name as created_by_name FROM tenants t 
             LEFT JOIN users u ON t.created_by = u.id
             INNER JOIN tenant_technicians tt ON tt.tenant_id = t.id AND tt.user_id = $1
             ORDER BY t.name`;
    params = [req.user.id];
  }
  const result = await pool.query(query, params);
  // Remove sensitive token data
  const tenants = result.rows.map(({ access_token_enc, refresh_token_enc, ...t }) => t);
  res.json(tenants);
});

// POST /api/tenants (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, tenant_id } = req.body;
  if (!name || !tenant_id) return res.status(400).json({ error: 'name e tenant_id obrigatórios' });

  try {
    const result = await pool.query(
      `INSERT INTO tenants (name, tenant_id, created_by) VALUES ($1, $2, $3) RETURNING id, name, tenant_id, status, created_at`,
      [name, tenant_id, req.user.id]
    );
    await audit.log({ userId: req.user.id, tenantId: result.rows[0].id, action: 'CREATE_TENANT', ipAddress: req.ip });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Tenant ID já cadastrado' });
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PATCH /api/tenants/:id (admin only)
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nada para atualizar' });
  const result = await pool.query(
    'UPDATE tenants SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, tenant_id, status',
    [name, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Tenant não encontrado' });
  res.json(result.rows[0]);
});

// DELETE /api/tenants/:id (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM tenants WHERE id = $1', [req.params.id]);
  await audit.log({ userId: req.user.id, tenantId: req.params.id, action: 'DELETE_TENANT', ipAddress: req.ip });
  res.json({ success: true });
});

// GET /api/tenants/:id/technicians (admin only)
router.get('/:id/technicians', authenticate, requireAdmin, async (req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, tt.assigned_at FROM users u
     INNER JOIN tenant_technicians tt ON tt.user_id = u.id
     WHERE tt.tenant_id = $1`,
    [req.params.id]
  );
  res.json(result.rows);
});

// POST /api/tenants/:id/technicians (admin only)
router.post('/:id/technicians', authenticate, requireAdmin, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  try {
    await pool.query(
      'INSERT INTO tenant_technicians (tenant_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/tenants/:id/technicians/:userId (admin only)
router.delete('/:id/technicians/:userId', authenticate, requireAdmin, async (req, res) => {
  await pool.query(
    'DELETE FROM tenant_technicians WHERE tenant_id = $1 AND user_id = $2',
    [req.params.id, req.params.userId]
  );
  res.json({ success: true });
});

// GET /api/tenants/:tenantId/connect - initiate OAuth flow
router.get('/:tenantId/connect', authenticate, requireAdmin, async (req, res) => {
  const tenant = await pool.query('SELECT * FROM tenants WHERE id = $1', [req.params.tenantId]);
  if (!tenant.rows[0]) return res.status(404).json({ error: 'Tenant não encontrado' });

  const msTenantId = tenant.rows[0].tenant_id;
  const state = Buffer.from(JSON.stringify({ tenantId: req.params.tenantId, userId: req.user.id })).toString('base64');

  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.AZURE_REDIRECT_URI,
    scope: 'https://graph.microsoft.com/.default offline_access',
    state,
    prompt: 'consent',
  });

  const authUrl = `https://login.microsoftonline.com/${msTenantId}/oauth2/v2.0/authorize?${params}`;
  res.json({ authUrl });
});

// POST /api/tenants/:tenantId/validate
router.post('/:tenantId/validate', authenticate, requireTenantAccess, async (req, res) => {
  const graph = require('../services/graphService');
  try {
    const [users, licenses] = await Promise.all([
      graph.listUsers(req.params.tenantId),
      graph.listLicenses(req.params.tenantId),
    ]);
    await pool.query(`UPDATE tenants SET status = 'connected', updated_at = NOW() WHERE id = $1`, [req.params.tenantId]);
    res.json({ valid: true, userCount: users.value?.length, licenseCount: licenses.value?.length });
  } catch (err) {
    await pool.query(`UPDATE tenants SET status = 'error', updated_at = NOW() WHERE id = $1`, [req.params.tenantId]);
    res.status(400).json({ valid: false, error: err.message });
  }
});

// GET /api/search?q=term — search across ALL accessible tenants
router.get('/search/global', authenticate, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json([]);

  const term = q.trim().toLowerCase();
  const graph = require('../services/graphService');

  // Get accessible tenants
  let tenantsQuery, params;
  if (req.user.role === 'admin') {
    tenantsQuery = `SELECT id, name, tenant_id FROM tenants WHERE status = 'connected' ORDER BY name`;
    params = [];
  } else {
    tenantsQuery = `SELECT t.id, t.name, t.tenant_id FROM tenants t
      INNER JOIN tenant_technicians tt ON tt.tenant_id = t.id AND tt.user_id = $1
      WHERE t.status = 'connected' ORDER BY t.name`;
    params = [req.user.id];
  }
  const tenantsResult = await pool.query(tenantsQuery, params);
  const tenants = tenantsResult.rows;

  // Search each tenant in parallel
  const results = await Promise.allSettled(
    tenants.map(async (tenant) => {
      const [usersRes, groupsRes, licensesRes] = await Promise.allSettled([
        graph.listUsers(tenant.id),
        graph.listGroups(tenant.id),
        graph.listLicenses(tenant.id),
      ]);

      const users = usersRes.status === 'fulfilled' ? (usersRes.value.value || []) : [];
      const groups = groupsRes.status === 'fulfilled' ? (groupsRes.value.value || []) : [];
      const licenses = licensesRes.status === 'fulfilled' ? (licensesRes.value.value || []) : [];

      const matchUser = u =>
        u.displayName?.toLowerCase().includes(term) ||
        u.userPrincipalName?.toLowerCase().includes(term) ||
        u.mail?.toLowerCase().includes(term) ||
        u.jobTitle?.toLowerCase().includes(term) ||
        u.department?.toLowerCase().includes(term);

      const matchGroup = g =>
        g.displayName?.toLowerCase().includes(term) ||
        g.description?.toLowerCase().includes(term);

      const matchLicense = l =>
        l.skuPartNumber?.toLowerCase().includes(term);

      const matchedUsers = users.filter(matchUser).slice(0, 10);
      const matchedGroups = groups.filter(matchGroup).slice(0, 5);
      const matchedLicenses = licenses.filter(matchLicense).slice(0, 3);

      if (!matchedUsers.length && !matchedGroups.length && !matchedLicenses.length) return null;

      return {
        tenant: { id: tenant.id, name: tenant.name },
        users: matchedUsers.map(u => ({
          id: u.id,
          displayName: u.displayName,
          userPrincipalName: u.userPrincipalName,
          jobTitle: u.jobTitle,
          department: u.department,
          accountEnabled: u.accountEnabled,
          assignedLicenses: u.assignedLicenses?.length || 0,
        })),
        groups: matchedGroups.map(g => ({
          id: g.id,
          displayName: g.displayName,
          description: g.description,
          isM365: g.groupTypes?.includes('Unified'),
        })),
        licenses: matchedLicenses.map(l => ({
          skuId: l.skuId,
          skuPartNumber: l.skuPartNumber,
          total: l.prepaidUnits?.enabled || 0,
          used: l.consumedUnits || 0,
          available: (l.prepaidUnits?.enabled || 0) - (l.consumedUnits || 0),
        })),
      };
    })
  );

  const filtered = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);

  res.json(filtered);
});

module.exports = router;
