
import React, { useEffect, useState } from 'react';
import { UserPlus, Lock, Unlock, Key, Search, RefreshCw, Pencil, LogOut, ShieldOff, X, Plus, CheckSquare, Square, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { useRiskAction } from '../../hooks/useRiskAction';
import BatchPanel from './BatchPanel';
import CreateUserWizard from './CreateUserWizard';

// ─── helpers ────────────────────────────────────────────────────────────────
const MFA_TYPE_LABEL = {
  '#microsoft.graph.microsoftAuthenticatorAuthenticationMethod': 'Microsoft Authenticator',
  '#microsoft.graph.phoneAuthenticationMethod': 'Telefone / SMS',
  '#microsoft.graph.softwareOathAuthenticationMethod': 'App TOTP (OATH)',
  '#microsoft.graph.fido2AuthenticationMethod': 'Chave FIDO2',
  '#microsoft.graph.windowsHelloForBusinessAuthenticationMethod': 'Windows Hello',
  '#microsoft.graph.emailAuthenticationMethod': 'Email',
  '#microsoft.graph.passwordAuthenticationMethod': 'Senha',
};

const MFA_TYPE_KEY = {
  '#microsoft.graph.microsoftAuthenticatorAuthenticationMethod': 'microsoftAuthenticatorMethods',
  '#microsoft.graph.phoneAuthenticationMethod': 'phoneAuthenticationMethods',
  '#microsoft.graph.softwareOathAuthenticationMethod': 'softwareOathMethods',
  '#microsoft.graph.fido2AuthenticationMethod': 'fido2Methods',
  '#microsoft.graph.windowsHelloForBusinessAuthenticationMethod': 'windowsHelloForBusinessMethods',
  '#microsoft.graph.emailAuthenticationMethod': 'emailMethods',
};

function parseProxyAddresses(proxyAddresses = []) {
  return proxyAddresses
    .filter(a => a.toLowerCase().startsWith('smtp:'))
    .map(a => ({ address: a.slice(5), primary: a.startsWith('SMTP:') }));
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────
function EditUserModal({ user, tenantId, onClose, onSaved }) {
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState({
    givenName: user.givenName || '',
    surname: user.surname || '',
    displayName: user.displayName || '',
    jobTitle: user.jobTitle || '',
    department: user.department || '',
    mobilePhone: user.mobilePhone || '',
    businessPhone: user.businessPhones?.[0] || '',
    userPrincipalName: user.userPrincipalName || '',
    mailNickname: user.mailNickname || '',
    managerId: '',
  });
  const [aliases, setAliases] = useState(parseProxyAddresses(user.proxyAddresses));
  const [newAlias, setNewAlias] = useState('');
  const [mfaMethods, setMfaMethods] = useState(null);
  const [loadingMfa, setLoadingMfa] = useState(false);
  const [manager, setManager] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-fill displayName when first/last name changes
  const handleNameChange = (k, v) => {
    const updated = { ...form, [k]: v };
    if (!form.displayName || form.displayName === `${form.givenName} ${form.surname}`.trim()) {
      updated.displayName = `${updated.givenName} ${updated.surname}`.trim();
    }
    setForm(updated);
  };

  const loadMfa = async () => {
    if (mfaMethods) return;
    setLoadingMfa(true);
    try {
      const res = await api.get(`/tenants/${tenantId}/users/${user.id}/auth-methods`);
      setMfaMethods(res.data.filter(m => m['@odata.type'] !== '#microsoft.graph.passwordAuthenticationMethod'));
    } catch (err) {
      toast.error('Erro ao carregar métodos MFA');
    } finally {
      setLoadingMfa(false);
    }
  };

  useEffect(() => { if (tab === 'security') loadMfa(); }, [tab]);

  // Load manager and users list on mount
  useEffect(() => {
    Promise.all([
      api.get(`/tenants/${tenantId}/users/${user.id}/manager`).catch(() => null),
      api.get(`/tenants/${tenantId}/users`),
    ]).then(([mgr, usrs]) => {
      if (mgr?.data?.id) {
        setManager(mgr.data);
        setForm(f => ({ ...f, managerId: mgr.data.id }));
      }
      setAllUsers(usrs.data.filter(u => u.id !== user.id));
    }).catch(() => {});
  }, [user.id]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        givenName: form.givenName,
        surname: form.surname,
        displayName: form.displayName,
        jobTitle: form.jobTitle,
        department: form.department,
        mobilePhone: form.mobilePhone || null,
        businessPhones: form.businessPhone ? [form.businessPhone] : [],
        mailNickname: form.mailNickname,
      };
      // UPN change
      if (form.userPrincipalName !== user.userPrincipalName) {
        payload.userPrincipalName = form.userPrincipalName;
      }
      await api.patch(`/tenants/${tenantId}/users/${user.id}`, payload);

      // Update manager if changed
      const newManagerId = form.managerId || null;
      const currentManagerId = manager?.id || null;
      if (newManagerId !== currentManagerId) {
        await api.put(`/tenants/${tenantId}/users/${user.id}/manager`, { managerId: newManagerId });
        setManager(newManagerId ? allUsers.find(u => u.id === newManagerId) || null : null);
      }

      toast.success('Perfil atualizado!');
      onSaved({ ...user, ...payload });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAliases = async () => {
    setSaving(true);
    try {
      // Build proxyAddresses: primary SMTP + aliases smtp:
      const primary = `SMTP:${form.userPrincipalName.split('@')[0]}@${form.userPrincipalName.split('@')[1]}`;
      const aliasEntries = aliases.filter(a => !a.primary).map(a => `smtp:${a.address}`);
      const proxyAddresses = [primary, ...aliasEntries];
      await api.patch(`/tenants/${tenantId}/users/${user.id}`, { proxyAddresses });
      toast.success('Aliases atualizados!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar aliases');
    } finally {
      setSaving(false);
    }
  };

  const addAlias = () => {
    if (!newAlias || !newAlias.includes('@')) return toast.error('Email inválido');
    if (aliases.find(a => a.address === newAlias)) return toast.error('Alias já existe');
    setAliases(a => [...a, { address: newAlias, primary: false }]);
    setNewAlias('');
  };

  const removeAlias = (address) => {
    setAliases(a => a.filter(x => x.address !== address));
  };

  const handleRevokeSessions = async () => {
    const { confirmed, reason } = await (window._riskConfirm?.('REVOKE_SESSIONS', {
      targetName: user.displayName,
      details: { email: user.userPrincipalName },
    }) || Promise.resolve({ confirmed: window.confirm(`Desconectar ${user.displayName} de todas as sessões ativas?`) }));
    if (!confirmed) return;
    try {
      await api.post(`/tenants/${tenantId}/users/${user.id}/revoke-sessions`);
      toast.success('Todas as sessões foram encerradas!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao revogar sessões');
    }
  };

  const handleDeleteMfa = async (method) => {
    const typeKey = MFA_TYPE_KEY[method['@odata.type']];
    if (!typeKey) return toast.error('Tipo de método não suportado para remoção');
    const { confirmed } = await (window._riskConfirm?.('DELETE_MFA_METHOD', {
      targetName: user.displayName,
      details: { method: MFA_TYPE_LABEL[method['@odata.type']], email: user.userPrincipalName },
    }) || Promise.resolve({ confirmed: window.confirm(`Remover "${MFA_TYPE_LABEL[method['@odata.type']] || 'método MFA'}"?`) }));
    if (!confirmed) return;
    try {
      await api.delete(`/tenants/${tenantId}/users/${user.id}/auth-methods/${typeKey}/${method.id}`);
      toast.success('Método MFA removido!');
      setMfaMethods(m => m.filter(x => x.id !== method.id));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao remover método MFA');
    }
  };

  const handleRevokeAllMfa = async () => {
    const { confirmed } = await (window._riskConfirm?.('DELETE_MFA_METHOD', {
      targetName: user.displayName,
      details: { action: 'Remover TODOS os métodos MFA', email: user.userPrincipalName },
    }) || Promise.resolve({ confirmed: window.confirm(`Remover TODOS os métodos MFA de ${user.displayName}?`) }));
    if (!confirmed) return;
    const removable = (mfaMethods || []).filter(m => MFA_TYPE_KEY[m['@odata.type']]);
    if (removable.length === 0) return toast('Nenhum método removível encontrado');
    let ok = 0;
    for (const m of removable) {
      try {
        await api.delete(`/tenants/${tenantId}/users/${user.id}/auth-methods/${MFA_TYPE_KEY[m['@odata.type']]}/${m.id}`);
        ok++;
      } catch {}
    }
    toast.success(`${ok} método(s) MFA removido(s). Usuário precisará reconfigurar.`);
    setMfaMethods(m => m.filter(x => !MFA_TYPE_KEY[x['@odata.type']]));
  };

  const TABS = [
    { id: 'profile', label: 'Perfil' },
    { id: 'email', label: 'Email / Aliases' },
    { id: 'security', label: 'Segurança / MFA' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Editar Usuário</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{user.userPrincipalName}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 20 }}>
          {TABS.map(t => (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Nome</label>
                <input value={form.givenName} onChange={e => handleNameChange('givenName', e.target.value)} placeholder="João" />
              </div>
              <div className="form-group">
                <label>Sobrenome</label>
                <input value={form.surname} onChange={e => handleNameChange('surname', e.target.value)} placeholder="Silva" />
              </div>
            </div>
            <div className="form-group">
              <label>Nome para exibição</label>
              <input value={form.displayName} onChange={e => set('displayName', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Cargo</label>
                <input value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} placeholder="Analista" />
              </div>
              <div className="form-group">
                <label>Departamento</label>
                <input value={form.department} onChange={e => set('department', e.target.value)} placeholder="TI" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Celular</label>
                <input value={form.mobilePhone} onChange={e => set('mobilePhone', e.target.value)} placeholder="+55 11 99999-9999" />
              </div>
              <div className="form-group">
                <label>Telefone comercial</label>
                <input value={form.businessPhone} onChange={e => set('businessPhone', e.target.value)} placeholder="+55 11 3333-3333" />
              </div>
            </div>
            <div className="form-group">
              <label>Gestor direto</label>
              <select value={form.managerId} onChange={e => set('managerId', e.target.value)}>
                <option value="">— Sem gestor definido —</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.displayName} ({u.userPrincipalName})</option>
                ))}
              </select>
              {manager && (
                <small style={{ color: '#64748b', fontSize: 11, marginTop: 4, display: 'block' }}>
                  Gestor atual: <strong style={{ color: '#94a3b8' }}>{manager.displayName}</strong>
                </small>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Salvar perfil'}
              </button>
            </div>
          </div>
        )}

        {/* ── EMAIL TAB ── */}
        {tab === 'email' && (
          <div>
            <div className="form-group">
              <label>Email principal (UPN)</label>
              <input value={form.userPrincipalName} onChange={e => set('userPrincipalName', e.target.value)} />
              <small style={{ color: '#64748b', fontSize: 12, marginTop: 4, display: 'block' }}>
                Alterar o UPN muda o email de login do usuário.
              </small>
            </div>
            <div className="form-group">
              <label>Alias de email (mailNickname)</label>
              <input value={form.mailNickname} onChange={e => set('mailNickname', e.target.value)} />
            </div>

            <div style={{ marginTop: 4, marginBottom: 8 }}>
              <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 8 }}>Aliases adicionais</label>
              {aliases.length === 0 && <p style={{ color: '#64748b', fontSize: 13, marginBottom: 8 }}>Nenhum alias configurado</p>}
              {aliases.map(a => (
                <div key={a.address} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#0f1117', borderRadius: 6, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13 }}>{a.address}</span>
                    {a.primary && <span className="badge badge-blue" style={{ fontSize: 10 }}>Principal</span>}
                  </div>
                  {!a.primary && (
                    <button className="btn btn-danger btn-sm" onClick={() => removeAlias(a.address)}><X size={12} /></button>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  value={newAlias}
                  onChange={e => setNewAlias(e.target.value)}
                  placeholder="novo@dominio.com"
                  onKeyDown={e => e.key === 'Enter' && addAlias()}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-ghost btn-sm" onClick={addAlias}><Plus size={14} /> Adicionar</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Salvar email/UPN'}
              </button>
              <button className="btn btn-ghost" onClick={handleSaveAliases} disabled={saving}>
                Salvar aliases
              </button>
            </div>
          </div>
        )}

        {/* ── SECURITY TAB ── */}
        {tab === 'security' && (
          <div>
            {/* Revoke sessions */}
            <div className="card" style={{ marginBottom: 16, background: '#13151f' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Desconectar de todas as sessões</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    Encerra imediatamente todas as sessões ativas no Microsoft 365, Teams, Outlook, SharePoint e demais apps. O usuário precisará fazer login novamente.
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" style={{ flexShrink: 0 }} onClick={handleRevokeSessions}>
                  <LogOut size={13} /> Desconectar
                </button>
              </div>
            </div>

            {/* MFA methods */}
            <div className="card" style={{ background: '#13151f' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Métodos de autenticação (MFA)</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Remova métodos para forçar o usuário a reconfigurar o MFA.</div>
                </div>
                {mfaMethods && mfaMethods.length > 0 && (
                  <button className="btn btn-danger btn-sm" onClick={handleRevokeAllMfa}>
                    <ShieldOff size={13} /> Revogar todos
                  </button>
                )}
              </div>

              {loadingMfa ? (
                <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" /></div>
              ) : !mfaMethods ? null : mfaMethods.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: 13 }}>Nenhum método MFA configurado</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {mfaMethods.map(m => {
                    const label = MFA_TYPE_LABEL[m['@odata.type']] || m['@odata.type'];
                    const canDelete = !!MFA_TYPE_KEY[m['@odata.type']];
                    const detail = m.displayName || m.phoneNumber || m.emailAddress || m.device?.displayName || '';
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#0f1117', borderRadius: 6 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                          {detail && <div style={{ fontSize: 12, color: '#64748b' }}>{detail}</div>}
                        </div>
                        {canDelete && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteMfa(m)}>
                            <X size={12} /> Remover
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function UsersTab({ tenantId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState(null);
  const [showEdit, setShowEdit] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const { confirm, RiskModal } = useRiskAction();
  const [selected, setSelected] = useState(new Set());
  const [showBatch, setShowBatch] = useState(false);

  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(s => s.size === filtered.length ? new Set() : new Set(filtered.map(u => u.id)));
  const selectedUsers = users.filter(u => selected.has(u.id));

  const load = () => {
    setLoading(true);
    api.get(`/tenants/${tenantId}/users`)
      .then(r => setUsers(r.data))
      .catch(e => toast.error(e.response?.data?.error || 'Erro ao carregar usuários'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]);

  const filtered = users.filter(u =>
    u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    u.userPrincipalName?.toLowerCase().includes(search.toLowerCase()) ||
    u.department?.toLowerCase().includes(search.toLowerCase())
  );

  const handleBlock = async (user) => {
    const blocked = user.accountEnabled;
    if (blocked) {
      const { confirmed } = await confirm('BLOCK_USER', {
        targetName: user.displayName,
        details: { email: user.userPrincipalName },
      });
      if (!confirmed) return;
    }
    try {
      await api.patch(`/tenants/${tenantId}/users/${user.id}/block`, { blocked });
      toast.success(blocked ? 'Usuário bloqueado' : 'Usuário desbloqueado');
      setUsers(us => us.map(u => u.id === user.id ? { ...u, accountEnabled: !blocked } : u));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro');
    }
  };

  const handleReset = async () => {
    if (!newPassword) return;
    const { confirmed } = await confirm('RESET_PASSWORD', {
      targetName: showReset.displayName,
      details: { email: showReset.userPrincipalName },
    });
    if (!confirmed) return;
    try {
      await api.patch(`/tenants/${tenantId}/users/${showReset.id}/reset-password`, { password: newPassword });
      toast.success('Senha redefinida!');
      setShowReset(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao redefinir senha');
    }
  };

  const handleUserSaved = (updated) => {
    setUsers(us => us.map(u => u.id === updated.id ? { ...u, ...updated } : u));
    setShowEdit(null);
  };

  return (
    <div>
      {RiskModal}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-input" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} />
          <input placeholder="Buscar por nome, email ou departamento..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /></button>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}><UserPlus size={14} /> Novo Usuário</button>
        {selected.size > 0 && (
          <button className="btn btn-sm" onClick={() => setShowBatch(true)}
            style={{ background: '#7c3aed', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={14} /> Ações em lote ({selected.size})
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <button onClick={toggleAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: 0 }}>
                    {selected.size === filtered.length && filtered.length > 0
                      ? <CheckSquare size={16} color="#3b82f6" />
                      : <Square size={16} />}
                  </button>
                </th>
                <th>Nome</th>
                <th>Email</th>
                <th>Cargo / Depto</th>
                <th>Status</th>
                <th>Licenças</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ background: selected.has(u.id) ? '#1e3a5f22' : undefined }}>
                  <td>
                    <button onClick={() => toggleSelect(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: 0 }}>
                      {selected.has(u.id) ? <CheckSquare size={15} color="#3b82f6" /> : <Square size={15} />}
                    </button>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{u.displayName}</div>
                    {u.department && <div style={{ fontSize: 11, color: '#64748b' }}>{u.department}</div>}
                  </td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{u.userPrincipalName}</td>
                  <td style={{ fontSize: 13, color: '#94a3b8' }}>{u.jobTitle || '—'}</td>
                  <td>
                    {u.accountEnabled
                      ? <span className="badge badge-green">Ativo</span>
                      : <span className="badge badge-red">Bloqueado</span>}
                  </td>
                  <td style={{ fontSize: 13 }}>{u.assignedLicenses?.length || 0}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(u)} title="Editar usuário">
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleBlock(u)} title={u.accountEnabled ? 'Bloquear' : 'Desbloquear'}>
                        {u.accountEnabled ? <Lock size={13} /> : <Unlock size={13} />}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowReset(u)} title="Redefinir senha">
                        <Key size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit modal */}
      {showEdit && (
        <EditUserModal
          user={showEdit}
          tenantId={tenantId}
          onClose={() => setShowEdit(null)}
          onSaved={handleUserSaved}
        />
      )}

      {/* Batch panel */}
      {showBatch && selectedUsers.length > 0 && (
        <BatchPanel
          tenantId={tenantId}
          selectedUsers={selectedUsers}
          onClose={() => setShowBatch(false)}
          onDone={() => { setShowBatch(false); setSelected(new Set()); load(); }}
        />
      )}

      {/* Create wizard */}
      {showCreate && (
        <CreateUserWizard
          tenantId={tenantId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {/* Reset password modal */}
      {showReset && (
        <div className="modal-overlay" onClick={() => setShowReset(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Redefinir Senha</h2>
            <p style={{ color: '#94a3b8', marginBottom: 16, fontSize: 14 }}>{showReset.displayName}</p>
            <div className="form-group"><label>Nova senha</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoFocus /></div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setShowReset(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleReset}>Redefinir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
