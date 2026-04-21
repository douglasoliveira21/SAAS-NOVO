
import React, { useEffect, useState } from 'react';
import {
  Mail, Plus, RefreshCw, Search, Pencil, X, Trash2,
  UserPlus, ChevronDown, ChevronRight, Inbox, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

// ─── helpers ────────────────────────────────────────────────────────────────

// Heuristic: SharedMailbox = accountEnabled false + no licenses OR displayName hints
function detectMailboxType(u) {
  if (!u.accountEnabled && (!u.assignedLicenses || u.assignedLicenses.length === 0)) return 'SharedMailbox';
  return 'UserMailbox';
}

const PERM_LABELS = {
  FullAccess: 'Ler e Gerenciar (Acesso Total)',
  SendAs: 'Enviar Como',
  SendOnBehalf: 'Enviar em Nome de',
};

const PERM_BADGE = {
  FullAccess: 'badge-blue',
  SendAs: 'badge-green',
  SendOnBehalf: 'badge-yellow',
};

const MAILBOX_TYPE_BADGE = {
  UserMailbox: <span className="badge badge-blue" style={{ fontSize: 11 }}>UserMailbox</span>,
  SharedMailbox: <span className="badge badge-yellow" style={{ fontSize: 11 }}>SharedMailbox</span>,
};

// ─── Permissions panel ───────────────────────────────────────────────────────
function PermissionsPanel({ mailbox, tenantId, users, onClose }) {
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ delegateUpn: '', permissionType: 'FullAccess' });
  const [saving, setSaving] = useState(false);

  const loadPerms = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tenants/${tenantId}/mailboxes/${mailbox.id}/permissions`);
      setPermissions(res.data);
    } catch (err) {
      // Graph beta may not be available for all tenants — show friendly message
      setPermissions([]);
      if (err.response?.status !== 404) {
        toast.error(err.response?.data?.error || 'Erro ao carregar permissões');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPerms(); }, [mailbox.id]);

  const handleAdd = async () => {
    if (!addForm.delegateUpn) return toast.error('Selecione um usuário');
    setSaving(true);
    try {
      await api.post(`/tenants/${tenantId}/mailboxes/${mailbox.id}/permissions`, addForm);
      toast.success('Permissão adicionada!');
      setShowAdd(false);
      setAddForm({ delegateUpn: '', permissionType: 'FullAccess' });
      loadPerms();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao adicionar permissão');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (perm) => {
    if (!window.confirm('Remover esta permissão?')) return;
    try {
      await api.delete(
        `/tenants/${tenantId}/mailboxes/${mailbox.id}/permissions/${perm.id}`,
        { params: { permissionType: perm.permissionType, delegateId: perm.delegateId } }
      );
      toast.success('Permissão removida');
      loadPerms();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao remover');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Delegações de Caixa de Correio</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>{mailbox.displayName}</span>
              {MAILBOX_TYPE_BADGE[detectMailboxType(mailbox)]}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontFamily: 'monospace' }}>{mailbox.mail || mailbox.userPrincipalName}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Permission type legend */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {Object.entries(PERM_LABELS).map(([k, v]) => (
            <span key={k} className={`badge ${PERM_BADGE[k]}`} style={{ fontSize: 11 }}>{v}</span>
          ))}
        </div>

        {/* Add button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(s => !s)}>
            <UserPlus size={13} /> Adicionar delegação
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="card" style={{ marginBottom: 16, background: '#13151f' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Usuário delegado</label>
                <select value={addForm.delegateUpn} onChange={e => setAddForm(f => ({ ...f, delegateUpn: e.target.value }))}>
                  <option value="">— Selecione —</option>
                  {users.filter(u => u.id !== mailbox.id).map(u => (
                    <option key={u.id} value={u.userPrincipalName}>{u.displayName}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tipo de permissão</label>
                <select value={addForm.permissionType} onChange={e => setAddForm(f => ({ ...f, permissionType: e.target.value }))}>
                  <option value="FullAccess">Ler e Gerenciar (Acesso Total)</option>
                  <option value="SendAs">Enviar Como</option>
                  <option value="SendOnBehalf">Enviar em Nome de</option>
                </select>
              </div>
            </div>
            <div style={{ background: '#0f1117', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#64748b', marginBottom: 12 }}>
              {addForm.permissionType === 'FullAccess' && '🔑 Acesso Total: o usuário pode ler, mover e excluir emails da caixa de correio.'}
              {addForm.permissionType === 'SendAs' && '📤 Enviar Como: o usuário pode enviar emails como se fosse esta caixa de correio.'}
              {addForm.permissionType === 'SendOnBehalf' && '📨 Enviar em Nome de: o email aparece como "em nome de" esta caixa de correio.'}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving || !addForm.delegateUpn}>
                {saving ? <span className="spinner" /> : 'Adicionar'}
              </button>
            </div>
          </div>
        )}

        {/* Permissions list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>
        ) : !permissions || permissions.length === 0 ? (
          <div className="empty-state" style={{ padding: 30 }}>
            <Users size={32} />
            <p style={{ marginTop: 8, fontSize: 13 }}>Nenhuma delegação configurada</p>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Nota: delegações Exchange podem levar alguns minutos para aparecer após serem criadas.
            </p>
          </div>
        ) : (
          <div>
            {/* Group by permission type */}
            {['FullAccess', 'SendAs', 'SendOnBehalf'].map(type => {
              const group = permissions.filter(p => p.permissionType === type);
              if (group.length === 0) return null;
              return (
                <div key={type} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className={`badge ${PERM_BADGE[type]}`} style={{ fontSize: 12 }}>{PERM_LABELS[type]}</span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{group.length} usuário(s)</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {group.map(p => {
                      // Try to find the user in the users list for better display
                      const matchedUser = users.find(u =>
                        u.id === p.delegateId ||
                        u.userPrincipalName === p.userPrincipalName ||
                        u.userPrincipalName === p.displayName
                      );
                      const name = matchedUser?.displayName || p.displayName || p.userPrincipalName || p.delegateId || '—';
                      const upn = matchedUser?.userPrincipalName || p.userPrincipalName || '';
                      return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#0f1117', borderRadius: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 6, background: '#1e2433', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa' }}>
                                {name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{name}</div>
                              {upn && upn !== name && <div style={{ fontSize: 11, color: '#64748b' }}>{upn}</div>}
                            </div>
                          </div>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRemove(p)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Shared Mailbox Modal ─────────────────────────────────────────────
function CreateSharedMailboxModal({ tenantId, onClose, onCreated }) {
  const [form, setForm] = useState({ displayName: '', emailAddress: '', alias: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-fill alias from email
  const handleEmailChange = (v) => {
    set('emailAddress', v);
    if (!form.alias) set('alias', v.split('@')[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.displayName || !form.emailAddress) return;
    setSaving(true);
    try {
      await api.post(`/tenants/${tenantId}/mailboxes/shared`, form);
      toast.success('Caixa compartilhada criada! Pode levar alguns minutos para aparecer no Exchange.');
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar caixa compartilhada');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Nova Caixa Compartilhada</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ background: '#0f1117', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#64748b' }}>
          <Inbox size={12} style={{ display: 'inline', marginRight: 6 }} />
          Uma caixa compartilhada não requer licença e pode ser acessada por múltiplos usuários via delegação.
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome de exibição</label>
            <input required value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Suporte TI" />
          </div>
          <div className="form-group">
            <label>Endereço de email</label>
            <input required type="email" value={form.emailAddress} onChange={e => handleEmailChange(e.target.value)} placeholder="suporte@empresa.com" />
          </div>
          <div className="form-group">
            <label>Alias (mailNickname)</label>
            <input value={form.alias} onChange={e => set('alias', e.target.value)} placeholder="suporte" />
            <small style={{ color: '#64748b', fontSize: 12, marginTop: 4, display: 'block' }}>Preenchido automaticamente a partir do email.</small>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : 'Criar Caixa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main MailboxTab ─────────────────────────────────────────────────────────
export default function MailboxTab({ tenantId }) {
  const [mailboxes, setMailboxes] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | UserMailbox | SharedMailbox
  const [showCreate, setShowCreate] = useState(false);
  const [showPerms, setShowPerms] = useState(null); // mailbox object

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get(`/tenants/${tenantId}/mailboxes`),
      api.get(`/tenants/${tenantId}/users`),
    ]).then(([mr, ur]) => {
      setMailboxes(mr.data);
      setUsers(ur.data);
    }).catch(e => toast.error(e.response?.data?.error || 'Erro ao carregar caixas de correio'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]);

  const filtered = mailboxes.filter(m => {
    const type = detectMailboxType(m);
    const matchSearch =
      m.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      m.mail?.toLowerCase().includes(search.toLowerCase()) ||
      m.userPrincipalName?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || type === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    all: mailboxes.length,
    UserMailbox: mailboxes.filter(m => detectMailboxType(m) === 'UserMailbox').length,
    SharedMailbox: mailboxes.filter(m => detectMailboxType(m) === 'SharedMailbox').length,
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-input" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} />
          <input placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[['all', 'Todos'], ['UserMailbox', 'Usuário'], ['SharedMailbox', 'Compartilhada']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className="btn btn-sm"
              style={{
                background: filter === val ? '#3b82f6' : 'transparent',
                color: filter === val ? '#fff' : '#94a3b8',
                border: `1px solid ${filter === val ? '#3b82f6' : '#2d3748'}`,
              }}>
              {label} <span style={{ opacity: 0.7, marginLeft: 4 }}>({counts[val]})</span>
            </button>
          ))}
        </div>

        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /></button>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Nova Caixa Compartilhada
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 50 }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Mail size={40} />
            <p style={{ marginTop: 8 }}>Nenhuma caixa de correio encontrada</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Licenças</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const type = detectMailboxType(m);
                return (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: type === 'SharedMailbox' ? '#451a0322' : '#1e3a5f22',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {type === 'SharedMailbox'
                            ? <Inbox size={15} color="#fbbf24" />
                            : <Mail size={15} color="#60a5fa" />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{m.displayName}</div>
                          {m.mailNickname && <div style={{ fontSize: 11, color: '#64748b' }}>{m.mailNickname}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'monospace' }}>
                      {m.mail || m.userPrincipalName}
                    </td>
                    <td>{MAILBOX_TYPE_BADGE[type]}</td>
                    <td>
                      {m.accountEnabled
                        ? <span className="badge badge-green">Ativo</span>
                        : <span className="badge badge-gray">Desabilitado</span>}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {m.assignedLicenses?.length > 0
                        ? <span className="badge badge-blue">{m.assignedLicenses.length} licença(s)</span>
                        : <span style={{ color: '#64748b' }}>—</span>}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowPerms(m)} title="Gerenciar delegações">
                        <Users size={13} /> Delegações
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateSharedMailboxModal
          tenantId={tenantId}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}

      {showPerms && (
        <PermissionsPanel
          mailbox={showPerms}
          tenantId={tenantId}
          users={users}
          onClose={() => setShowPerms(null)}
        />
      )}
    </div>
  );
}
