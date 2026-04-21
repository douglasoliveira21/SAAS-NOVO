const express = require('express');
const axios = require('axios');
const pool = require('../db/database');
const { encrypt } = require('../utils/crypto');

const router = express.Router();

// GET /api/auth/microsoft/callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('OAuth error from Microsoft:', error, req.query.error_description);
    return res.redirect(`${process.env.FRONTEND_URL}/tenants?error=${encodeURIComponent(req.query.error_description || error)}`);
  }

  if (!state || !code) {
    return res.redirect(`${process.env.FRONTEND_URL}/tenants?error=missing_params`);
  }

  try {
    const { tenantId } = JSON.parse(Buffer.from(state, 'base64').toString());
    const tenant = await pool.query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    if (!tenant.rows[0]) throw new Error('Tenant não encontrado');

    const msTenantId = tenant.rows[0].tenant_id;

    const params = new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID,
      client_secret: process.env.AZURE_CLIENT_SECRET,
      code,
      redirect_uri: process.env.AZURE_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const tokenRes = await axios.post(
      `https://login.microsoftonline.com/${msTenantId}/oauth2/v2.0/token`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    await pool.query(
      `UPDATE tenants SET access_token_enc = $1, refresh_token_enc = $2, token_expires_at = $3, status = 'connected', updated_at = NOW() WHERE id = $4`,
      [encrypt(access_token), encrypt(refresh_token), expiresAt, tenantId]
    );

    console.log(`Tenant ${tenant.rows[0].name} connected successfully`);
    res.redirect(`${process.env.FRONTEND_URL}/tenants?connected=${tenantId}`);
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err.message);
    const msg = err.response?.data?.error_description || err.message;
    res.redirect(`${process.env.FRONTEND_URL}/tenants?error=${encodeURIComponent(msg)}`);
  }
});

module.exports = router;
