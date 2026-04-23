import React, { useEffect, useState } from 'react';
import { Package, RefreshCw, Plus, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { friendlyLicense } from '../../utils/licenseNames';

function friendlyName(skuPartNumber) {
  return friendlyLicense(skuPartNumber);
}

export default function LicensesTab({ tenantId }) {
  const [licenses, setLicenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(null);
  const [selectedUser, setSelectedUser] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get(`/tenants/${tenantId}/licenses`),
      api.get(`/tenants/${tenantId}/users`),
    ]).then(([lr, ur]) => {
      setLicenses(lr.data);
      setUsers(ur.data);
    }).catch(e => toast.error(e.response?.data?.error || 'Erro ao carregar')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]);

  const handleAssign = async () => {
    if (!selectedUser || !showAssign) return;
    setSaving(true);
    try {
      await api.post(`/tenants/${tenantId}/users/${selectedUser}/licenses`, { skuId: showAssign.skuId });
      toast.success('Licença atribuída!');
      setShowAssign(null);
      setSelectedUser('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atribuir licença');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Licença</th>
                <th>SKU</th>
                <th>Total</th>
                <th>Usadas</th>
                <th>Disponíveis</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map(l => {
                const available = l.prepaidUnits?.enabled - l.consumedUnits;
                return (
                  <tr key={l.skuId}>
                    <td style={{ fontWeight: 500 }}>{friendlyName(l.skuPartNumber)}</td>
                    <td style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{l.skuPartNumber}</td>
                    <td>{l.prepaidUnits?.enabled}</td>
                    <td>{l.consumedUnits}</td>
                    <td>
                      <span className={`badge ${available > 0 ? 'badge-green' : 'badge-red'}`}>{available}</span>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowAssign(l)} disabled={available <= 0}>
                        <Plus size={13} /> Atribuir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAssign && (
        <div className="modal-overlay" onClick={() => setShowAssign(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Atribuir Licença</h2>
            <p style={{ color: '#94a3b8', marginBottom: 16, fontSize: 14 }}>{friendlyName(showAssign.skuPartNumber)}</p>
            <div className="form-group">
              <label>Selecionar usuário</label>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                <option value="">— Selecione —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.displayName} ({u.userPrincipalName})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setShowAssign(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAssign} disabled={!selectedUser || saving}>
                {saving ? <span className="spinner" /> : 'Atribuir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
