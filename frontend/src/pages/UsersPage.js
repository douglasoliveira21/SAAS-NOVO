import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'tecnico' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/users').then(r => setUsers(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', email: '', password: '', role: 'tecnico' }); setShowModal(true); };
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, email: u.email, password: '', role: u.role }); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const payload = { name: form.name, role: form.role };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${editing.id}`, payload);
        toast.success('Usuário atualizado!');
      } else {
        await api.post('/users', form);
        toast.success('Usuário criado!');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (u) => {
    await api.patch(`/users/${u.id}`, { active: !u.active });
    toast.success(u.active ? 'Usuário desativado' : 'Usuário ativado');
    load();
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Excluir ${u.name}?`)) return;
    await api.delete(`/users/${u.id}`);
    toast.success('Usuário excluído');
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Usuários do Sistema</h1>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Novo Usuário</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Perfil</th>
                <th>Status</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name} {u.id === me.id && <span className="badge badge-blue" style={{ fontSize: 10 }}>Você</span>}</td>
                  <td style={{ color: '#94a3b8', fontSize: 13 }}>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-blue' : 'badge-gray'}`}>
                      {u.role === 'admin' ? 'Admin' : 'Técnico'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.active ? 'badge-green' : 'badge-red'}`}>
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ color: '#64748b', fontSize: 13 }}>{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}><Pencil size={13} /></button>
                      {u.id !== me.id && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(u)} title={u.active ? 'Desativar' : 'Ativar'}>
                            {u.active ? <UserX size={13} /> : <UserCheck size={13} />}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u)}><Trash2 size={13} /></button>
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
            <h2 className="modal-title">{editing ? 'Editar Usuário' : 'Novo Usuário'}</h2>
            <form onSubmit={handleSave}>
              <div className="form-group"><label>Nome</label><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              {!editing && <div className="form-group"><label>Email</label><input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>}
              <div className="form-group">
                <label>Senha {editing && '(deixe em branco para manter)'}</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required={!editing} />
              </div>
              <div className="form-group">
                <label>Perfil</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="tecnico">Técnico</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <span className="spinner" /> : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
