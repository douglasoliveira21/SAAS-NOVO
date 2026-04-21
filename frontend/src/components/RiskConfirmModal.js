import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, ShieldAlert, Shield, X } from 'lucide-react';

const RISK_CONFIG = {
  low:      { color: '#10b981', bg: '#064e3b', icon: Shield,       label: 'Baixo Risco' },
  medium:   { color: '#f59e0b', bg: '#451a03', icon: AlertTriangle, label: 'Risco Médio' },
  high:     { color: '#ef4444', bg: '#450a0a', icon: ShieldAlert,   label: 'Alto Risco' },
  critical: { color: '#dc2626', bg: '#3b0000', icon: ShieldAlert,   label: 'Risco Crítico' },
};

export default function RiskConfirmModal({
  action,
  actionLabel,
  riskLevel = 'medium',
  confirmWord,
  requireReason = false,
  context = {},
  onConfirm,
  onCancel,
}) {
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const cfg = RISK_CONFIG[riskLevel] || RISK_CONFIG.medium;
  const Icon = cfg.icon;

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const canConfirm = () => {
    if (confirmWord && typed.trim().toUpperCase() !== confirmWord.toUpperCase()) return false;
    if (requireReason && reason.trim().length < 5) return false;
    return true;
  };

  const handleConfirm = async () => {
    if (!canConfirm()) return;
    setSaving(true);
    try {
      await onConfirm(reason || undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal" style={{ maxWidth: 460, border: `1px solid ${cfg.color}44` }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={22} color={cfg.color} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{actionLabel || action}</h2>
              <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: 10 }}>
                {cfg.label}
              </span>
            </div>
            {context.tenantName && (
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
                Tenant: <strong style={{ color: '#94a3b8' }}>{context.tenantName}</strong>
                {context.targetName && <> · <strong style={{ color: '#94a3b8' }}>{context.targetName}</strong></>}
              </p>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}><X size={16} /></button>
        </div>

        {/* Context details */}
        {context.details && Object.keys(context.details).length > 0 && (
          <div style={{ background: '#0f1117', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
            {Object.entries(context.details).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
                <span style={{ color: '#64748b', minWidth: 100 }}>{k}:</span>
                <span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Warning */}
        <div style={{ background: `${cfg.color}11`, border: `1px solid ${cfg.color}33`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: cfg.color }}>
          <AlertTriangle size={13} style={{ display: 'inline', marginRight: 6 }} />
          {riskLevel === 'critical' || riskLevel === 'high'
            ? 'Esta ação é sensível e será registrada no log de auditoria com detalhes completos.'
            : 'Esta ação será registrada no log de auditoria.'}
        </div>

        {/* Reason */}
        {requireReason && (
          <div className="form-group">
            <label>Motivo da ação <span style={{ color: cfg.color }}>*</span></label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Descreva o motivo desta ação..."
              rows={2}
              style={{ resize: 'vertical', minHeight: 60 }}
            />
            {reason.trim().length > 0 && reason.trim().length < 5 && (
              <small style={{ color: '#ef4444', fontSize: 11 }}>Mínimo 5 caracteres</small>
            )}
          </div>
        )}

        {/* Confirm word */}
        {confirmWord && (
          <div className="form-group">
            <label>
              Digite <strong style={{ color: cfg.color, fontFamily: 'monospace' }}>{confirmWord}</strong> para confirmar
            </label>
            <input
              ref={inputRef}
              value={typed}
              onChange={e => setTyped(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canConfirm() && handleConfirm()}
              placeholder={confirmWord}
              style={{
                fontFamily: 'monospace', letterSpacing: '0.1em',
                borderColor: typed && typed.toUpperCase() === confirmWord.toUpperCase() ? '#10b981' : '#2d3748',
              }}
              autoComplete="off"
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm() || saving}
            style={{
              background: canConfirm() ? cfg.color : '#2d3748',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 20px', fontWeight: 600,
              cursor: canConfirm() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 14,
              opacity: canConfirm() ? 1 : 0.5,
            }}>
            {saving ? <span className="spinner" /> : <><Icon size={14} /> Confirmar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
