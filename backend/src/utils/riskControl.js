/**
 * Risk Control System
 * Defines sensitive actions, their risk levels, and approval requirements.
 */

// Risk levels: low | medium | high | critical
// medium = requires typed confirmation
// high = requires typed confirmation + reason
// critical = requires admin approval from another admin

const RISK_ACTIONS = {
  // ── Users ──────────────────────────────────────────────────────────────────
  RESET_PASSWORD:        { level: 'medium', label: 'Redefinir senha', confirmWord: 'CONFIRMAR' },
  BLOCK_USER:            { level: 'medium', label: 'Bloquear usuário', confirmWord: 'BLOQUEAR' },
  DELETE_MFA_METHOD:     { level: 'high',   label: 'Remover método MFA', confirmWord: 'REMOVER MFA', requireReason: true },
  REVOKE_SESSIONS:       { level: 'high',   label: 'Revogar todas as sessões', confirmWord: 'REVOGAR', requireReason: true },
  CREATE_M365_USER:      { level: 'medium', label: 'Criar usuário M365', confirmWord: 'CRIAR' },
  UPDATE_M365_USER:      { level: 'low',    label: 'Editar usuário' },

  // ── Licenses ───────────────────────────────────────────────────────────────
  REMOVE_LICENSE:        { level: 'high',   label: 'Remover licença', confirmWord: 'REMOVER', requireReason: true },
  ASSIGN_LICENSE:        { level: 'medium', label: 'Atribuir licença', confirmWord: 'CONFIRMAR' },

  // ── Groups ─────────────────────────────────────────────────────────────────
  REMOVE_GROUP_MEMBER:   { level: 'medium', label: 'Remover membro do grupo', confirmWord: 'REMOVER' },
  CREATE_GROUP:          { level: 'low',    label: 'Criar grupo' },

  // ── SharePoint ─────────────────────────────────────────────────────────────
  REMOVE_SITE_PERMISSION:   { level: 'high', label: 'Remover permissão de site', confirmWord: 'REMOVER', requireReason: true },
  REMOVE_FOLDER_PERMISSION: { level: 'medium', label: 'Remover permissão de pasta', confirmWord: 'REMOVER' },
  ADD_SITE_MEMBER:          { level: 'medium', label: 'Adicionar membro ao site', confirmWord: 'CONFIRMAR' },

  // ── Mailbox ────────────────────────────────────────────────────────────────
  REMOVE_MAILBOX_PERMISSION: { level: 'high', label: 'Remover permissão de caixa', confirmWord: 'REMOVER', requireReason: true },
  ADD_MAILBOX_PERMISSION:    { level: 'medium', label: 'Adicionar delegação de caixa', confirmWord: 'CONFIRMAR' },
  CREATE_SHARED_MAILBOX:     { level: 'medium', label: 'Criar caixa compartilhada', confirmWord: 'CRIAR' },

  // ── Tenants ────────────────────────────────────────────────────────────────
  DELETE_TENANT:         { level: 'critical', label: 'Excluir instância', confirmWord: 'EXCLUIR INSTÂNCIA', requireReason: true },
  CREATE_TENANT:         { level: 'low',      label: 'Criar instância' },

  // ── System users ───────────────────────────────────────────────────────────
  DELETE_USER:           { level: 'high',   label: 'Excluir usuário do sistema', confirmWord: 'EXCLUIR', requireReason: true },
  UPDATE_USER:           { level: 'low',    label: 'Editar usuário do sistema' },
};

function getRisk(action) {
  return RISK_ACTIONS[action] || { level: 'low', label: action };
}

function isHighRisk(action) {
  const r = getRisk(action);
  return r.level === 'high' || r.level === 'critical';
}

function requiresApproval(action) {
  return getRisk(action).requireAdminApproval === true;
}

module.exports = { RISK_ACTIONS, getRisk, isHighRisk, requiresApproval };
