const express = require('express');
const { authenticate, requireTenantAccess } = require('../middleware/auth');
const graph = require('../services/graphService');
const audit = require('../utils/audit');

const router = express.Router({ mergeParams: true });

// All routes require auth + tenant access
router.use(authenticate);
router.use(requireTenantAccess);

// ===== USERS =====
router.get('/users', async (req, res) => {
  try {
    const data = await graph.listUsers(req.params.tenantId);
    res.json(data.value || []);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET single user (full detail)
router.get('/users/:userId', async (req, res) => {
  try {
    const data = await graph.getUser(req.params.tenantId, req.params.userId);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const user = await graph.createUser(req.params.tenantId, req.body);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'CREATE_M365_USER', details: { upn: req.body.userPrincipalName }, ipAddress: req.ip });
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// PATCH update user profile
router.patch('/users/:userId', async (req, res) => {
  try {
    await graph.updateUser(req.params.tenantId, req.params.userId, req.body);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'UPDATE_M365_USER', details: { userId: req.params.userId, fields: Object.keys(req.body) }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

router.patch('/users/:userId/block', async (req, res) => {
  try {
    const { blocked } = req.body;
    await graph.blockUser(req.params.tenantId, req.params.userId, blocked);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: blocked ? 'BLOCK_USER' : 'UNBLOCK_USER', details: { userId: req.params.userId }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

router.patch('/users/:userId/reset-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Senha obrigatória' });
    await graph.resetPassword(req.params.tenantId, req.params.userId, password);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'RESET_PASSWORD', details: { userId: req.params.userId }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// POST revoke all sign-in sessions
router.post('/users/:userId/revoke-sessions', async (req, res) => {
  try {
    await graph.revokeSignInSessions(req.params.tenantId, req.params.userId);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'REVOKE_SESSIONS', details: { userId: req.params.userId }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// GET manager
router.get('/users/:userId/manager', async (req, res) => {
  try {
    const data = await graph.getManager(req.params.tenantId, req.params.userId);
    res.json(data || null);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT set/remove manager
router.put('/users/:userId/manager', async (req, res) => {
  try {
    const { managerId } = req.body;
    await graph.setManager(req.params.tenantId, req.params.userId, managerId || null);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'SET_MANAGER', details: { userId: req.params.userId, managerId }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});
router.get('/users/:userId/auth-methods', async (req, res) => {
  try {
    const data = await graph.listAuthMethods(req.params.tenantId, req.params.userId);
    res.json(data.value || []);
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// DELETE specific MFA method
router.delete('/users/:userId/auth-methods/:methodType/:methodId', async (req, res) => {
  try {
    await graph.deleteAuthMethod(req.params.tenantId, req.params.userId, req.params.methodType, req.params.methodId);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'DELETE_MFA_METHOD', details: { userId: req.params.userId, methodType: req.params.methodType }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// ===== MAILBOXES =====
const pool = require('../db/database');
const exo = require('../services/exchangeService');

// Helper: get EXO context (clientId, clientSecret, tenantGuid) for PowerShell
async function getTenantExoContext(tenantId) {
  const result = await pool.query('SELECT tenant_id FROM tenants WHERE id = $1', [tenantId]);
  if (!result.rows[0]) throw new Error('Tenant não encontrado');
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('AZURE_CLIENT_ID e AZURE_CLIENT_SECRET não configurados no .env');
  return { clientId, clientSecret, tenantGuid: result.rows[0].tenant_id };
}

router.get('/mailboxes', async (req, res) => {
  try {
    const data = await graph.listMailboxes(req.params.tenantId);
    res.json(data.value || []);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/mailboxes/shared', async (req, res) => {
  try {
    const result = await graph.createSharedMailbox(req.params.tenantId, req.body);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'CREATE_SHARED_MAILBOX', details: { email: req.body.emailAddress }, ipAddress: req.ip });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// GET permissions — uses PowerShell (Exchange Online)
router.get('/mailboxes/:mailboxId/permissions', async (req, res) => {
  try {
    // Get the mailbox UPN from Graph first
    const mbUser = await graph.getUser(req.params.tenantId, req.params.mailboxId);
    const mailboxUpn = mbUser.userPrincipalName;

    const { clientId, clientSecret, tenantGuid } = await getTenantExoContext(req.params.tenantId);
    const perms = await exo.listMailboxPermissions(clientId, clientSecret, tenantGuid, mailboxUpn);

    // Normalize to array
    const list = Array.isArray(perms) ? perms : (perms ? [perms] : []);
    res.json(list);
  } catch (err) {
    console.error('Mailbox permissions error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Debug route
router.get('/mailboxes/:mailboxId/permissions/debug', async (req, res) => {
  const { tenantId, mailboxId } = req.params;
  const results = {};

  try {
    const d = await graph.graphRequestPublic(tenantId, 'GET',
      `/users/${mailboxId}?$select=id,displayName,userPrincipalName,grantSendOnBehalfTo`);
    results.sendOnBehalf_v1 = d;
  } catch (e) { results.sendOnBehalf_v1_error = e.response?.data || e.message; }

  try {
    const d = await graph.graphBetaRequestPublic(tenantId, 'GET', `/users/${mailboxId}/mailboxPermissions`);
    results.mailboxPermissions_beta = d;
  } catch (e) { results.mailboxPermissions_beta_error = e.response?.data || e.message; }

  res.json(results);
});

// POST add permission — PowerShell
router.post('/mailboxes/:mailboxId/permissions', async (req, res) => {
  try {
    const { delegateUpn, permissionType } = req.body;
    if (!delegateUpn || !permissionType) return res.status(400).json({ error: 'delegateUpn e permissionType obrigatórios' });

    const mbUser = await graph.getUser(req.params.tenantId, req.params.mailboxId);
    const mailboxUpn = mbUser.userPrincipalName;

    const { clientId, clientSecret, tenantGuid } = await getTenantExoContext(req.params.tenantId);
    await exo.addMailboxPermission(clientId, clientSecret, tenantGuid, mailboxUpn, delegateUpn, permissionType);

    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'ADD_MAILBOX_PERMISSION', details: { mailboxUpn, delegateUpn, permissionType }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    console.error('Add mailbox permission error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// DELETE remove permission — PowerShell
router.delete('/mailboxes/:mailboxId/permissions/:permissionId', async (req, res) => {
  try {
    const { permissionType, delegateId } = req.query;
    if (!permissionType || !delegateId) return res.status(400).json({ error: 'permissionType e delegateId obrigatórios' });

    const mbUser = await graph.getUser(req.params.tenantId, req.params.mailboxId);
    const mailboxUpn = mbUser.userPrincipalName;

    const { clientId, clientSecret, tenantGuid } = await getTenantExoContext(req.params.tenantId);
    await exo.removeMailboxPermission(clientId, clientSecret, tenantGuid, mailboxUpn, delegateId, permissionType);

    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'REMOVE_MAILBOX_PERMISSION', details: { mailboxUpn, delegateId, permissionType }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    console.error('Remove mailbox permission error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ===== BATCH OPERATIONS =====
router.post('/batch', async (req, res) => {
  const { tenantId } = req.params;
  const { userIds, operations } = req.body;
  // operations: [{ type, params }]
  // types: reset-password | block | unblock | assign-license | remove-license
  //        add-to-group | remove-from-group | revoke-sessions

  if (!userIds?.length) return res.status(400).json({ error: 'userIds obrigatório' });
  if (!operations?.length) return res.status(400).json({ error: 'operations obrigatório' });

  const results = []; // { userId, displayName, operation, status, error }

  // Process each user sequentially per operation to avoid Graph throttling
  for (const userId of userIds) {
    for (const op of operations) {
      const entry = { userId, operation: op.type, status: 'pending', error: null };
      try {
        switch (op.type) {
          case 'reset-password':
            if (!op.params?.password) throw new Error('Senha obrigatória');
            await graph.resetPassword(tenantId, userId, op.params.password);
            break;
          case 'block':
            await graph.blockUser(tenantId, userId, true);
            break;
          case 'unblock':
            await graph.blockUser(tenantId, userId, false);
            break;
          case 'assign-license':
            if (!op.params?.skuId) throw new Error('skuId obrigatório');
            await graph.assignLicense(tenantId, userId, op.params.skuId);
            break;
          case 'remove-license':
            if (!op.params?.skuId) throw new Error('skuId obrigatório');
            await graph.removeLicense(tenantId, userId, op.params.skuId);
            break;
          case 'add-to-group':
            if (!op.params?.groupId) throw new Error('groupId obrigatório');
            await graph.addGroupMember(tenantId, op.params.groupId, userId);
            break;
          case 'remove-from-group':
            if (!op.params?.groupId) throw new Error('groupId obrigatório');
            await graph.removeGroupMember(tenantId, op.params.groupId, userId);
            break;
          case 'revoke-sessions':
            await graph.revokeSignInSessions(tenantId, userId);
            break;
          case 'update-department':
            if (!op.params?.department) throw new Error('department obrigatório');
            await graph.updateUser(tenantId, userId, { department: op.params.department });
            break;
          case 'update-job-title':
            if (!op.params?.jobTitle) throw new Error('jobTitle obrigatório');
            await graph.updateUser(tenantId, userId, { jobTitle: op.params.jobTitle });
            break;
          default:
            throw new Error(`Operação desconhecida: ${op.type}`);
        }
        entry.status = 'success';
        await audit.log({
          userId: req.user.id, tenantId,
          action: `BATCH_${op.type.toUpperCase().replace(/-/g, '_')}`,
          details: { userId, ...op.params },
          riskLevel: ['reset-password', 'block', 'revoke-sessions'].includes(op.type) ? 'high' : 'medium',
          ipAddress: req.ip,
        });
      } catch (err) {
        entry.status = 'error';
        entry.error = err.response?.data?.error?.message || err.message;
      }
      results.push(entry);
    }
  }

  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;

  res.json({ results, summary: { total: results.length, succeeded, failed } });
});
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ users: [], groups: [], licenses: [] });

  const term = q.trim().toLowerCase();
  const { tenantId } = req.params;

  try {
    const [usersRes, groupsRes, licensesRes] = await Promise.allSettled([
      graph.listUsers(tenantId),
      graph.listGroups(tenantId),
      graph.listLicenses(tenantId),
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

    res.json({
      users: users.filter(matchUser).slice(0, 20).map(u => ({
        id: u.id,
        displayName: u.displayName,
        userPrincipalName: u.userPrincipalName,
        jobTitle: u.jobTitle,
        department: u.department,
        accountEnabled: u.accountEnabled,
        assignedLicenses: u.assignedLicenses?.length || 0,
      })),
      groups: groups.filter(matchGroup).slice(0, 10).map(g => ({
        id: g.id,
        displayName: g.displayName,
        description: g.description,
        isM365: g.groupTypes?.includes('Unified'),
      })),
      licenses: licenses.filter(matchLicense).slice(0, 5).map(l => ({
        skuId: l.skuId,
        skuPartNumber: l.skuPartNumber,
        total: l.prepaidUnits?.enabled || 0,
        used: l.consumedUnits || 0,
        available: (l.prepaidUnits?.enabled || 0) - (l.consumedUnits || 0),
      })),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.get('/health', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const [usersRes, licensesRes, authMethodsRes] = await Promise.allSettled([
      graph.listUsers(tenantId),
      graph.listLicenses(tenantId),
      // sign-in activity requires AuditLog.Read.All — try gracefully
      graph.graphRequestPublic(tenantId, 'GET',
        '/users?$select=id,displayName,userPrincipalName,accountEnabled,assignedLicenses,signInActivity&$top=999'
      ).catch(() => null),
    ]);

    const users = usersRes.status === 'fulfilled' ? (usersRes.value.value || []) : [];
    const licenses = licensesRes.status === 'fulfilled' ? (licensesRes.value.value || []) : [];
    // signInActivity users (may be null if no permission)
    const usersWithSignIn = authMethodsRes.status === 'fulfilled' && authMethodsRes.value
      ? (authMethodsRes.value.value || users)
      : users;

    // ── Compute health alerts ──────────────────────────────────────────────

    // 1. Users without license (enabled accounts only)
    const noLicense = users.filter(u =>
      u.accountEnabled && (!u.assignedLicenses || u.assignedLicenses.length === 0)
    );

    // 2. Blocked accounts
    const blocked = users.filter(u => !u.accountEnabled);

    // 3. Licenses running low (< 10% available or < 5 seats)
    const licensesLow = licenses.filter(l => {
      const total = l.prepaidUnits?.enabled || 0;
      const used = l.consumedUnits || 0;
      const available = total - used;
      return total > 0 && (available <= 5 || available / total <= 0.1);
    });

    // 4. Licenses exhausted
    const licensesExhausted = licenses.filter(l => {
      const total = l.prepaidUnits?.enabled || 0;
      return total > 0 && l.consumedUnits >= total;
    });

    // 5. Recent sign-in errors (users with signInActivity errorCode != 0 in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const signInErrors = usersWithSignIn.filter(u => {
      const activity = u.signInActivity;
      if (!activity) return false;
      const lastError = activity.lastNonInteractiveSignInDateTime || activity.lastSignInDateTime;
      if (!lastError) return false;
      return new Date(lastError) > sevenDaysAgo && activity.lastSignInRequestId;
    });

    // 6. MFA status — check via auth methods (batch for first 20 users to avoid timeout)
    // We do a lightweight check: users with no MFA registered
    let mfaDisabled = [];
    try {
      const mfaChecks = await Promise.allSettled(
        users.filter(u => u.accountEnabled).slice(0, 30).map(async u => {
          const methods = await graph.listAuthMethods(tenantId, u.id);
          const hasMfa = (methods.value || []).some(m =>
            m['@odata.type'] !== '#microsoft.graph.passwordAuthenticationMethod'
          );
          return hasMfa ? null : u;
        })
      );
      mfaDisabled = mfaChecks
        .filter(r => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);
    } catch { mfaDisabled = []; }

    res.json({
      summary: {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.accountEnabled).length,
        blockedUsers: blocked.length,
        noLicenseUsers: noLicense.length,
        mfaDisabledUsers: mfaDisabled.length,
        licensesLow: licensesLow.length,
        licensesExhausted: licensesExhausted.length,
        signInErrors: signInErrors.length,
        healthScore: computeHealthScore({ blocked, noLicense, mfaDisabled, licensesLow, licensesExhausted, total: users.length }),
      },
      details: {
        noLicense: noLicense.map(u => ({ id: u.id, displayName: u.displayName, userPrincipalName: u.userPrincipalName })),
        blocked: blocked.map(u => ({ id: u.id, displayName: u.displayName, userPrincipalName: u.userPrincipalName })),
        mfaDisabled: mfaDisabled.map(u => ({ id: u.id, displayName: u.displayName, userPrincipalName: u.userPrincipalName })),
        licensesLow: licensesLow.map(l => ({
          skuId: l.skuId, skuPartNumber: l.skuPartNumber,
          total: l.prepaidUnits?.enabled, used: l.consumedUnits,
          available: (l.prepaidUnits?.enabled || 0) - l.consumedUnits,
        })),
        licensesExhausted: licensesExhausted.map(l => ({
          skuId: l.skuId, skuPartNumber: l.skuPartNumber,
          total: l.prepaidUnits?.enabled, used: l.consumedUnits,
        })),
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function computeHealthScore({ blocked, noLicense, mfaDisabled, licensesLow, licensesExhausted, total }) {
  if (total === 0) return 100;
  let score = 100;
  score -= Math.min(30, (mfaDisabled.length / total) * 40);
  score -= Math.min(20, (noLicense.length / total) * 25);
  score -= Math.min(15, (blocked.length / total) * 20);
  score -= licensesLow.length * 5;
  score -= licensesExhausted.length * 10;
  return Math.max(0, Math.round(score));
}
router.get('/licenses', async (req, res) => {
  try {
    const data = await graph.listLicenses(req.params.tenantId);
    res.json(data.value || []);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/users/:userId/licenses', async (req, res) => {
  try {
    const { skuId } = req.body;
    await graph.assignLicense(req.params.tenantId, req.params.userId, skuId);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'ASSIGN_LICENSE', details: { userId: req.params.userId, skuId }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

router.delete('/users/:userId/licenses/:skuId', async (req, res) => {
  try {
    await graph.removeLicense(req.params.tenantId, req.params.userId, req.params.skuId);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'REMOVE_LICENSE', details: { userId: req.params.userId, skuId: req.params.skuId }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// ===== GROUPS =====
router.get('/groups', async (req, res) => {
  try {
    const data = await graph.listGroups(req.params.tenantId);
    res.json(data.value || []);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/groups', async (req, res) => {
  try {
    const group = await graph.createGroup(req.params.tenantId, req.body);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'CREATE_GROUP', details: { name: req.body.displayName }, ipAddress: req.ip });
    res.status(201).json(group);
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

router.get('/groups/:groupId/members', async (req, res) => {
  try {
    const data = await graph.listGroupMembers(req.params.tenantId, req.params.groupId);
    res.json(data.value || []);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/groups/:groupId/members', async (req, res) => {
  try {
    const { userId, role } = req.body;
    // role 'owner' = write/admin; default = member (read)
    if (role === 'owner') {
      await graph.addGroupOwner(req.params.tenantId, req.params.groupId, userId);
    } else {
      await graph.addGroupMember(req.params.tenantId, req.params.groupId, userId);
    }
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'ADD_GROUP_MEMBER', details: { groupId: req.params.groupId, userId, role: role || 'member' }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

router.delete('/groups/:groupId/members/:userId', async (req, res) => {
  try {
    await graph.removeGroupMember(req.params.tenantId, req.params.groupId, req.params.userId);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'REMOVE_GROUP_MEMBER', details: { groupId: req.params.groupId, userId: req.params.userId }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// GET group owners
router.get('/groups/:groupId/owners', async (req, res) => {
  try {
    const data = await graph.listGroupOwners(req.params.tenantId, req.params.groupId);
    res.json(data.value || []);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH member role in group (promote to owner / demote to member)
router.patch('/groups/:groupId/members/:userId/role', async (req, res) => {
  try {
    const { role } = req.body; // 'owner' | 'member'
    const { tenantId, groupId, userId } = req.params;
    if (role === 'owner') {
      // Add as owner (keep as member too)
      await graph.addGroupOwner(tenantId, groupId, userId);
    } else {
      // Remove from owners (keep as member)
      await graph.removeGroupOwner(tenantId, groupId, userId);
    }
    await audit.log({ userId: req.user.id, tenantId, action: 'UPDATE_GROUP_MEMBER_ROLE', details: { groupId, userId, role }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// ===== SHAREPOINT =====
router.get('/sharepoint/sites', async (req, res) => {
  try {
    const data = await graph.listSites(req.params.tenantId);
    res.json(data.value || []);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET site details (lists, subsites)
router.get('/sharepoint/sites/:siteId', async (req, res) => {
  try {
    const data = await graph.getSiteDetails(req.params.tenantId, req.params.siteId);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/sharepoint/sites/:siteId/drives', async (req, res) => {
  try {
    const data = await graph.listSiteDrives(req.params.tenantId, req.params.siteId);
    res.json(data.value || []);
  } catch (err) {
    const status = err.response?.status;
    if (status === 403 || status === 404) return res.json([]);
    res.status(400).json({ error: err.message });
  }
});

router.get('/sharepoint/sites/:siteId/drives/:driveId/items', async (req, res) => {
  try {
    const itemId = req.query.itemId || 'root';
    const data = await graph.listDriveItems(req.params.tenantId, req.params.siteId, req.params.driveId, itemId);
    res.json(data.value || []);
  } catch (err) {
    const status = err.response?.status;
    if (status === 403 || status === 404) return res.json([]);
    res.status(400).json({ error: err.message });
  }
});

// List ALL items (files + folders) inside a drive item
router.get('/sharepoint/drives/:driveId/items/:itemId/children', async (req, res) => {
  try {
    const data = await graph.listFolderItems(req.params.tenantId, req.params.driveId, req.params.itemId);
    res.json(data.value || []);
  } catch (err) {
    const status = err.response?.status;
    if (status === 403 || status === 404) return res.json([]);
    res.status(400).json({ error: err.message });
  }
});

// Keep old route for backward compat
router.get('/sharepoint/drives/:driveId/items/:itemId/folders', async (req, res) => {
  try {
    const data = await graph.listFolderItems(req.params.tenantId, req.params.driveId, req.params.itemId);
    res.json(data.value || []);
  } catch (err) {
    const status = err.response?.status;
    if (status === 403 || status === 404) return res.json([]);
    res.status(400).json({ error: err.message });
  }
});

// Drive activity log
router.get('/sharepoint/drives/:driveId/activities', async (req, res) => {
  try {
    const data = await graph.getDriveActivities(req.params.tenantId, req.params.driveId, req.query.top || 50);
    res.json(data.value || []);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Item activity log
router.get('/sharepoint/drives/:driveId/items/:itemId/activities', async (req, res) => {
  try {
    const data = await graph.getItemActivities(req.params.tenantId, req.params.driveId, req.params.itemId, req.query.top || 30);
    res.json(data.value || []);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Site audit logs
router.get('/sharepoint/sites/:siteId/audit', async (req, res) => {
  try {
    const siteData = await graph.graphRequestPublic(req.params.tenantId, 'GET', `/sites/${req.params.siteId}?$select=webUrl`);
    const data = await graph.getSiteAuditLogs(req.params.tenantId, siteData.webUrl, req.query.top || 50);
    res.json(data.value || []);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---- Site permissions ----
router.get('/sharepoint/sites/:siteId/permissions', async (req, res) => {
  try {
    const data = await graph.listSitePermissions(req.params.tenantId, req.params.siteId);
    res.json(data.value || []);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/sharepoint/sites/:siteId/members', async (req, res) => {
  try {
    const { userId, role } = req.body;
    const result = await graph.addSiteMember(req.params.tenantId, req.params.siteId, userId, role);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'ADD_SITE_MEMBER', details: { siteId: req.params.siteId, userId, role }, ipAddress: req.ip });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

router.patch('/sharepoint/sites/:siteId/permissions/:permissionId', async (req, res) => {
  try {
    const { role } = req.body;
    const result = await graph.updateSitePermission(req.params.tenantId, req.params.siteId, req.params.permissionId, role);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'UPDATE_SITE_PERMISSION', details: { siteId: req.params.siteId, permissionId: req.params.permissionId, role }, ipAddress: req.ip });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

router.delete('/sharepoint/sites/:siteId/permissions/:permissionId', async (req, res) => {
  try {
    await graph.deleteSitePermission(req.params.tenantId, req.params.siteId, req.params.permissionId);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'REMOVE_SITE_PERMISSION', details: { siteId: req.params.siteId, permissionId: req.params.permissionId }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// ---- Drive item (folder) permissions ----
router.get('/sharepoint/drives/:driveId/items/:itemId/permissions', async (req, res) => {
  try {
    const data = await graph.listItemPermissions(req.params.tenantId, req.params.driveId, req.params.itemId);
    res.json(data.value || []);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/sharepoint/drives/:driveId/items/:itemId/permissions', async (req, res) => {
  try {
    const { userId, role } = req.body;
    const result = await graph.addItemPermission(req.params.tenantId, req.params.driveId, req.params.itemId, userId, role);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'ADD_FOLDER_PERMISSION', details: { driveId: req.params.driveId, itemId: req.params.itemId, userId, role }, ipAddress: req.ip });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

router.patch('/sharepoint/drives/:driveId/items/:itemId/permissions/:permissionId', async (req, res) => {
  try {
    const { role } = req.body;
    const result = await graph.updateItemPermission(req.params.tenantId, req.params.driveId, req.params.itemId, req.params.permissionId, role);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'UPDATE_FOLDER_PERMISSION', details: { driveId: req.params.driveId, itemId: req.params.itemId, permissionId: req.params.permissionId, role }, ipAddress: req.ip });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

router.delete('/sharepoint/drives/:driveId/items/:itemId/permissions/:permissionId', async (req, res) => {
  try {
    await graph.deleteItemPermission(req.params.tenantId, req.params.driveId, req.params.itemId, req.params.permissionId);
    await audit.log({ userId: req.user.id, tenantId: req.params.tenantId, action: 'REMOVE_FOLDER_PERMISSION', details: { driveId: req.params.driveId, itemId: req.params.itemId, permissionId: req.params.permissionId }, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error?.message || err.message });
  }
});

module.exports = router;
