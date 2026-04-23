import React, { useState, useEffect } from "react";
import { X, User, Package, UsersRound, CheckCircle, ChevronRight, Eye, EyeOff, Loader, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/client";
import { friendlyLicense } from "../../utils/licenseNames";

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ steps, current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = s.icon;
        return (
          <React.Fragment key={i}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: done ? "#10b981" : active ? "#3b82f6" : "#1e2433",
                border: `2px solid ${done ? "#10b981" : active ? "#3b82f6" : "#2d3748"}`,
                transition: "all 0.2s",
              }}>
                {done ? <CheckCircle size={18} color="#fff" /> : <Icon size={16} color={active ? "#fff" : "#64748b"} />}
              </div>
              <span style={{ fontSize: 11, color: active ? "#e2e8f0" : done ? "#10b981" : "#64748b", whiteSpace: "nowrap" }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? "#10b981" : "#2d3748", margin: "0 8px", marginBottom: 18, transition: "background 0.2s" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

const STEPS = [
  { label: "Perfil",   icon: User },
  { label: "Licença",  icon: Package },
  { label: "Grupos",   icon: UsersRound },
  { label: "Resumo",   icon: CheckCircle },
];

// ─── Step 1: Profile ──────────────────────────────────────────────────────────
function StepProfile({ data, onChange, onNext }) {
  const [showPass, setShowPass] = useState(false);
  const set = (k, v) => onChange({ ...data, [k]: v });

  const handleNameChange = (k, v) => {
    const updated = { ...data, [k]: v };
    const autoDisplay = `${updated.givenName || ""} ${updated.surname || ""}`.trim();
    if (!data.displayName || data.displayName === `${data.givenName || ""} ${data.surname || ""}`.trim()) {
      updated.displayName = autoDisplay;
    }
    onChange(updated);
  };

  const valid = data.givenName && data.surname && data.userPrincipalName?.includes("@") && data.password?.length >= 8;

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>Informações do usuário</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-group">
          <label>Nome <span style={{ color: "#ef4444" }}>*</span></label>
          <input value={data.givenName || ""} onChange={e => handleNameChange("givenName", e.target.value)} placeholder="João" autoFocus />
        </div>
        <div className="form-group">
          <label>Sobrenome <span style={{ color: "#ef4444" }}>*</span></label>
          <input value={data.surname || ""} onChange={e => handleNameChange("surname", e.target.value)} placeholder="Silva" />
        </div>
      </div>
      <div className="form-group">
        <label>Nome para exibição</label>
        <input value={data.displayName || ""} onChange={e => set("displayName", e.target.value)} placeholder="João Silva" />
      </div>
      <div className="form-group">
        <label>Email / UPN <span style={{ color: "#ef4444" }}>*</span></label>
        <input value={data.userPrincipalName || ""} onChange={e => set("userPrincipalName", e.target.value)} placeholder="joao.silva@empresa.com" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-group">
          <label>Cargo</label>
          <input value={data.jobTitle || ""} onChange={e => set("jobTitle", e.target.value)} placeholder="Analista" />
        </div>
        <div className="form-group">
          <label>Departamento</label>
          <input value={data.department || ""} onChange={e => set("department", e.target.value)} placeholder="TI" />
        </div>
      </div>
      <div className="form-group">
        <label>Gestor direto</label>
        <select value={data.managerId || ""} onChange={e => set("managerId", e.target.value)}>
          <option value="">— Sem gestor definido —</option>
          {(data._users || []).map(u => (
            <option key={u.id} value={u.id}>{u.displayName} ({u.userPrincipalName})</option>
          ))}
        </select>
        <small style={{ color: "#64748b", fontSize: 11, marginTop: 4, display: "block" }}>
          Define quem é o superior hierárquico deste usuário no organograma.
        </small>
      </div>
      <div className="form-group">
        <label>Senha inicial <span style={{ color: "#ef4444" }}>*</span></label>
        <div style={{ position: "relative" }}>
          <input type={showPass ? "text" : "password"} value={data.password || ""} onChange={e => set("password", e.target.value)} placeholder="Mínimo 8 caracteres" style={{ paddingRight: 36 }} />
          <button type="button" onClick={() => setShowPass(s => !s)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <small style={{ color: "#64748b", fontSize: 11 }}>O usuário deverá alterar a senha no primeiro acesso.</small>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button className="btn btn-primary" onClick={onNext} disabled={!valid}>
          Próximo <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: License ──────────────────────────────────────────────────────────
function StepLicense({ data, onChange, onNext, onBack, licenses }) {
  const selected = data.skuId || null;
  const license = licenses.find(l => l.skuId === selected);
  const available = license ? (license.prepaidUnits?.enabled || 0) - license.consumedUnits : 0;

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#94a3b8" }}>Atribuir licença</h3>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Opcional — pode ser atribuída depois.</p>

      {/* No license option */}
      <div onClick={() => onChange({ ...data, skuId: null })}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 8,
          background: !selected ? "#1e3a5f22" : "#0f1117",
          border: `1px solid ${!selected ? "#3b82f6" : "#2d3748"}` }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${!selected ? "#3b82f6" : "#2d3748"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {!selected && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6" }} />}
        </div>
        <div>
          <div style={{ fontWeight: 500, fontSize: 14 }}>Sem licença por enquanto</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>O usuário será criado sem licença atribuída</div>
        </div>
      </div>

      {licenses.map(l => {
        const avail = (l.prepaidUnits?.enabled || 0) - l.consumedUnits;
        const isSelected = data.skuId === l.skuId;
        return (
          <div key={l.skuId} onClick={() => avail > 0 && onChange({ ...data, skuId: l.skuId })}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 8, cursor: avail > 0 ? "pointer" : "not-allowed", marginBottom: 8, opacity: avail <= 0 ? 0.5 : 1,
              background: isSelected ? "#1e3a5f22" : "#0f1117",
              border: `1px solid ${isSelected ? "#3b82f6" : "#2d3748"}` }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${isSelected ? "#3b82f6" : "#2d3748"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {isSelected && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#3b82f6" }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14 }}>{friendlyLicense(l.skuPartNumber)}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{l.skuPartNumber}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <span className={`badge ${avail > 0 ? "badge-green" : "badge-red"}`} style={{ fontSize: 11 }}>
                {avail > 0 ? `${avail} disponíveis` : "Esgotada"}
              </span>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{l.consumedUnits}/{l.prepaidUnits?.enabled} usadas</div>
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={onBack}>Voltar</button>
        <button className="btn btn-primary" onClick={onNext}>Próximo <ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

// ─── Step 3: Groups ───────────────────────────────────────────────────────────
function StepGroups({ data, onChange, onNext, onBack, groups }) {
  const selectedGroups = data.groups || [];

  const toggle = (group) => {
    const exists = selectedGroups.find(g => g.id === group.id);
    if (exists) {
      onChange({ ...data, groups: selectedGroups.filter(g => g.id !== group.id) });
    } else {
      onChange({ ...data, groups: [...selectedGroups, { id: group.id, displayName: group.displayName, role: "member" }] });
    }
  };

  const setRole = (groupId, role) => {
    onChange({ ...data, groups: selectedGroups.map(g => g.id === groupId ? { ...g, role } : g) });
  };

  const assignableGroups = groups.filter(g => !g.membershipRule && !g.groupTypes?.includes("DynamicMembership"));

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "#94a3b8" }}>Adicionar a grupos</h3>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Opcional — grupos dinâmicos são gerenciados automaticamente.</p>

      {assignableGroups.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: 13 }}>Nenhum grupo disponível</p>
      ) : (
        <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {assignableGroups.map(g => {
            const sel = selectedGroups.find(s => s.id === g.id);
            const isM365 = g.groupTypes?.includes("Unified");
            return (
              <div key={g.id} style={{ borderRadius: 8, border: `1px solid ${sel ? "#3b82f6" : "#2d3748"}`, overflow: "hidden" }}>
                <div onClick={() => toggle(g)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer", background: sel ? "#1e3a5f22" : "#0f1117" }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${sel ? "#3b82f6" : "#2d3748"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: sel ? "#3b82f6" : "transparent" }}>
                    {sel && <CheckCircle size={13} color="#fff" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{g.displayName}</div>
                    {g.description && <div style={{ fontSize: 11, color: "#64748b" }}>{g.description}</div>}
                  </div>
                  <span className={`badge ${isM365 ? "badge-blue" : "badge-gray"}`} style={{ fontSize: 10 }}>
                    {isM365 ? "M365" : "Segurança"}
                  </span>
                </div>
                {sel && (
                  <div style={{ padding: "8px 14px 10px 46px", background: "#13151f", borderTop: "1px solid #2d3748" }}>
                    <label style={{ fontSize: 12, color: "#64748b", marginBottom: 4, display: "block" }}>Permissão no grupo</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[["member", "Membro (leitura)"], ["owner", "Proprietário (admin)"]].map(([val, lbl]) => (
                        <button key={val} onClick={() => setRole(g.id, val)} className="btn btn-sm"
                          style={{ background: sel.role === val ? "#3b82f6" : "transparent", color: sel.role === val ? "#fff" : "#94a3b8", border: `1px solid ${sel.role === val ? "#3b82f6" : "#2d3748"}` }}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={onBack}>Voltar</button>
        <button className="btn btn-primary" onClick={onNext}>Próximo <ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

// ─── Step 4: Summary + Execute ────────────────────────────────────────────────
function StepSummary({ data, onBack, onConfirm, saving, licenses }) {
  const license = licenses.find(l => l.skuId === data.skuId);
  const [results, setResults] = useState(null);

  if (results) {
    const allOk = results.every(r => r.status === "success");
    return (
      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: allOk ? "#064e3b" : "#451a03", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          {allOk ? <CheckCircle size={28} color="#10b981" /> : <AlertCircle size={28} color="#f59e0b" />}
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: allOk ? "#10b981" : "#f59e0b" }}>
          {allOk ? "Usuário criado com sucesso!" : "Criado com alguns avisos"}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16, textAlign: "left" }}>
          {results.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#0f1117", borderRadius: 6 }}>
              {r.status === "success"
                ? <CheckCircle size={14} color="#10b981" />
                : <AlertCircle size={14} color="#f59e0b" />}
              <span style={{ fontSize: 13, color: r.status === "success" ? "#94a3b8" : "#fbbf24" }}>{r.label}</span>
              {r.error && <span style={{ fontSize: 11, color: "#ef4444", marginLeft: "auto" }}>{r.error}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#94a3b8" }}>Resumo — confirme antes de criar</h3>

      {/* Profile summary */}
      <div className="card" style={{ marginBottom: 12, background: "#13151f" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <User size={15} color="#3b82f6" />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Perfil</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13 }}>
          {[
            ["Nome", `${data.givenName} ${data.surname}`],
            ["Email", data.userPrincipalName],
            ["Cargo", data.jobTitle || "—"],
            ["Departamento", data.department || "—"],
            ["Gestor direto", (() => { const mgr = (data._users || []).find(u => u.id === data.managerId); return mgr ? mgr.displayName : "—"; })()],
            ["Localidade", "Brasil (BR)"],
            ["Senha", "Temporária (troca no 1º acesso)"],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ color: "#64748b", fontSize: 11 }}>{k}</div>
              <div style={{ color: "#e2e8f0", fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* License summary */}
      <div className="card" style={{ marginBottom: 12, background: "#13151f" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Package size={15} color="#3b82f6" />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Licença</span>
        </div>
        {license ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="badge badge-blue" style={{ fontSize: 12 }}>{friendlyLicense(license.skuPartNumber)}</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>Inclui: Email, OneDrive, Teams e apps Office</span>
          </div>
        ) : (
          <span style={{ fontSize: 13, color: "#64748b" }}>Nenhuma licença — atribuir depois</span>
        )}
      </div>

      {/* Groups summary */}
      <div className="card" style={{ marginBottom: 20, background: "#13151f" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <UsersRound size={15} color="#3b82f6" />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Grupos</span>
        </div>
        {data.groups?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {data.groups.map(g => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13 }}>{g.displayName}</span>
                <span className={`badge ${g.role === "owner" ? "badge-blue" : "badge-gray"}`} style={{ fontSize: 10 }}>
                  {g.role === "owner" ? "Proprietário" : "Membro"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: "#64748b" }}>Nenhum grupo selecionado</span>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button className="btn btn-ghost" onClick={onBack} disabled={saving}>Voltar</button>
        <button className="btn btn-success" onClick={() => onConfirm(setResults)} disabled={saving}
          style={{ background: "#10b981", color: "#fff", border: "none", borderRadius: 8, padding: "9px 24px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          {saving ? <><span className="spinner" /> Criando...</> : <><CheckCircle size={15} /> Criar Usuário</>}
        </button>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────
export default function CreateUserWizard({ tenantId, onClose, onCreated }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [licenses, setLicenses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [data, setData] = useState({
    givenName: "", surname: "", displayName: "", userPrincipalName: "",
    jobTitle: "", department: "", password: "", managerId: "",
    skuId: null, groups: [],
  });

  useEffect(() => {
    Promise.all([
      api.get(`/tenants/${tenantId}/licenses`),
      api.get(`/tenants/${tenantId}/groups`),
      api.get(`/tenants/${tenantId}/users`),
    ]).then(([lr, gr, ur]) => {
      setLicenses(lr.data);
      setGroups(gr.data);
      setUsers(ur.data);
    }).catch(() => {});
  }, [tenantId]);

  // Pass users list into data so StepProfile can access it
  const dataWithUsers = { ...data, _users: users };

  const handleConfirm = async (setResults) => {
    setSaving(true);
    const results = [];

    try {
      // Step 1: Create user
      const created = await api.post(`/tenants/${tenantId}/users`, {
        displayName: data.displayName || `${data.givenName} ${data.surname}`.trim(),
        givenName: data.givenName,
        surname: data.surname,
        userPrincipalName: data.userPrincipalName,
        jobTitle: data.jobTitle || undefined,
        department: data.department || undefined,
        accountEnabled: true,
        passwordProfile: { forceChangePasswordNextSignIn: true, password: data.password },
        mailNickname: data.userPrincipalName.split("@")[0],
        usageLocation: "BR",
      });
      results.push({ label: "Conta criada", status: "success" });
      const userId = created.data?.id;

      // Step 2: Assign license
      if (data.skuId && userId) {
        try {
          await api.post(`/tenants/${tenantId}/users/${userId}/licenses`, { skuId: data.skuId });
          const lic = licenses.find(l => l.skuId === data.skuId);
          results.push({ label: `Licença atribuída: ${friendlyLicense(lic?.skuPartNumber || data.skuId)}`, status: "success" });
        } catch (err) {
          results.push({ label: "Atribuir licença", status: "error", error: err.response?.data?.error || "Falhou" });
        }
      }

      // Step 3: Add to groups
      for (const g of (data.groups || [])) {
        try {
          await api.post(`/tenants/${tenantId}/groups/${g.id}/members`, { userId, role: g.role });
          results.push({ label: `Adicionado ao grupo: ${g.displayName} (${g.role === "owner" ? "Proprietário" : "Membro"})`, status: "success" });
        } catch (err) {
          results.push({ label: `Grupo: ${g.displayName}`, status: "error", error: err.response?.data?.error || "Falhou" });
        }
      }

      // Step 4: Set manager
      if (data.managerId && userId) {
        try {
          await api.put(`/tenants/${tenantId}/users/${userId}/manager`, { managerId: data.managerId });
          const mgr = users.find(u => u.id === data.managerId);
          results.push({ label: `Gestor definido: ${mgr?.displayName || data.managerId}`, status: "success" });
        } catch (err) {
          results.push({ label: "Definir gestor", status: "error", error: err.response?.data?.error || "Falhou" });
        }
      }

      setResults(results);
      onCreated?.();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Novo Usuário M365</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <StepBar steps={STEPS} current={step} />

        {step === 0 && <StepProfile data={dataWithUsers} onChange={d => setData({ ...d, _users: undefined })} onNext={() => setStep(1)} />}
        {step === 1 && <StepLicense data={data} onChange={setData} onNext={() => setStep(2)} onBack={() => setStep(0)} licenses={licenses} />}
        {step === 2 && <StepGroups data={data} onChange={setData} onNext={() => setStep(3)} onBack={() => setStep(1)} groups={groups} />}
        {step === 3 && <StepSummary data={data} onBack={() => setStep(2)} onConfirm={handleConfirm} saving={saving} licenses={licenses} />}
      </div>
    </div>
  );
}
