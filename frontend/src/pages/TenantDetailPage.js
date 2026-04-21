import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Package, UsersRound, FolderOpen, RefreshCw, Link, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from './DashboardPage';
import UsersTab from '../components/tenant/UsersTab';
import LicensesTab from '../components/tenant/LicensesTab';
import GroupsTab from '../components/tenant/GroupsTab';
import SharePointTab from '../components/tenant/SharePointTab';
import MailboxTab from '../components/tenant/MailboxTab';

const TABS = [
  { id: 'users', label: 'Usuários', icon: Users },
  { id: 'licenses', label: 'Licenças', icon: Package },
  { id: 'groups', label: 'Grupos', icon: UsersRound },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sharepoint', label: 'SharePoint', icon: FolderOpen },
];

export default function TenantDetailPage() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [activeTab, setActiveTab] = useState('users');
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    api.get('/tenants').then(r => {
      const t = r.data.find(x => x.id === tenantId);
      if (!t) navigate('/tenants');
      else setTenant(t);
    });
  }, [tenantId]);

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await api.post(`/tenants/${tenantId}/validate`);
      toast.success(`Conexão válida — ${res.data.userCount} usuários, ${res.data.licenseCount} licenças`);
      setTenant(t => ({ ...t, status: 'connected' }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Falha na validação');
      setTenant(t => ({ ...t, status: 'error' }));
    } finally {
      setValidating(false);
    }
  };

  const handleConnect = async () => {
    try {
      const res = await api.get(`/tenants/${tenantId}/connect`);
      window.location.href = res.data.authUrl;
    } catch (err) {
      toast.error('Erro ao iniciar conexão');
    }
  };

  if (!tenant) return <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tenants')} style={{ marginTop: 4 }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="page-title">{tenant.name}</h1>
            <StatusBadge status={tenant.status} />
          </div>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4, fontFamily: 'monospace' }}>{tenant.tenant_id}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button className="btn btn-ghost btn-sm" onClick={handleConnect}>
              <Link size={14} /> Reconectar
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={handleValidate} disabled={validating}>
            <RefreshCw size={14} className={validating ? 'spinner' : ''} /> Validar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
            <Icon size={14} style={{ display: 'inline', marginRight: 6 }} />{label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'users' && <UsersTab tenantId={tenantId} />}
      {activeTab === 'licenses' && <LicensesTab tenantId={tenantId} />}
      {activeTab === 'groups' && <GroupsTab tenantId={tenantId} />}
      {activeTab === 'email' && <MailboxTab tenantId={tenantId} />}
      {activeTab === 'sharepoint' && <SharePointTab tenantId={tenantId} />}
    </div>
  );
}
