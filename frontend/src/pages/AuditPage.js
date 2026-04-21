import React, { useEffect, useState } from 'react';
import { RefreshCw, ClipboardList } from 'lucide-react';
import api from '../api/client';

const ACTION_COLORS = {
  LOGIN: 'badge-blue',
  CREATE_USER: 'badge-green', CREATE_TENANT: 'badge-green', CREATE_M365_USER: 'badge-green', CREATE_GROUP: 'badge-green',
  DELETE_USER: 'badge-red', DELETE_TENANT: 'badge-red',
  BLOCK_USER: 'badge-red', UNBLOCK_USER: 'badge-green',
  RESET_PASSWORD: 'badge-yellow',
  ASSIGN_LICENSE: 'badge-green', REMOVE_LICENSE: 'badge-red',
  ADD_GROUP_MEMBER: 'badge-green', REMOVE_GROUP_MEMBER: 'badge-red',
  ADD_SITE_MEMBER: 'badge-green',
};

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/audit?limit=200').then(r => setLogs(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Logs de Auditoria</h1>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Atualizar</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
        ) : logs.length === 0 ? (
          <div className="empty-state"><ClipboardList size={40} /><p>Nenhum log encontrado</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Instância</th>
                <th>Detalhes</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id}>
                  <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                    {new Date(l.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ fontSize: 13 }}>{l.user_name || '—'}</td>
                  <td>
                    <span className={`badge ${ACTION_COLORS[l.action] || 'badge-gray'}`} style={{ fontSize: 11 }}>
                      {l.action}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: '#94a3b8' }}>{l.tenant_name || '—'}</td>
                  <td style={{ fontSize: 12, color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.details ? JSON.stringify(l.details) : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{l.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
