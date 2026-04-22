const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Run a PowerShell script, returns parsed JSON output
 */
function runPowerShell(scriptPath) {
  return new Promise((resolve, reject) => {
    execFile('pwsh',
      ['-NonInteractive', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { timeout: 90000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const output = stdout?.trim() || '';
        const errMsg = stderr?.trim() || err?.message || '';

        // Try to parse JSON from stdout
        try {
          const result = JSON.parse(output);
          if (result && result.__error) return reject(new Error(result.__error));
          return resolve(result);
        } catch {
          if (errMsg) return reject(new Error(errMsg.slice(0, 500)));
          if (output) return resolve({ raw: output });
          return reject(new Error('PowerShell returned no output'));
        }
      }
    );
  });
}

function runScript(scriptContent) {
  const tmpFile = path.join(os.tmpdir(), `exo_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`);
  // Write BOM-less UTF8
  fs.writeFileSync(tmpFile, scriptContent, { encoding: 'utf8' });
  return runPowerShell(tmpFile).finally(() => {
    try { fs.unlinkSync(tmpFile); } catch {}
  });
}

// ─── Build connection + command script ───────────────────────────────────────
// ExchangeOnlineManagement v3.x uses certificate-based app-only auth
// We generate a self-signed cert on first use and register it, OR use
// the modern approach: get an EXO-specific token via client_credentials flow

function buildScript(clientId, clientSecret, tenantId, commands) {
  // Get EXO token via OAuth2 client_credentials, then connect with it
  return `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

try {
  Import-Module ExchangeOnlineManagement -ErrorAction Stop

  # Get access token for EXO via client credentials
  $tokenBody = @{
    grant_type    = 'client_credentials'
    client_id     = '${clientId}'
    client_secret = '${clientSecret.replace(/'/g, "''")}'
    scope         = 'https://outlook.office365.com/.default'
  }
  $tokenResponse = Invoke-RestMethod \`
    -Uri "https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token" \`
    -Method POST \`
    -Body $tokenBody \`
    -ContentType 'application/x-www-form-urlencoded'

  $exoToken = $tokenResponse.access_token

  # Connect with the EXO token
  Connect-ExchangeOnline \`
    -AccessToken $exoToken \`
    -Organization '${tenantId}' \`
    -ShowBanner:$false \`
    -ErrorAction Stop

  ${commands}

  Disconnect-ExchangeOnline -Confirm:$false -ErrorAction SilentlyContinue

} catch {
  @{ __error = $_.Exception.Message } | ConvertTo-Json -Compress
  exit 0
}
`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function listMailboxPermissions(clientId, clientSecret, tenantGuid, mailboxUpn) {
  const commands = `
  $results = [System.Collections.Generic.List[hashtable]]::new()

  # FullAccess
  try {
    $fa = Get-MailboxPermission -Identity '${mailboxUpn}' |
          Where-Object { $_.User -notlike 'NT AUTHORITY*' -and $_.User -notlike 'S-1-*' -and $_.IsInherited -eq $false }
    foreach ($p in $fa) {
      $results.Add(@{
        id = "fa_" + ($p.User -replace '[^a-zA-Z0-9@._-]','_')
        displayName = $p.User.ToString()
        userPrincipalName = $p.User.ToString()
        permissionType = 'FullAccess'
        delegateId = $p.User.ToString()
      })
    }
  } catch { }

  # SendAs
  try {
    $sa = Get-RecipientPermission -Identity '${mailboxUpn}' |
          Where-Object { $_.Trustee -notlike 'NT AUTHORITY*' -and $_.Trustee -notlike 'S-1-*' -and $_.IsInherited -eq $false }
    foreach ($p in $sa) {
      $results.Add(@{
        id = "sa_" + ($p.Trustee -replace '[^a-zA-Z0-9@._-]','_')
        displayName = $p.Trustee.ToString()
        userPrincipalName = $p.Trustee.ToString()
        permissionType = 'SendAs'
        delegateId = $p.Trustee.ToString()
      })
    }
  } catch { }

  # SendOnBehalf
  try {
    $mb = Get-Mailbox -Identity '${mailboxUpn}'
    foreach ($d in $mb.GrantSendOnBehalfTo) {
      $results.Add(@{
        id = "sob_" + ($d -replace '[^a-zA-Z0-9@._-]','_')
        displayName = $d.ToString()
        userPrincipalName = $d.ToString()
        permissionType = 'SendOnBehalf'
        delegateId = $d.ToString()
      })
    }
  } catch { }

  if ($results.Count -eq 0) {
    '[]'
  } else {
    $results | ConvertTo-Json -Depth 3 -Compress
  }
  `;

  const script = buildScript(clientId, clientSecret, tenantGuid, commands);
  const result = await runScript(script);
  if (Array.isArray(result)) return result;
  if (result?.raw) {
    try { return JSON.parse(result.raw); } catch { return []; }
  }
  return [];
}

async function addMailboxPermission(clientId, clientSecret, tenantGuid, mailboxUpn, delegateUpn, permissionType) {
  let cmd = '';
  if (permissionType === 'FullAccess') {
    cmd = `Add-MailboxPermission -Identity '${mailboxUpn}' -User '${delegateUpn}' -AccessRights FullAccess -InheritanceType All -AutoMapping $true -Confirm:$false | Out-Null`;
  } else if (permissionType === 'SendAs') {
    cmd = `Add-RecipientPermission -Identity '${mailboxUpn}' -Trustee '${delegateUpn}' -AccessRights SendAs -Confirm:$false | Out-Null`;
  } else if (permissionType === 'SendOnBehalf') {
    cmd = `
    $mb = Get-Mailbox -Identity '${mailboxUpn}'
    $cur = @($mb.GrantSendOnBehalfTo | ForEach-Object { $_.ToString() })
    if ($cur -notcontains '${delegateUpn}') {
      $cur += '${delegateUpn}'
      Set-Mailbox -Identity '${mailboxUpn}' -GrantSendOnBehalfTo $cur -Confirm:$false
    }`;
  }

  const commands = `${cmd}\n'{"success":true}'`;
  const script = buildScript(clientId, clientSecret, tenantGuid, commands);
  return runScript(script);
}

async function removeMailboxPermission(clientId, clientSecret, tenantGuid, mailboxUpn, delegateUpn, permissionType) {
  let cmd = '';
  if (permissionType === 'FullAccess') {
    cmd = `Remove-MailboxPermission -Identity '${mailboxUpn}' -User '${delegateUpn}' -AccessRights FullAccess -Confirm:$false`;
  } else if (permissionType === 'SendAs') {
    cmd = `Remove-RecipientPermission -Identity '${mailboxUpn}' -Trustee '${delegateUpn}' -AccessRights SendAs -Confirm:$false`;
  } else if (permissionType === 'SendOnBehalf') {
    cmd = `
    $mb = Get-Mailbox -Identity '${mailboxUpn}'
    $newList = @($mb.GrantSendOnBehalfTo | Where-Object { $_.ToString() -ne '${delegateUpn}' })
    Set-Mailbox -Identity '${mailboxUpn}' -GrantSendOnBehalfTo $newList -Confirm:$false`;
  }

  const commands = `${cmd}\n'{"success":true}'`;
  const script = buildScript(clientId, clientSecret, tenantGuid, commands);
  return runScript(script);
}

module.exports = { listMailboxPermissions, addMailboxPermission, removeMailboxPermission };
