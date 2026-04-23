const axios = require('axios');
const pool = require('../db/database');
const { decrypt, encrypt } = require('../utils/crypto');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function getValidToken(tenantId) {
  const result = await pool.query(
    'SELECT access_token_enc, refresh_token_enc, token_expires_at FROM tenants WHERE id = $1',
    [tenantId]
  );

  if (!result.rows[0]) throw new Error('Tenant não encontrado');

  const { access_token_enc, refresh_token_enc, token_expires_at } = result.rows[0];
  const now = new Date();
  const expiresAt = new Date(token_expires_at);

  // If token still valid (with 5 min buffer)
  if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
    return decrypt(access_token_enc);
  }

  // Refresh token
  const refreshToken = decrypt(refresh_token_enc);
  if (!refreshToken) throw new Error('Refresh token não disponível');

  const tenantResult = await pool.query('SELECT tenant_id FROM tenants WHERE id = $1', [tenantId]);
  const msTenantId = tenantResult.rows[0].tenant_id;

  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'https://graph.microsoft.com/.default offline_access',
  });

  const response = await axios.post(
    `https://login.microsoftonline.com/${msTenantId}/oauth2/v2.0/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const { access_token, refresh_token: new_refresh, expires_in } = response.data;
  const newExpiry = new Date(Date.now() + expires_in * 1000);

  await pool.query(
    `UPDATE tenants SET access_token_enc = $1, refresh_token_enc = $2, token_expires_at = $3, updated_at = NOW() WHERE id = $4`,
    [encrypt(access_token), encrypt(new_refresh || refreshToken), newExpiry, tenantId]
  );

  return access_token;
}

async function graphRequest(tenantId, method, endpoint, data = null) {
  const token = await getValidToken(tenantId);
  const config = {
    method,
    url: `${GRAPH_BASE}${endpoint}`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (data) config.data = data;

  try {
    const response = await axios(config);
    return response.data;
  } catch (err) {
    if (err.response?.status === 403) {
      console.error(`[Graph 403] ${method} ${endpoint}:`, JSON.stringify(err.response?.data?.error));
    }
    throw err;
  }
}

// ---- USERS ----
async function listUsers(tenantId) {
  return graphRequest(tenantId, 'GET', '/users?$select=id,displayName,givenName,surname,userPrincipalName,accountEnabled,assignedLicenses,jobTitle,department,mobilePhone,businessPhones,mail,mailNickname,proxyAddresses&$top=999');
}

async function getUser(tenantId, userId) {
  return graphRequest(tenantId, 'GET', `/users/${userId}?$select=id,displayName,givenName,surname,userPrincipalName,accountEnabled,assignedLicenses,jobTitle,department,mobilePhone,businessPhones,mail,mailNickname,proxyAddresses`);
}

async function updateUser(tenantId, userId, data) {
  return graphRequest(tenantId, 'PATCH', `/users/${userId}`, data);
}

async function getManager(tenantId, userId) {
  try {
    return graphRequest(tenantId, 'GET', `/users/${userId}/manager?$select=id,displayName,userPrincipalName,jobTitle`);
  } catch {
    return null;
  }
}

async function setManager(tenantId, userId, managerId) {
  if (!managerId) {
    // Remove manager
    return graphRequest(tenantId, 'DELETE', `/users/${userId}/manager/$ref`);
  }
  return graphRequest(tenantId, 'PUT', `/users/${userId}/manager/$ref`, {
    '@odata.id': `https://graph.microsoft.com/v1.0/users/${managerId}`,
  });
}

async function createUser(tenantId, userData) {
  return graphRequest(tenantId, 'POST', '/users', userData);
}

async function blockUser(tenantId, userId, blocked) {
  return graphRequest(tenantId, 'PATCH', `/users/${userId}`, { accountEnabled: !blocked });
}

async function resetPassword(tenantId, userId, newPassword) {
  return graphRequest(tenantId, 'PATCH', `/users/${userId}`, {
    passwordProfile: { forceChangePasswordNextSignIn: true, password: newPassword },
  });
}

// Revoke all sign-in sessions (disconnect from all devices/browsers)
async function revokeSignInSessions(tenantId, userId) {
  return graphRequest(tenantId, 'POST', `/users/${userId}/revokeSignInSessions`, {});
}

// List MFA methods registered for the user
async function listAuthMethods(tenantId, userId) {
  return graphRequest(tenantId, 'GET', `/users/${userId}/authentication/methods`);
}

// Delete a specific auth method (MFA)
async function deleteAuthMethod(tenantId, userId, methodType, methodId) {
  // methodType: microsoftAuthenticatorMethods | phoneAuthenticationMethods | softwareOathMethods | fido2Methods | windowsHelloForBusinessMethods | emailMethods
  return graphRequest(tenantId, 'DELETE', `/users/${userId}/authentication/${methodType}/${methodId}`);
}

// ---- MAILBOXES (Exchange via Graph) ----

async function graphBetaRequest(tenantId, method, endpoint, data = null) {
  const token = await getValidToken(tenantId);
  const config = {
    method,
    url: `https://graph.microsoft.com/beta${endpoint}`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (data) config.data = data;
  const response = await axios(config);
  return response.data;
}

// List all mailboxes — fetch all users then filter client-side (avoids $filter issues)
async function listMailboxes(tenantId) {
  const token = await getValidToken(tenantId);
  const response = await axios.get(
    `${GRAPH_BASE}/users?$select=id,displayName,userPrincipalName,mail,accountEnabled,assignedLicenses,mailNickname,proxyAddresses,userType&$top=999`,
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  // Filter client-side: only users that have a mail address (have a mailbox)
  const all = response.data.value || [];
  return { value: all.filter(u => u.mail || u.userPrincipalName?.includes('@')) };
}

// Create shared mailbox: disabled user account (Exchange converts to SharedMailbox automatically when no license)
async function createSharedMailbox(tenantId, data) {
  const rand = Math.random().toString(36).slice(2, 10);
  return graphRequest(tenantId, 'POST', '/users', {
    displayName: data.displayName,
    userPrincipalName: data.emailAddress,
    mailNickname: data.alias || data.emailAddress.split('@')[0],
    accountEnabled: false,
    usageLocation: 'BR',
    passwordProfile: {
      forceChangePasswordNextSignIn: false,
      password: `Sh@${rand}X1!`,
    },
  });
}

// ---- MAILBOX PERMISSIONS ----
// SendOnBehalf: Graph v1.0 via grantSendOnBehalfTo field on user object
// SendAs / FullAccess: Exchange-only, stored locally and applied via available Graph endpoints

// Get SendOnBehalf delegates (Graph v1.0 native)
async function getSendOnBehalfDelegates(tenantId, mailboxId) {
  try {
    const data = await graphRequest(tenantId, 'GET',
      `/users/${mailboxId}?$select=id,displayName,grantSendOnBehalfTo`
    );
    return data.grantSendOnBehalfTo || [];
  } catch {
    return [];
  }
}

// Set SendOnBehalf delegates (Graph v1.0 native - replaces full list)
async function setSendOnBehalfDelegates(tenantId, mailboxId, delegateIds) {
  // delegateIds: array of user object IDs
  const delegates = delegateIds.map(id => ({
    '@odata.type': '#microsoft.graph.user',
    id,
  }));
  return graphRequest(tenantId, 'PATCH', `/users/${mailboxId}`, {
    grantSendOnBehalfTo: delegates,
  });
}

// SendAs: Graph v1.0 exposes this via /users/{id}/permissionGrants (OAuth2PermissionGrant)
// For mailbox SendAs specifically, we use the servicePrincipal approach
// In practice, the most reliable way is via the beta /users/{id}/mailboxPermissions
// We try beta first, fallback gracefully
async function listSendAsPermissions(tenantId, mailboxId) {
  try {
    // Try Graph beta mailbox permissions filtered to SendAs
    const data = await graphBetaRequest(tenantId, 'GET',
      `/users/${mailboxId}/mailboxPermissions`
    );
    return (data.value || []).filter(p =>
      p.permissionType === 'SendAs' || p.permissionType === 'FullAccess'
    );
  } catch {
    return [];
  }
}

// Add SendAs or FullAccess via beta (best available option without PowerShell)
async function addMailboxPermission(tenantId, mailboxId, delegateUpn, permissionType) {
  if (permissionType === 'SendOnBehalf') {
    // Use v1.0 grantSendOnBehalfTo — get current list first, then append
    const current = await getSendOnBehalfDelegates(tenantId, mailboxId);
    // Resolve delegateUpn to ID
    const userRes = await graphRequest(tenantId, 'GET',
      `/users/${encodeURIComponent(delegateUpn)}?$select=id,displayName`
    );
    const alreadyExists = current.find(d => d.id === userRes.id);
    if (!alreadyExists) {
      const newList = [...current.map(d => d.id), userRes.id];
      await setSendOnBehalfDelegates(tenantId, mailboxId, newList);
    }
    return { id: `sob_${userRes.id}`, userId: delegateUpn, displayName: userRes.displayName, permissionType: 'SendOnBehalf' };
  }

  // SendAs / FullAccess via beta
  return graphBetaRequest(tenantId, 'POST', `/users/${mailboxId}/mailboxPermissions`, {
    userId: delegateUpn,
    permissionType,
    isInherited: false,
  });
}

async function removeMailboxPermission(tenantId, mailboxId, permissionId, permissionType, delegateId) {
  if (permissionType === 'SendOnBehalf') {
    // Remove from grantSendOnBehalfTo list
    const current = await getSendOnBehalfDelegates(tenantId, mailboxId);
    const newList = current.filter(d => d.id !== delegateId).map(d => d.id);
    await setSendOnBehalfDelegates(tenantId, mailboxId, newList);
    return;
  }
  // SendAs / FullAccess via beta
  await graphBetaRequest(tenantId, 'DELETE', `/users/${mailboxId}/mailboxPermissions/${permissionId}`);
}

// Master function: get ALL permission types for a mailbox
async function listMailboxPermissions(tenantId, mailboxId) {
  const [sendOnBehalf, sendAsAndFull] = await Promise.all([
    getSendOnBehalfDelegates(tenantId, mailboxId),
    listSendAsPermissions(tenantId, mailboxId),
  ]);

  const result = [];

  // Map SendOnBehalf
  for (const d of sendOnBehalf) {
    result.push({
      id: `sob_${d.id}`,
      delegateId: d.id,
      displayName: d.displayName || d.userPrincipalName || d.id,
      userPrincipalName: d.userPrincipalName || '',
      permissionType: 'SendOnBehalf',
    });
  }

  // Map SendAs / FullAccess from beta
  for (const p of sendAsAndFull) {
    result.push({
      id: p.id,
      delegateId: p.userId || p.id,
      displayName: p.userId || p.principalName || p.id,
      userPrincipalName: p.userId || '',
      permissionType: p.permissionType,
    });
  }

  return { value: result };
}
async function listLicenses(tenantId) {
  return graphRequest(tenantId, 'GET', '/subscribedSkus');
}

async function assignLicense(tenantId, userId, skuId) {
  return graphRequest(tenantId, 'POST', `/users/${userId}/assignLicense`, {
    addLicenses: [{ skuId, disabledPlans: [] }],
    removeLicenses: [],
  });
}

async function removeLicense(tenantId, userId, skuId) {
  return graphRequest(tenantId, 'POST', `/users/${userId}/assignLicense`, {
    addLicenses: [],
    removeLicenses: [skuId],
  });
}

// ---- GROUPS ----
async function listGroups(tenantId) {
  return graphRequest(tenantId, 'GET', '/groups?$select=id,displayName,groupTypes,mailEnabled,securityEnabled,description,membershipRule,membershipRuleProcessingState&$top=999');
}

async function createGroup(tenantId, groupData) {
  return graphRequest(tenantId, 'POST', '/groups', groupData);
}

async function addGroupMember(tenantId, groupId, userId) {
  return graphRequest(tenantId, 'POST', `/groups/${groupId}/members/$ref`, {
    '@odata.id': `https://graph.microsoft.com/v1.0/users/${userId}`,
  });
}

async function removeGroupMember(tenantId, groupId, userId) {
  return graphRequest(tenantId, 'DELETE', `/groups/${groupId}/members/${userId}/$ref`);
}

async function listGroupMembers(tenantId, groupId) {
  return graphRequest(tenantId, 'GET', `/groups/${groupId}/members?$select=id,displayName,userPrincipalName`);
}

// Owners = write/admin role in group; members = read role
async function listGroupOwners(tenantId, groupId) {
  return graphRequest(tenantId, 'GET', `/groups/${groupId}/owners?$select=id,displayName,userPrincipalName`);
}

async function addGroupOwner(tenantId, groupId, userId) {
  return graphRequest(tenantId, 'POST', `/groups/${groupId}/owners/$ref`, {
    '@odata.id': `https://graph.microsoft.com/v1.0/users/${userId}`,
  });
}

async function removeGroupOwner(tenantId, groupId, userId) {
  return graphRequest(tenantId, 'DELETE', `/groups/${groupId}/owners/${userId}/$ref`);
}

// ---- SHAREPOINT DEEP ----
async function listSites(tenantId) {
  const delegatedToken = await getValidToken(tenantId);
  const fields = 'id,displayName,webUrl,name,description,createdDateTime,lastModifiedDateTime';
  const allSites = [];
  const seen = new Set();

  const addSites = (sites) => {
    for (const s of (sites || [])) {
      if (s && s.id && !seen.has(s.id)) { seen.add(s.id); allSites.push(s); }
    }
  };

  // Get app-only token via client_credentials (has Sites.ReadWrite.All application permission)
  let appToken = null;
  try {
    const tenantResult = await pool.query('SELECT tenant_id FROM tenants WHERE id = $1', [tenantId]);
    const msTenantId = tenantResult.rows[0]?.tenant_id;
    if (msTenantId && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET) {
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.AZURE_CLIENT_ID,
        client_secret: process.env.AZURE_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default',
      });
      const tokenRes = await axios.post(
        `https://login.microsoftonline.com/${msTenantId}/oauth2/v2.0/token`,
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      appToken = tokenRes.data.access_token;
    }
  } catch {}

  // Use app token if available (sees ALL sites), fallback to delegated
  const primaryToken = appToken || delegatedToken;
  const primaryHeaders = { Authorization: `Bearer ${primaryToken}`, 'Content-Type': 'application/json', 'ConsistencyLevel': 'eventual' };
  const delegatedHeaders = { Authorization: `Bearer ${delegatedToken}`, 'Content-Type': 'application/json' };

  // Strategy 1: Full enumeration with app token + ConsistencyLevel
  try {
    let url = `${GRAPH_BASE}/sites?$select=${fields}&$top=200&$count=true`;
    while (url) {
      const res = await axios.get(url, { headers: primaryHeaders });
      // Filter out personal OneDrive sites and system sites
      const filtered = (res.data.value || []).filter(s =>
        !s.webUrl?.includes('/personal/') &&
        !s.webUrl?.endsWith('/search') &&
        s.displayName  // remove unnamed sites
      );
      addSites(filtered);
      url = res.data['@odata.nextLink'] || null;
    }
  } catch {}

  // Strategy 2: search=* with delegated token (catches any missed)
  try {
    let url = `${GRAPH_BASE}/sites?search=*&$select=${fields}&$top=200`;
    while (url) {
      const res = await axios.get(url, { headers: delegatedHeaders });
      addSites(res.data.value);
      url = res.data['@odata.nextLink'] || null;
    }
  } catch {}

  // Strategy 3: root subsites
  try {
    const res = await axios.get(`${GRAPH_BASE}/sites/root/sites?$select=${fields}&$top=200`, { headers: primaryHeaders });
    addSites(res.data.value);
  } catch {}

  // Strategy 4: M365 Groups sites (via app token)
  if (allSites.length < 10) {
    try {
      const groupsRes = await axios.get(
        `${GRAPH_BASE}/groups?$filter=groupTypes/any(c:c eq 'Unified')&$select=id,displayName&$top=200`,
        { headers: primaryHeaders }
      );
      const groups = groupsRes.data.value || [];
      const batchSize = 5;
      for (let i = 0; i < groups.length; i += batchSize) {
        const batch = groups.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(g => axios.get(`${GRAPH_BASE}/groups/${g.id}/sites/root?$select=${fields}`, { headers: primaryHeaders }))
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value.data?.id) addSites([r.value.data]);
        }
      }
    } catch {}
  }

  return { value: allSites };
}

// Get site details with columns and lists
async function getSiteDetails(tenantId, siteId) {
  const [site, lists, subsites] = await Promise.allSettled([
    graphRequest(tenantId, 'GET', `/sites/${siteId}?$select=id,displayName,webUrl,description,createdDateTime,lastModifiedDateTime`),
    graphRequest(tenantId, 'GET', `/sites/${siteId}/lists?$select=id,displayName,description,list,webUrl,createdDateTime`),
    graphRequest(tenantId, 'GET', `/sites/${siteId}/sites?$select=id,displayName,webUrl,name`).catch(() => ({ value: [] })),
  ]);
  return {
    site: site.status === 'fulfilled' ? site.value : null,
    lists: lists.status === 'fulfilled' ? (lists.value.value || []) : [],
    subsites: subsites.status === 'fulfilled' ? (subsites.value.value || []) : [],
  };
}

async function getAppOnlyToken(tenantId) {
  const tenantResult = await pool.query('SELECT tenant_id FROM tenants WHERE id = $1', [tenantId]);
  const msTenantId = tenantResult.rows[0]?.tenant_id;
  if (!msTenantId) throw new Error('Tenant não encontrado');

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
  });

  const tokenRes = await axios.post(
    `https://login.microsoftonline.com/${msTenantId}/oauth2/v2.0/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return tokenRes.data.access_token;
}

async function graphRequestAppOnly(tenantId, method, endpoint, data = null) {
  const token = await getAppOnlyToken(tenantId);
  const config = {
    method,
    url: `${GRAPH_BASE}${endpoint}`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  };
  if (data) config.data = data;
  const response = await axios(config);
  return response.data;
}

async function listSiteDrives(tenantId, siteId) {
  try {
    return await graphRequest(tenantId, 'GET', `/sites/${siteId}/drives?$select=id,name,driveType,webUrl,quota,createdDateTime`);
  } catch (err) {
    if (err.response?.status === 403) {
      return graphRequestAppOnly(tenantId, 'GET', `/sites/${siteId}/drives?$select=id,name,driveType,webUrl,quota,createdDateTime`);
    }
    throw err;
  }
}

async function listDriveItems(tenantId, siteId, driveId, itemId = 'root') {
  return graphRequest(tenantId, 'GET', `/sites/${siteId}/drives/${driveId}/items/${itemId}/children`);
}

// List ALL items (files + folders) with metadata
async function listFolderItems(tenantId, driveId, itemId = 'root') {
  const endpoint = `/drives/${driveId}/items/${itemId}/children?$select=id,name,folder,file,size,webUrl,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy&$orderby=name`;
  try {
    return await graphRequest(tenantId, 'GET', endpoint);
  } catch (err) {
    if (err.response?.status === 403) return graphRequestAppOnly(tenantId, 'GET', endpoint);
    throw err;
  }
}

async function addSiteMember(tenantId, siteId, userId, role = 'read') {
  return graphRequest(tenantId, 'POST', `/sites/${siteId}/permissions`, {
    roles: [role],
    grantedToIdentities: [{ user: { id: userId } }],
  });
}

async function listSitePermissions(tenantId, siteId) {
  const endpoint = `/sites/${siteId}/permissions`;
  try {
    return await graphRequest(tenantId, 'GET', endpoint);
  } catch (err) {
    if (err.response?.status === 403) return graphRequestAppOnly(tenantId, 'GET', endpoint);
    throw err;
  }
}

async function updateSitePermission(tenantId, siteId, permissionId, role) {
  return graphRequest(tenantId, 'PATCH', `/sites/${siteId}/permissions/${permissionId}`, { roles: [role] });
}

async function deleteSitePermission(tenantId, siteId, permissionId) {
  return graphRequest(tenantId, 'DELETE', `/sites/${siteId}/permissions/${permissionId}`);
}

async function listItemPermissions(tenantId, driveId, itemId) {
  const endpoint = `/drives/${driveId}/items/${itemId}/permissions`;
  try {
    return await graphRequest(tenantId, 'GET', endpoint);
  } catch (err) {
    if (err.response?.status === 403) return graphRequestAppOnly(tenantId, 'GET', endpoint);
    throw err;
  }
}

async function addItemPermission(tenantId, driveId, itemId, userId, role) {
  const mappedRole = role === 'owner' ? 'owner' : role === 'write' ? 'write' : 'read';
  // Resolve userId to UPN if it looks like a GUID
  let recipient;
  const isGuid = /^[0-9a-f-]{36}$/i.test(userId);
  if (isGuid) {
    const user = await graphRequest(tenantId, 'GET', `/users/${userId}?$select=userPrincipalName`);
    recipient = { email: user.userPrincipalName };
  } else {
    recipient = { email: userId };
  }
  return graphRequest(tenantId, 'POST', `/drives/${driveId}/items/${itemId}/invite`, {
    requireSignIn: true,
    sendInvitation: false,
    roles: [mappedRole],
    recipients: [recipient],
  });
}

async function updateItemPermission(tenantId, driveId, itemId, permissionId, role) {
  const mappedRole = role === 'owner' ? 'owner' : role === 'write' ? 'write' : 'read';
  return graphRequest(tenantId, 'PATCH', `/drives/${driveId}/items/${itemId}/permissions/${permissionId}`, {
    roles: [mappedRole],
  });
}

async function deleteItemPermission(tenantId, driveId, itemId, permissionId) {
  return graphRequest(tenantId, 'DELETE', `/drives/${driveId}/items/${itemId}/permissions/${permissionId}`);
}

// SharePoint audit logs via Graph (requires AuditLog.Read.All)
async function getSiteAuditLogs(tenantId, siteUrl, top = 50) {
  try {
    const encoded = encodeURIComponent(`"${siteUrl}"`);
    return graphRequest(tenantId, 'GET',
      `/auditLogs/signIns?$filter=resourceDisplayName eq 'SharePoint'&$top=${top}&$select=id,createdDateTime,userDisplayName,userPrincipalName,ipAddress,status,resourceDisplayName,appDisplayName`
    );
  } catch {
    return { value: [] };
  }
}

// Drive activity (file access logs)
async function getDriveActivities(tenantId, driveId, top = 50) {
  try {
    return graphRequest(tenantId, 'GET',
      `/drives/${driveId}/activities?$top=${top}`
    );
  } catch {
    return { value: [] };
  }
}

// Item activity (specific file/folder access)
async function getItemActivities(tenantId, driveId, itemId, top = 30) {
  try {
    return graphRequest(tenantId, 'GET',
      `/drives/${driveId}/items/${itemId}/activities?$top=${top}`
    );
  } catch {
    return { value: [] };
  }
}

module.exports = {
  graphRequestPublic: graphRequest,
  graphBetaRequestPublic: graphBetaRequest,
  listUsers, getUser, updateUser, createUser, blockUser, resetPassword,
  getManager, setManager,
  revokeSignInSessions, listAuthMethods, deleteAuthMethod,
  listMailboxes, createSharedMailbox, listMailboxPermissions, addMailboxPermission, removeMailboxPermission,
  listLicenses, assignLicense, removeLicense,
  listGroups, createGroup, addGroupMember, removeGroupMember, listGroupMembers,
  listGroupOwners, addGroupOwner, removeGroupOwner,
  listSites, getSiteDetails, listSiteDrives, listDriveItems, addSiteMember,
  listSitePermissions, updateSitePermission, deleteSitePermission,
  listFolderItems, listItemPermissions, addItemPermission, updateItemPermission, deleteItemPermission,
  getSiteAuditLogs, getDriveActivities, getItemActivities,
};
