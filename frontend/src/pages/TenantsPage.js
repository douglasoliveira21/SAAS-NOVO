import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Building2, Link, Trash2, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from './DashboardPage';
import { useRiskAction } from '../hooks/useRiskAction';

export default function TenantsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', tenant_id: '' });
  const [saving, setSaving] = useState(false);
  const { confirm, RiskModal } = useRiskAction();

  const load = () => {
    setLoading(true);
    api.get('/tenants').then(r => setTenants(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) toast.success('Microsoft 365 conectado com sucesso!');
    if (error) toast.error(`Erro na conexão: ${error}`);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/tenants', form);
      toast.success('Instância criada!');
      setShowModal(false);
      setForm({ name: '', tenant_id: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar instância');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async (tenant) => {
    try {
      const res = await api.get(`/tenants/${tenant.id}/connect`);
      window.location.href = res.data.authUrl;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao iniciar conexão');
    }
  };

  const handleDelete = async (id, name) => {
    const { confirmed, reason } = await confirm('DELETE_TENANT', {
      targetName: name,
      details: { instância: name },
    });
    if (!confirmed) return;
    await api.delete(`/tenants/${id}`);
    toast.success('Instância excluída');
    load();
  };

  return (
    <div>
      {RiskModal}
      <div className="page-header">
        <h1 className="page-title">Instâncias M365</h1>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Nova Instância
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
        ) : tenants.length === 0 ? (
          <div className="empty-state">
            <Building2 size={48} />
            <p style={{ marginTop: 8 }}>Nenhuma instância cadastrada</p>
            {isAdmin && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}><Plus size={16} /> Criar primeira instância</button>}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Tenant ID</th>
                <th>Status</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{t.tenant_id}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td style={{ color: '#64748b', fontSize: 13 }}>{new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/tenants/${t.id}`)}>
                        <Settings size={14} /> Gerenciar
                      </button>
                      {isAdmin && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleConnect(t)} title="Conectar M365">
                            <Link size={14} /> Conectar
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id, t.name)}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Nova Instância M365</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Nome da Empresa</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Empresa XYZ" />
              </div>
              <div className="form-group">
                <label>Tenant ID (Microsoft)</label>
                <input required value={form.tenant_id} onChange={e => setForm(f => ({ ...f, tenant_id: e.target.value }))} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                <small style={{ color: '#64748b', fontSize: 12, marginTop: 4, display: 'block' }}>
                  Encontre em: portal.azure.com → Azure Active Directory → Visão geral
                </small>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" /> : 'Criar Instância'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
