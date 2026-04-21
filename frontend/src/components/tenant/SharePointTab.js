import React, { useEffect, useState, useCallback } from 'react';
import {
  FolderOpen, ChevronRight, RefreshCw, UserPlus, Shield, Pencil,
  Trash2, ChevronDown, Folder, File, Activity, List, Globe,
  Clock, User, Eye, X, AlertCircle, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

// ─── constants ───────────────────────────────────────────────────────────────
const ROLE_LABEL = { read: 'Leitura', write: 'Edição', owner: 'Controle Total' };
const ROLE_BADGE = { read: 'badge-blue', write: 'badge-green', owner: 'badge-yellow' };
const ROLE_DESC = {
  read: 'Pode visualizar e baixar arquivos',
  write: 'Pode criar, editar e excluir arquivos',
  owner: 'Controle total incluindo gerenciar permissões',
};

function RoleBadge({ roles }) {
  const role = roles?.[0] || 'read';
  return <span className={`badge ${ROLE_BADGE[role] || 'badge-gray'}`} style={{ fontSize: 11 }}>{ROLE_LABEL[role] || role}</span>;
}

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Permissions Panel ───────────────────────────────────────────────────────
function PermissionsPanel({ context, tenantId, users, onClose }) {
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ userId: '', role: 'read' });
  const [editPerm, setEditPerm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeView, setActiveView] = useState('list'); // list | byLevel

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (context.type === 'site') {
        res = await api.get(`/tenants/${tenantId}/sharepoint/sites/${context.siteId}/permissions`);
      } else {
        res = await api.get(`/tenants/${tenantId}/sharepoint/drives/${context.driveId}/items/${context.itemId}/permissions`);
      }
      setPermissions(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao carregar permissões');
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [context, tenantId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!addForm.userId) return;
    setSaving(true);
    try {
      if (context.type === 'site') {
        await api.post(`/tenants/${tenantId}/sharepoint/sites/${context.siteId}/members`, addForm);
      } else {
        await api.post(`/tenants/${tenantId}/sharepoint/drives/${context.driveId}/items/${context.itemId}/permissions`, addForm);
      }
      toast.success('Permissão adicionada!');
      setShowAdd(false);
      setAddForm({ userId: '', role: 'read' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao adicionar');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editPerm) return;
    setSaving(true);
    try {
      if (context.type === 'site') {
        await api.patch(`/tenants/${tenantId}/sharepoint/sites/${context.siteId}/permissions/${editPerm.id}`, { role: addForm.role });
      } else {
        await api.patch(`/tenants/${tenantId}/sharepoint/drives/${context.driveId}/items/${context.itemId}/permissions/${editPerm.id}`, { role: addForm.role });
      }
      toast.success('Permissão atualizada!');
      setEditPerm(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (permId) => {
    if (!window.confirm('Remover esta permissão?')) return;
    try {
      if (context.type === 'site') {
        await api.delete(`/tenants/${tenantId}/sharepoint/sites/${context.siteId}/permissions/${permId}`);
      } else {
        await api.delete(`/tenants/${tenantId}/sharepoint/drives/${context.driveId}/items/${context.itemId}/permissions/${permId}`);
      }
      toast.success('Permissão removida');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao remover');
    }
  };

  // Group by role level
  const byLevel = permissions ? ['owner', 'write', 'read'].reduce((acc, role) => {
    const items = permissions.filter(p => {
      const r = p.roles?.[0];
      return r === role;
    }).filter(p => p.grantedToV2?.user || p.grantedTo?.user || p.grantedToV2?.group || p.grantedTo?.group);
    if (items.length) acc[role] = items;
    return acc;
  }, {}) : {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Permissões</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              {context.type === 'site' ? 'Site SharePoint' : context.name}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[['list', 'Lista'], ['byLevel', 'Por Nível']].map(([v, l]) => (
            <button key={v} className="btn btn-sm" onClick={() => setActiveView(v)}
              style={{ background: activeView === v ? '#3b82f6' : 'transparent', color: activeView === v ? '#fff' : '#94a3b8', border: `1px solid ${activeView === v ? '#3b82f6' : '#2d3748'}` }}>
              {l}
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={load} style={{ marginLeft: 'auto' }}><RefreshCw size={13} /></button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(s => !s)}>
            <UserPlus size={13} /> Adicionar
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="card" style={{ marginBottom: 14, background: '#13151f' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Usuário</label>
                <select value={addForm.userId} onChange={e => setAddForm(f => ({ ...f, userId: e.target.value }))}>
                  <option value="">— Selecione —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Nível de acesso</label>
                <select value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="read">Leitura</option>
                  <option value="write">Edição</option>
                  <option value="owner">Controle Total</option>
                </select>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', background: '#0f1117', borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
              <Shield size={11} style={{ display: 'inline', marginRight: 4 }} />
              {ROLE_DESC[addForm.role]}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!addForm.userId || saving}>
                {saving ? <span className="spinner" /> : 'Adicionar'}
              </button>
            </div>
          </div>
        )}

        {/* Edit form */}
        {editPerm && (
          <div className="card" style={{ marginBottom: 14, background: '#13151f' }}>
            <p style={{ fontSize: 13, marginBottom: 10 }}>
              Editando: <strong>{(editPerm.grantedToV2?.user || editPerm.grantedTo?.user)?.displayName || 'Usuário'}</strong>
            </p>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>Novo nível de acesso</label>
              <select value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
                <option value="read">Leitura</option>
                <option value="write">Edição</option>
                <option value="owner">Controle Total</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditPerm(null)}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={handleEdit} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>
        ) : !permissions || permissions.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <Shield size={28} />
            <p style={{ marginTop: 8, fontSize: 13 }}>Nenhuma permissão específica configurada</p>
          </div>
        ) : activeView === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {permissions.filter(p => p.grantedToV2?.user || p.grantedTo?.user || p.grantedToV2?.group || p.grantedTo?.group).map(p => {
              const entity = p.grantedToV2?.user || p.grantedTo?.user || p.grantedToV2?.group || p.grantedTo?.group;
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#0f1117', borderRadius: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 6, background: '#1e2433', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>{entity?.displayName?.charAt(0)?.toUpperCase() || '?'}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entity?.displayName || entity?.email || '—'}</div>
                    {entity?.email && <div style={{ fontSize: 11, color: '#64748b' }}>{entity.email}</div>}
                  </div>
                  <RoleBadge roles={p.roles} />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditPerm(p); setAddForm(f => ({ ...f, role: p.roles?.[0] || 'read' })); }}><Pencil size={12} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // By level view
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(byLevel).map(([role, perms]) => (
              <div key={role}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <RoleBadge roles={[role]} />
                  <span style={{ fontSize: 12, color: '#64748b' }}>{perms.length} membro(s)</span>
                  <span style={{ fontSize: 11, color: '#475569', marginLeft: 4 }}>— {ROLE_DESC[role]}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 8 }}>
                  {perms.map(p => {
                    const entity = p.grantedToV2?.user || p.grantedTo?.user || p.grantedToV2?.group || p.grantedTo?.group;
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#0f1117', borderRadius: 6 }}>
                        <span style={{ fontSize: 13, flex: 1 }}>{entity?.displayName || entity?.email || '—'}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditPerm(p); setAddForm(f => ({ ...f, role: p.roles?.[0] || 'read' })); }}><Pencil size={11} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}><Trash2 size={11} /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Activity Log Panel ───────────────────────────────────────────────────────
function ActivityPanel({ context, tenantId, onClose }) {
  const [activities, setActivities] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        let res;
        if (context.type === 'drive') {
          res = await api.get(`/tenants/${tenantId}/sharepoint/drives/${context.driveId}/activities`);
        } else {
          res = await api.get(`/tenants/${tenantId}/sharepoint/drives/${context.driveId}/items/${context.itemId}/activities`);
        }
        setActivities(res.data);
      } catch {
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [context, tenantId]);

  const ACTION_LABEL = {
    create: { label: 'Criou', color: '#10b981' },
    edit: { label: 'Editou', color: '#3b82f6' },
    delete: { label: 'Excluiu', color: '#ef4444' },
    move: { label: 'Moveu', color: '#f59e0b' },
    rename: { label: 'Renomeou', color: '#8b5cf6' },
    share: { label: 'Compartilhou', color: '#06b6d4' },
    access: { label: 'Acessou', color: '#64748b' },
  };

  const getAction = (a) => {
    if (a.action?.create) return 'create';
    if (a.action?.edit) return 'edit';
    if (a.action?.delete) return 'delete';
    if (a.action?.move) return 'move';
    if (a.action?.rename) return 'rename';
    if (a.action?.share) return 'share';
    if (a.action?.access) return 'access';
    return 'access';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>Auditoria de Acesso</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{context.name}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
        ) : !activities || activities.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <Activity size={28} />
            <p style={{ marginTop: 8, fontSize: 13 }}>Nenhuma atividade registrada</p>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Requer permissão Files.Read.All no tenant</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
            {activities.map((a, i) => {
              const action = getAction(a);
              const info = ACTION_LABEL[action] || ACTION_LABEL.access;
              const actor = a.actor?.user;
              const item = a.driveItem;
              return (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: '#0f1117', borderRadius: 8 }}>
                  <div style={{ width: 6, borderRadius: 3, background: info.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: info.color }}>{info.label}</span>
                      {item && <span style={{ fontSize: 12, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{item.name}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                      {actor && <span style={{ fontSize: 11, color: '#64748b' }}><User size={10} style={{ display: 'inline', marginRight: 3 }} />{actor.displayName || actor.email}</span>}
                      {a.times?.recordedDateTime && <span style={{ fontSize: 11, color: '#475569' }}><Clock size={10} style={{ display: 'inline', marginRight: 3 }} />{formatDate(a.times.recordedDateTime)}</span>}
                    </div>
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

// ─── Site Detail Panel ────────────────────────────────────────────────────────
function SiteDetailPanel({ site, tenantId, onClose, onSelectDrive }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('libraries');

  useEffect(() => {
    api.get(`/tenants/${tenantId}/sharepoint/sites/${site.id}`)
      .then(r => setDetail(r.data))
      .catch(() => setDetail({ lists: [], subsites: [] }))
      .finally(() => setLoading(false));
  }, [site.id, tenantId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700 }}>{site.displayName}</h2>
            <a href={site.webUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}>{site.webUrl}</a>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="tabs" style={{ marginBottom: 16 }}>
          {[['libraries', 'Bibliotecas'], ['lists', 'Listas'], ['subsites', 'Subsites']].map(([v, l]) => (
            <button key={v} className={`tab ${tab === v ? 'active' : ''}`} onClick={() => setTab(v)}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>
        ) : tab === 'libraries' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(detail?.lists || []).filter(l => l.list?.template === 'documentLibrary').map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#0f1117', borderRadius: 8, cursor: 'pointer' }}
                onClick={() => { onClose(); onSelectDrive(l); }}>
                <FolderOpen size={16} color="#3b82f6" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{l.displayName}</div>
                  {l.description && <div style={{ fontSize: 12, color: '#64748b' }}>{l.description}</div>}
                </div>
                <span style={{ fontSize: 11, color: '#64748b' }}>{formatDate(l.createdDateTime)}</span>
                <ChevronRight size={14} color="#64748b" />
              </div>
            ))}
            {(detail?.lists || []).filter(l => l.list?.template === 'documentLibrary').length === 0 && (
              <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhuma biblioteca encontrada</p>
            )}
          </div>
        ) : tab === 'lists' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(detail?.lists || []).filter(l => l.list?.template !== 'documentLibrary').map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#0f1117', borderRadius: 8 }}>
                <List size={15} color="#94a3b8" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{l.displayName}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{l.list?.template}</div>
                </div>
                <a href={l.webUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><Globe size={12} /></a>
              </div>
            ))}
            {(detail?.lists || []).filter(l => l.list?.template !== 'documentLibrary').length === 0 && (
              <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhuma lista encontrada</p>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(detail?.subsites || []).map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#0f1117', borderRadius: 8 }}>
                <Globe size={15} color="#3b82f6" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{s.displayName}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{s.webUrl}</div>
                </div>
              </div>
            ))}
            {(detail?.subsites || []).length === 0 && (
              <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhum subsite encontrado</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main SharePointTab ───────────────────────────────────────────────────────
export default function SharePointTab({ tenantId }) {
  const [sites, setSites] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Navigation
  const [selectedSite, setSelectedSite] = useState(null);
  const [drives, setDrives] = useState([]);
  const [selectedDrive, setSelectedDrive] = useState(null);
  const [folderStack, setFolderStack] = useState([]);
  const [folderItems, setFolderItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Panels
  const [showPerms, setShowPerms] = useState(null);
  const [showActivity, setShowActivity] = useState(null);
  const [showSiteDetail, setShowSiteDetail] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get(`/tenants/${tenantId}/sharepoint/sites`),
      api.get(`/tenants/${tenantId}/users`),
    ]).then(([sr, ur]) => {
      setSites(sr.data);
      setUsers(ur.data);
    }).catch(e => toast.error(e.response?.data?.error || 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const selectSite = async (site) => {
    setSelectedSite(site);
    setSelectedDrive(null);
    setFolderStack([]);
    setFolderItems([]);
    try {
      const res = await api.get(`/tenants/${tenantId}/sharepoint/sites/${site.id}/drives`);
      setDrives(res.data);
    } catch { toast.error('Erro ao carregar bibliotecas'); }
  };

  const selectDrive = async (drive) => {
    setSelectedDrive(drive);
    setFolderStack([{ id: 'root', name: drive.name || drive.displayName }]);
    loadItems(drive.id, 'root');
  };

  const loadItems = async (driveId, itemId) => {
    setLoadingItems(true);
    try {
      const res = await api.get(`/tenants/${tenantId}/sharepoint/drives/${driveId}/items/${itemId}/children`);
      setFolderItems(res.data);
    } catch { toast.error('Erro ao carregar itens'); }
    finally { setLoadingItems(false); }
  };

  const navigateInto = (item) => {
    setFolderStack(s => [...s, { id: item.id, name: item.name }]);
    loadItems(selectedDrive.id, item.id);
  };

  const navigateTo = (idx) => {
    const newStack = folderStack.slice(0, idx + 1);
    setFolderStack(newStack);
    loadItems(selectedDrive.id, newStack[newStack.length - 1].id);
  };

  const filteredSites = sites.filter(s =>
    s.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    s.webUrl?.toLowerCase().includes(search.toLowerCase())
  );

  const currentFolderId = folderStack[folderStack.length - 1]?.id;

  return (
    <div>
      {/* Top toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div className="search-input" style={{ flex: 1, maxWidth: 300 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input placeholder="Buscar sites..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => { setLoading(true); api.get(`/tenants/${tenantId}/sharepoint/sites`).then(r => setSites(r.data)).finally(() => setLoading(false)); }}>
          <RefreshCw size={14} />
        </button>
        <span style={{ fontSize: 12, color: '#64748b' }}>{sites.length} site(s)</span>
        <span style={{ fontSize: 11, color: '#475569' }} title="Para ver todos os sites, adicione Sites.Read.All como permissão de aplicativo no Azure AD">
          ⓘ
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedDrive ? '260px 1fr' : selectedSite ? '1fr 1fr' : '1fr', gap: 16 }}>

        {/* ── Sites column ── */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sites</div>
          <div className="card" style={{ padding: 0, maxHeight: 600, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
            ) : filteredSites.length === 0 ? (
              <div className="empty-state"><FolderOpen size={28} /><p>Nenhum site</p></div>
            ) : filteredSites.map(s => (
              <div key={s.id} style={{
                borderBottom: '1px solid #1e2433',
                background: selectedSite?.id === s.id ? '#1e3a5f22' : 'transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', cursor: 'pointer' }}
                  onClick={() => selectSite(s)}>
                  <div style={{ width: 30, height: 30, borderRadius: 6, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 10 }}>
                    <Globe size={14} color="#60a5fa" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.displayName}</div>
                    <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.webUrl?.replace('https://', '')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-sm" title="Estrutura do site" onClick={e => { e.stopPropagation(); setShowSiteDetail(s); }}><Info size={12} /></button>
                    <button className="btn btn-ghost btn-sm" title="Permissões" onClick={e => { e.stopPropagation(); setShowPerms({ type: 'site', siteId: s.id, name: s.displayName }); }}><Shield size={12} /></button>
                    <button className="btn btn-ghost btn-sm" title="Auditoria" onClick={e => { e.stopPropagation(); setShowActivity({ type: 'site', siteId: s.id, name: s.displayName }); }}><Activity size={12} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Drives list */}
          {selectedSite && !selectedDrive && drives.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bibliotecas</div>
              <div className="card" style={{ padding: 0 }}>
                {drives.map(d => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #1e2433', cursor: 'pointer' }}
                    onClick={() => selectDrive(d)}>
                    <FolderOpen size={15} color="#f59e0b" style={{ marginRight: 10, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {d.driveType}
                        {d.quota?.used && ` · ${formatSize(d.quota.used)} usado`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button className="btn btn-ghost btn-sm" title="Auditoria da biblioteca" onClick={e => { e.stopPropagation(); setShowActivity({ type: 'drive', driveId: d.id, name: d.name }); }}><Activity size={12} /></button>
                      <ChevronRight size={13} color="#64748b" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── File browser ── */}
        {selectedSite && selectedDrive && (
          <div>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedDrive(null); setFolderStack([]); setFolderItems([]); }}>
                {selectedSite.displayName}
              </button>
              {folderStack.map((f, i) => (
                <React.Fragment key={f.id}>
                  <ChevronRight size={12} color="#64748b" />
                  <button className="btn btn-ghost btn-sm"
                    style={{ color: i === folderStack.length - 1 ? '#e2e8f0' : '#64748b' }}
                    onClick={() => navigateTo(i)}>
                    {f.name}
                  </button>
                </React.Fragment>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" title="Auditoria desta pasta"
                  onClick={() => setShowActivity({ type: 'item', driveId: selectedDrive.id, itemId: currentFolderId, name: folderStack[folderStack.length - 1]?.name })}>
                  <Activity size={13} /> Auditoria
                </button>
                <button className="btn btn-ghost btn-sm" title="Permissões desta pasta"
                  onClick={() => setShowPerms({ type: 'folder', driveId: selectedDrive.id, itemId: currentFolderId, name: folderStack[folderStack.length - 1]?.name })}>
                  <Shield size={13} /> Permissões
                </button>
              </div>
            </div>

            <div className="card" style={{ padding: 0, maxHeight: 560, overflowY: 'auto' }}>
              {loadingItems ? (
                <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
              ) : folderItems.length === 0 ? (
                <div className="empty-state" style={{ padding: 30 }}><Folder size={28} /><p style={{ marginTop: 8, fontSize: 13 }}>Pasta vazia</p></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Tamanho</th>
                      <th>Modificado</th>
                      <th>Por</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {folderItems.map(item => {
                      const isFolder = !!item.folder;
                      return (
                        <tr key={item.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {isFolder
                                ? <Folder size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
                                : <File size={15} color="#64748b" style={{ flexShrink: 0 }} />}
                              <span style={{ fontWeight: isFolder ? 500 : 400, fontSize: 13, cursor: isFolder ? 'pointer' : 'default', color: isFolder ? '#e2e8f0' : '#94a3b8' }}
                                onClick={() => isFolder && navigateInto(item)}>
                                {item.name}
                              </span>
                              {isFolder && item.folder?.childCount > 0 && (
                                <span style={{ fontSize: 10, color: '#64748b' }}>({item.folder.childCount})</span>
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{isFolder ? '—' : formatSize(item.size)}</td>
                          <td style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{formatDate(item.lastModifiedDateTime)}</td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{item.lastModifiedBy?.user?.displayName || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-ghost btn-sm" title="Permissões"
                                onClick={() => setShowPerms({ type: 'folder', driveId: selectedDrive.id, itemId: item.id, name: item.name })}>
                                <Shield size={12} />
                              </button>
                              <button className="btn btn-ghost btn-sm" title="Auditoria"
                                onClick={() => setShowActivity({ type: 'item', driveId: selectedDrive.id, itemId: item.id, name: item.name })}>
                                <Activity size={12} />
                              </button>
                              {isFolder && (
                                <button className="btn btn-ghost btn-sm" title="Abrir" onClick={() => navigateInto(item)}>
                                  <ChevronRight size={12} />
                                </button>
                              )}
                              {item.webUrl && (
                                <a href={item.webUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="Abrir no SharePoint">
                                  <Globe size={12} />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Panels */}
      {showPerms && (
        <PermissionsPanel
          context={showPerms}
          tenantId={tenantId}
          users={users}
          onClose={() => setShowPerms(null)}
        />
      )}
      {showActivity && (
        <ActivityPanel
          context={showActivity}
          tenantId={tenantId}
          onClose={() => setShowActivity(null)}
        />
      )}
      {showSiteDetail && (
        <SiteDetailPanel
          site={showSiteDetail}
          tenantId={tenantId}
          onClose={() => setShowSiteDetail(null)}
          onSelectDrive={(drive) => { selectSite(showSiteDetail); selectDrive(drive); }}
        />
      )}
    </div>
  );
}
