import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';

const RISK_COLOR = { medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' };
const RISK_LABEL = { medium: 'Médio', high: 'Alto', critical: 'Crítico' };

export default function ApprovalsPage() {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/risk/approvals'),
      api.get('/risk/approvals/history'),
    ]).then(([p, h]) => {
      setPending(p.data);
      setHistory(h.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id) => {
    try {
      await api.patch(`/risk/approvals/${id}/approve`);
      toast.success('Ação aprovada!');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao aprovar');
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    try {
      await api.patch(`/risk/approvals/${rejectModal}/reject`, { reason: rejectReason });
      toast.success('Ação rejeitada');
      setRejectModal(null);
      setRejectReason('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao rejeitar');
    }
  };

  const timeLeft = (expiresAt) => {
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expirado';
    const mins = Math.floor(diff / 60000);
    return mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 className="page-title">Aprovações de Risco</h1>
          {pending.length > 0 && (
            <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
              {pending.length}
            </span>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Pendentes {pending.length > 0 && `(${pending.length})`}
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          Histórico
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : tab === 'pending' ? (
        pending.length === 0 ? (
          <div className="empty-state card">
            <CheckCircle size={40} color="#10b981" />
            <p style={{ marginTop: 8 }}>Nenhuma aprovação pendente</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map(a => (
              <div key={a.id} className="card" style={{ borderLeft: `4px solid ${RISK_COLOR[a.risk_level] || '#f59e0b'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: `${RISK_COLOR[a.risk_level]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ShieldAlert size={20} color={RISK_COLOR[a.risk_level]} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{a.action}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: RISK_COLOR[a.risk_level], background: `${RISK_COLOR[a.risk_level]}22`, padding: '2px 8px', borderRadius: 10 }}>
                        {RISK_LABEL[a.risk_level]}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>
                      Solicitado por: <strong>{a.requested_by_name}</strong>
                      {a.tenant_name && <> · Tenant: <strong>{a.tenant_name}</strong></>}
                      {a.resource && <> · <strong>{a.resource}</strong></>}
                    </div>
                    {a.details?.reason && (
                      <div style={{ fontSize: 13, color: '#64748b', background: '#0f1117', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                        Motivo: {a.details.reason}
                      </div>
                    )}
                    {a.details && Object.keys(a.details).filter(k => k !== 'reason').length > 0 && (
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                        {Object.entries(a.details).filter(([k]) => k !== 'reason').map(([k, v]) => (
                          <span key={k} style={{ marginRight: 12 }}>{k}: <strong style={{ color: '#94a3b8' }}>{String(v)}</strong></span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> Expira em: {timeLeft(a.expires_at)}
                      </span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {new Date(a.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-danger btn-sm" onClick={() => setRejectModal(a.id)}>
                      <XCircle size={14} /> Rejeitar
                    </button>
                    <button className="btn btn-success btn-sm" onClick={() => handleApprove(a.id)}>
                      <CheckCircle size={14} /> Aprovar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // History
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Ação</th>
                <th>Solicitado por</th>
                <th>Tenant</th>
                <th>Risco</th>
                <th>Status</th>
                <th>Resolvido por</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {history.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{a.action}</td>
                  <td style={{ fontSize: 13, color: '#94a3b8' }}>{a.requested_by_name}</td>
                  <td style={{ fontSize: 13, color: '#64748b' }}>{a.tenant_name || '—'}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 600, color: RISK_COLOR[a.risk_level], background: `${RISK_COLOR[a.risk_level]}22`, padding: '2px 8px', borderRadius: 10 }}>
                      {RISK_LABEL[a.risk_level]}
                    </span>
                  </td>
                  <td>
                    {a.status === 'approved'
                      ? <span className="badge badge-green"><CheckCircle size={10} /> Aprovado</span>
                      : <span className="badge badge-red"><XCircle size={10} /> Rejeitado</span>}
                  </td>
                  <td style={{ fontSize: 13, color: '#94a3b8' }}>{a.approved_by_name || '—'}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{a.resolved_at ? new Date(a.resolved_at).toLocaleString('pt-BR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Rejeitar Solicitação</h2>
            <div className="form-group">
              <label>Motivo da rejeição</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Explique o motivo..." />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setRejectModal(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleReject}>Rejeitar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
