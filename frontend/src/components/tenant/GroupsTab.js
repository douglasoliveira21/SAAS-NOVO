import React, { useEffect, useState } from 'react';
import { Plus, UserPlus, UserMinus, RefreshCw, ChevronDown, ChevronRight, Shield, Pencil, Zap, Users, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

const ROLE_BADGE = {
  owner: <span className="badge badge-blue" style={{ fontSize: 11 }}>Proprietário</span>,
  member: <span className="badge badge-gray" style={{ fontSize: 11 }}>Membro</span>,
};

// ─── Group type detection ─────────────────────────────────────────────────────
function getGroupType(g) {
  const isDynamic = g.membershipRule || g.membershipRuleProcessingState === 'On';
  const isM365 = g.groupTypes?.includes('Unified');
  const isDynamicType = g.groupTypes?.includes('DynamicMembership');

  if (isDynamic || isDynamicType) return 'dynamic';
  if (isM365) return 'm365';
  return 'security';
}

const GROUP_TYPE_CONFIG = {
  m365: {
    label: 'Microsoft 365',
    badge: <span className="badge badge-blue" style={{ fontSize: 11 }}>Microsoft 365</span>,
    icon: Mail,
    color: '#3b82f6',
    desc: 'Grupo com email, Teams, SharePoint e Planner',
  },
  security: {
    label: 'Segurança',
    badge: <span className="badge badge-gray" style={{ fontSize: 11 }}>Segurança</span>,
    icon: Shield,
    color: '#64748b',
    desc: 'Grupo para controle de acesso a recursos',
  },
  dynamic: {
    label: 'Dinâmico',
    badge: <span className="badge badge-yellow" style={{ fontSize: 11 }}>Dinâmico</span>,
    icon: Zap,
    color: '#f59e0b',
    desc: 'Membros adicionados automaticamente por regra',
  },
};

export default function GroupsTab({ tenantId }) {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | m365 | security | dynamic
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [members, setMembers] = useState({});   // { groupId: [{...user, role}] }
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMember, setShowAddMember] = useState(null);
  const [addMemberForm, setAddMemberForm] = useState({ userId: '', role: 'member' });
  const [showEditRole, setShowEditRole] = useState(null); // { groupId, user }
  const [editRole, setEditRole] = useState('member');
  const [form, setForm] = useState({ displayName: '', description: '', type: 'security' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get(`/tenants/${tenantId}/groups`),
      api.get(`/tenants/${tenantId}/users`),
    ]).then(([gr, ur]) => {
      setGroups(gr.data);
      setUsers(ur.data);
    }).catch(e => toast.error(e.response?.data?.error || 'Erro')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]);

  const loadMembers = async (groupId) => {
    try {
      const [membersRes, ownersRes] = await Promise.all([
        api.get(`/tenants/${tenantId}/groups/${groupId}/members`),
        api.get(`/tenants/${tenantId}/groups/${groupId}/owners`),
      ]);
      const ownerIds = new Set(ownersRes.data.map(o => o.id));
      const combined = membersRes.data.map(m => ({ ...m, role: ownerIds.has(m.id) ? 'owner' : 'member' }));
      // Add owners not in members list
      ownersRes.data.forEach(o => {
        if (!combined.find(m => m.id === o.id)) combined.push({ ...o, role: 'owner' });
      });
      setMembers(m => ({ ...m, [groupId]: combined }));
    } catch (err) {
      toast.error('Erro ao carregar membros');
    }
  };

  const toggleExpand = (groupId) => {
    if (expanded === groupId) { setExpanded(null); return; }
    setExpanded(groupId);
    setMembers(m => ({ ...m, [groupId]: undefined }));
    loadMembers(groupId);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    const isM365 = form.type === 'm365';
    try {
      await api.post(`/tenants/${tenantId}/groups`, {
        displayName: form.displayName,
        description: form.description,
        mailEnabled: isM365,
        securityEnabled: !isM365,
        groupTypes: isM365 ? ['Unified'] : [],
        mailNickname: form.displayName.replace(/\s+/g, '').toLowerCase(),
      });
      toast.success('Grupo criado!');
      setShowCreate(false);
      setForm({ displayName: '', description: '', type: 'security' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar grupo');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!addMemberForm.userId) return;
    setSaving(true);
    try {
      await api.post(`/tenants/${tenantId}/groups/${showAddMember}/members`, addMemberForm);
      toast.success(`Membro adicionado como ${addMemberForm.role === 'owner' ? 'Proprietário' : 'Membro'}!`);
      setMembers(m => ({ ...m, [showAddMember]: undefined }));
      loadMembers(showAddMember);
      setShowAddMember(null);
      setAddMemberForm({ userId: '', role: 'member' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (groupId, userId) => {
    try {
      await api.delete(`/tenants/${tenantId}/groups/${groupId}/members/${userId}`);
      toast.success('Membro removido');
      setMembers(m => ({ ...m, [groupId]: m[groupId]?.filter(u => u.id !== userId) }));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro');
    }
  };

  const handleEditRole = async () => {
    if (!showEditRole) return;
    setSaving(true);
    try {
      await api.patch(`/tenants/${tenantId}/groups/${showEditRole.groupId}/members/${showEditRole.user.id}/role`, { role: editRole });
      toast.success('Permissão atualizada!');
      setMembers(m => ({
        ...m,
        [showEditRole.groupId]: m[showEditRole.groupId]?.map(u =>
          u.id === showEditRole.user.id ? { ...u, role: editRole } : u
        ),
      }));
      setShowEditRole(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar permissão');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            ['all', 'Todos', groups.length],
            ['m365', 'Microsoft 365', groups.filter(g => getGroupType(g) === 'm365').length],
            ['security', 'Segurança', groups.filter(g => getGroupType(g) === 'security').length],
            ['dynamic', 'Dinâmico', groups.filter(g => getGroupType(g) === 'dynamic').length],
          ].map(([val, label, count]) => (
            <button key={val} onClick={() => setFilter(val)} className="btn btn-sm"
              style={{
                background: filter === val ? '#3b82f6' : 'transparent',
                color: filter === val ? '#fff' : '#94a3b8',
                border: `1px solid ${filter === val ? '#3b82f6' : '#2d3748'}`,
              }}>
              {label} <span style={{ opacity: 0.7, marginLeft: 4 }}>({count})</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Buscar grupo..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ fontSize: 13, padding: '6px 10px', width: 180 }} />
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /></button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Novo Grupo</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
        ) : groups.length === 0 ? (
          <div className="empty-state"><p>Nenhum grupo encontrado</p></div>
        ) : (() => {
          const filtered = groups.filter(g => {
            const type = getGroupType(g);
            const matchFilter = filter === 'all' || type === filter;
            const matchSearch = !search || g.displayName?.toLowerCase().includes(search.toLowerCase()) || g.description?.toLowerCase().includes(search.toLowerCase());
            return matchFilter && matchSearch;
          });

          if (filtered.length === 0) return <div className="empty-state" style={{ padding: 30 }}><p>Nenhum grupo nesta categoria</p></div>;

          return filtered.map(g => {
            const type = getGroupType(g);
            const cfg = GROUP_TYPE_CONFIG[type];
            const TypeIcon = cfg.icon;

            return (
              <div key={g.id} style={{ borderBottom: '1px solid #1e2433' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer' }} onClick={() => toggleExpand(g.id)}>
                  {expanded === g.id ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}

                  {/* Type icon */}
                  <div style={{ width: 30, height: 30, borderRadius: 6, background: `${cfg.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 10px', flexShrink: 0 }}>
                    <TypeIcon size={14} color={cfg.color} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{g.displayName}</span>
                      {cfg.badge}
                      {type === 'dynamic' && g.membershipRule && (
                        <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={g.membershipRule}>
                          regra: {g.membershipRule.slice(0, 30)}{g.membershipRule.length > 30 ? '...' : ''}
                        </span>
                      )}
                    </div>
                    {g.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{g.description}</div>}
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    {type !== 'dynamic' && (
                      <button className="btn btn-ghost btn-sm" title="Adicionar membro"
                        onClick={e => { e.stopPropagation(); setShowAddMember(g.id); setAddMemberForm({ userId: '', role: 'member' }); }}>
                        <UserPlus size={13} />
                      </button>
                    )}
                    {type === 'dynamic' && (
                      <span style={{ fontSize: 11, color: '#f59e0b' }} title={cfg.desc}>⚡ Auto</span>
                    )}
                  </div>
                </div>

                {expanded === g.id && (
                  <div style={{ padding: '0 16px 12px 56px' }}>
                    {type === 'dynamic' && g.membershipRule && (
                      <div style={{ background: '#451a0322', border: '1px solid #f59e0b33', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12 }}>
                        <div style={{ color: '#f59e0b', fontWeight: 600, marginBottom: 4 }}>⚡ Regra de associação dinâmica</div>
                        <code style={{ color: '#94a3b8', wordBreak: 'break-all' }}>{g.membershipRule}</code>
                        <div style={{ color: '#64748b', marginTop: 4 }}>Membros são gerenciados automaticamente pelo Azure AD.</div>
                      </div>
                    )}
                    {!members[g.id] ? (
                      <div style={{ padding: 12 }}><div className="spinner" /></div>
                    ) : members[g.id].length === 0 ? (
                      <p style={{ color: '#64748b', fontSize: 13 }}>Nenhum membro</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {members[g.id].map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#0f1117', borderRadius: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{m.displayName}</span>
                                <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>{m.userPrincipalName}</span>
                              </div>
                              {ROLE_BADGE[m.role]}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {type !== 'dynamic' && (
                                <>
                                  <button className="btn btn-ghost btn-sm" title="Editar permissão"
                                    onClick={() => { setShowEditRole({ groupId: g.id, user: m }); setEditRole(m.role); }}>
                                    <Pencil size={12} />
                                  </button>
                                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(g.id, m.id)}>
                                    <UserMinus size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>

      {/* Create group modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Novo Grupo</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group"><label>Nome</label><input required value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} /></div>
              <div className="form-group"><label>Descrição</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="form-group">
                <label>Tipo</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="security">Segurança</option>
                  <option value="m365">Microsoft 365</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <span className="spinner" /> : 'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add member modal */}
      {showAddMember && (
        <div className="modal-overlay" onClick={() => setShowAddMember(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Adicionar Membro ao Grupo</h2>
            <div className="form-group">
              <label>Usuário</label>
              <select value={addMemberForm.userId} onChange={e => setAddMemberForm(f => ({ ...f, userId: e.target.value }))}>
                <option value="">— Selecione —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.displayName} ({u.userPrincipalName})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Permissão no grupo</label>
              <select value={addMemberForm.role} onChange={e => setAddMemberForm(f => ({ ...f, role: e.target.value }))}>
                <option value="member">Membro (leitura)</option>
                <option value="owner">Proprietário (edição/admin)</option>
              </select>
            </div>
            <div style={{ background: '#0f1117', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#64748b' }}>
              <Shield size={12} style={{ display: 'inline', marginRight: 6 }} />
              {addMemberForm.role === 'owner'
                ? 'Proprietário pode gerenciar o grupo, adicionar/remover membros e editar conteúdo.'
                : 'Membro tem acesso de leitura ao conteúdo do grupo.'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowAddMember(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAddMember} disabled={!addMemberForm.userId || saving}>
                {saving ? <span className="spinner" /> : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit role modal */}
      {showEditRole && (
        <div className="modal-overlay" onClick={() => setShowEditRole(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Editar Permissão</h2>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>{showEditRole.user.displayName}</p>
            <div className="form-group">
              <label>Permissão no grupo</label>
              <select value={editRole} onChange={e => setEditRole(e.target.value)}>
                <option value="member">Membro (leitura)</option>
                <option value="owner">Proprietário (edição/admin)</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setShowEditRole(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleEditRole} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
