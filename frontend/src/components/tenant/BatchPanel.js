import React, { useState, useEffect } from "react";
import {
  X, Play, Plus, Trash2, ChevronDown, CheckCircle,
  XCircle, Loader, Key, Lock, Unlock, Package,
  UsersRound, LogOut, Briefcase, Building2, AlertTriangle
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../api/client";
import { friendlyLicense } from "../../utils/licenseNames";

// ─── Operation definitions ────────────────────────────────────────────────────
const OP_DEFS = [
  {
    group: "Conta",
    ops: [
      { type: "reset-password",  label: "Redefinir senha",          icon: Key,        color: "#f59e0b", risk: "medium",
        params: [{ key: "password", label: "Nova senha", type: "password", required: true, placeholder: "Senha temporária" }] },
      { type: "block",           label: "Bloquear conta",           icon: Lock,       color: "#ef4444", risk: "high",    params: [] },
      { type: "unblock",         label: "Desbloquear conta",        icon: Unlock,     color: "#10b981", risk: "low",     params: [] },
      { type: "revoke-sessions", label: "Revogar sessões ativas",   icon: LogOut,     color: "#ef4444", risk: "high",   params: [] },
    ],
  },
  {
    group: "Licenças",
    ops: [
      { type: "assign-license",  label: "Atribuir licença",         icon: Package,    color: "#3b82f6", risk: "medium",
        params: [{ key: "skuId", label: "Licença", type: "license-select", required: true }] },
      { type: "remove-license",  label: "Remover licença",          icon: Package,    color: "#ef4444", risk: "high",
        params: [{ key: "skuId", label: "Licença", type: "license-select", required: true }] },
    ],
  },
  {
    group: "Grupos",
    ops: [
      { type: "add-to-group",    label: "Adicionar ao grupo",       icon: UsersRound, color: "#10b981", risk: "medium",
        params: [{ key: "groupId", label: "Grupo", type: "group-select", required: true }] },
      { type: "remove-from-group", label: "Remover do grupo",       icon: UsersRound, color: "#ef4444", risk: "medium",
        params: [{ key: "groupId", label: "Grupo", type: "group-select", required: true }] },
    ],
  },
  {
    group: "Perfil",
    ops: [
      { type: "update-department", label: "Definir departamento",   icon: Building2,  color: "#8b5cf6", risk: "low",
        params: [{ key: "department", label: "Departamento", type: "text", required: true, placeholder: "ex: TI" }] },
      { type: "update-job-title",  label: "Definir cargo",          icon: Briefcase,  color: "#8b5cf6", risk: "low",
        params: [{ key: "jobTitle", label: "Cargo", type: "text", required: true, placeholder: "ex: Analista" }] },
    ],
  },
];

const RISK_COLOR = { low: "#10b981", medium: "#f59e0b", high: "#ef4444" };
const RISK_LABEL = { low: "Baixo", medium: "Médio", high: "Alto" };

// ─── Operation builder row ────────────────────────────────────────────────────
function OpRow({ op, onRemove, licenses, groups }) {
  const def = OP_DEFS.flatMap(g => g.ops).find(o => o.type === op.type);
  if (!def) return null;
  const Icon = def.icon;

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px",
      background: "#0f1117", borderRadius: 8, border: `1px solid ${def.color}33`,
    }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: `${def.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
        <Icon size={14} color={def.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: def.params.length ? 8 : 0 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{def.label}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: RISK_COLOR[def.risk], background: `${RISK_COLOR[def.risk]}22`, padding: "1px 6px", borderRadius: 8 }}>
            {RISK_LABEL[def.risk]}
          </span>
        </div>
        {def.params.map(p => (
          <div key={p.key} style={{ marginBottom: 4 }}>
            {p.type === "license-select" ? (
              <select value={op.params?.[p.key] || ""} onChange={e => op.onChange(p.key, e.target.value)} style={{ fontSize: 13 }}>
                <option value="">— Selecione a licença —</option>
                {licenses.map(l => (
                  <option key={l.skuId} value={l.skuId}>
                    {friendlyLicense(l.skuPartNumber)} ({(l.prepaidUnits?.enabled || 0) - l.consumedUnits} disponíveis)
                  </option>
                ))}
              </select>
            ) : p.type === "group-select" ? (
              <select value={op.params?.[p.key] || ""} onChange={e => op.onChange(p.key, e.target.value)} style={{ fontSize: 13 }}>
                <option value="">— Selecione o grupo —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.displayName}</option>)}
              </select>
            ) : (
              <input
                type={p.type} value={op.params?.[p.key] || ""}
                onChange={e => op.onChange(p.key, e.target.value)}
                placeholder={p.placeholder} style={{ fontSize: 13 }}
              />
            )}
          </div>
        ))}
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onRemove} style={{ flexShrink: 0 }}><Trash2 size={13} /></button>
    </div>
  );
}

// ─── Progress Modal ───────────────────────────────────────────────────────────
function ProgressModal({ results, summary, running, onClose, selectedUsers }) {
  const userMap = Object.fromEntries(selectedUsers.map(u => [u.id, u]));

  // Group results by userId
  const byUser = results.reduce((acc, r) => {
    if (!acc[r.userId]) acc[r.userId] = [];
    acc[r.userId].push(r);
    return acc;
  }, {});

  const OP_LABEL = Object.fromEntries(OP_DEFS.flatMap(g => g.ops).map(o => [o.type, o.label]));

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>
            {running ? "Executando operações em lote..." : "Resultado do lote"}
          </h2>
          {!running && <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>}
        </div>

        {/* Summary bar */}
        {summary && (
          <div style={{ display: "flex", gap: 12, marginBottom: 16, padding: "10px 14px", background: "#0f1117", borderRadius: 8 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.total}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Total</div>
            </div>
            <div style={{ width: 1, background: "#2d3748" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#10b981" }}>{summary.succeeded}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Sucesso</div>
            </div>
            <div style={{ width: 1, background: "#2d3748" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#ef4444" }}>{summary.failed}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Falhas</div>
            </div>
            {/* Progress bar */}
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <div style={{ width: "100%", height: 6, background: "#1e2433", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 3, transition: "width 0.3s",
                  width: `${summary.total > 0 ? (summary.succeeded / summary.total) * 100 : 0}%`,
                  background: summary.failed > 0 ? "#f59e0b" : "#10b981",
                }} />
              </div>
            </div>
          </div>
        )}

        {running && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, color: "#64748b", fontSize: 13 }}>
            <Loader size={14} style={{ animation: "spin 0.6s linear infinite" }} />
            Processando... não feche esta janela.
          </div>
        )}

        {/* Results by user */}
        <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(byUser).map(([userId, ops]) => {
            const user = userMap[userId];
            const allOk = ops.every(o => o.status === "success");
            const hasError = ops.some(o => o.status === "error");
            return (
              <div key={userId} style={{ background: "#0f1117", borderRadius: 8, overflow: "hidden", border: `1px solid ${hasError ? "#ef444433" : allOk ? "#10b98133" : "#2d3748"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid #1e2433" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: "#1e2433", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa" }}>{user?.displayName?.charAt(0) || "?"}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.displayName || userId}</div>
                    <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.userPrincipalName}</div>
                  </div>
                  {allOk && <CheckCircle size={16} color="#10b981" />}
                  {hasError && !allOk && <AlertTriangle size={16} color="#f59e0b" />}
                  {hasError && ops.every(o => o.status === "error") && <XCircle size={16} color="#ef4444" />}
                </div>
                {ops.map((op, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px 5px 50px", fontSize: 12 }}>
                    {op.status === "success" ? <CheckCircle size={12} color="#10b981" /> :
                     op.status === "error" ? <XCircle size={12} color="#ef4444" /> :
                     <Loader size={12} color="#64748b" style={{ animation: "spin 0.6s linear infinite" }} />}
                    <span style={{ color: op.status === "error" ? "#ef4444" : op.status === "success" ? "#94a3b8" : "#64748b" }}>
                      {OP_LABEL[op.operation] || op.operation}
                      {op.error && <span style={{ color: "#ef4444", marginLeft: 6 }}>— {op.error}</span>}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {!running && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn btn-primary" onClick={onClose}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main BatchPanel ──────────────────────────────────────────────────────────
export default function BatchPanel({ tenantId, selectedUsers, onClose, onDone }) {
  const [operations, setOperations] = useState([]);
  const [showOpPicker, setShowOpPicker] = useState(false);
  const [licenses, setLicenses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/tenants/${tenantId}/licenses`),
      api.get(`/tenants/${tenantId}/groups`),
    ]).then(([lr, gr]) => {
      setLicenses(lr.data);
      setGroups(gr.data);
    }).catch(() => {});
  }, [tenantId]);

  const addOp = (type) => {
    setOperations(ops => [...ops, { type, params: {}, id: Date.now() }]);
    setShowOpPicker(false);
  };

  const removeOp = (id) => setOperations(ops => ops.filter(o => o.id !== id));

  const updateOpParam = (id, key, value) => {
    setOperations(ops => ops.map(o => o.id === id ? { ...o, params: { ...o.params, [key]: value } } : o));
  };

  const canRun = () => {
    if (!operations.length) return false;
    return operations.every(op => {
      const def = OP_DEFS.flatMap(g => g.ops).find(o => o.type === op.type);
      return def?.params.filter(p => p.required).every(p => op.params[p.key]);
    });
  };

  const handleRun = async () => {
    if (!canRun()) return;
    setRunning(true);
    setResults([]);
    setSummary(null);
    setShowProgress(true);

    // Simulate streaming by running and updating
    const ops = operations.map(o => ({ type: o.type, params: o.params }));

    // Pre-populate pending results for live display
    const pending = selectedUsers.flatMap(u =>
      ops.map(op => ({ userId: u.id, operation: op.type, status: "pending", error: null }))
    );
    setResults(pending);
    setSummary({ total: pending.length, succeeded: 0, failed: 0 });

    try {
      const res = await api.post(`/tenants/${tenantId}/batch`, {
        userIds: selectedUsers.map(u => u.id),
        operations: ops,
      });
      setResults(res.data.results);
      setSummary(res.data.summary);
      if (res.data.summary.failed === 0) {
        toast.success(`Lote concluído: ${res.data.summary.succeeded} operações com sucesso!`);
      } else {
        toast(`Lote concluído: ${res.data.summary.succeeded} sucesso, ${res.data.summary.failed} falhas`, { icon: "⚠️" });
      }
      onDone?.();
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao executar lote");
      setShowProgress(false);
    } finally {
      setRunning(false);
    }
  };

  // Highest risk level among selected operations
  const maxRisk = operations.reduce((max, op) => {
    const def = OP_DEFS.flatMap(g => g.ops).find(o => o.type === op.type);
    const levels = { low: 0, medium: 1, high: 2 };
    return levels[def?.risk] > levels[max] ? def.risk : max;
  }, "low");

  return (
    <>
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 900,
        background: "#13151f", borderTop: "2px solid #3b82f6",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 24px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ background: "#3b82f6", color: "#fff", borderRadius: 8, padding: "4px 12px", fontWeight: 700, fontSize: 14 }}>
              {selectedUsers.length} usuário(s) selecionado(s)
            </div>
            <div style={{ flex: 1, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selectedUsers.slice(0, 6).map(u => (
                <span key={u.id} style={{ fontSize: 12, background: "#1e2433", borderRadius: 6, padding: "3px 8px", color: "#94a3b8", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.displayName}
                </span>
              ))}
              {selectedUsers.length > 6 && (
                <span style={{ fontSize: 12, color: "#64748b" }}>+{selectedUsers.length - 6} mais</span>
              )}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
          </div>

          {/* Operations */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Op list */}
            <div style={{ flex: 1, minWidth: 300, display: "flex", flexDirection: "column", gap: 6 }}>
              {operations.length === 0 && (
                <div style={{ fontSize: 13, color: "#64748b", padding: "8px 0" }}>
                  Adicione operações para executar em todos os usuários selecionados.
                </div>
              )}
              {operations.map(op => {
                const def = OP_DEFS.flatMap(g => g.ops).find(o => o.type === op.type);
                return (
                  <OpRow
                    key={op.id}
                    op={{ ...op, onChange: (k, v) => updateOpParam(op.id, k, v) }}
                    onRemove={() => removeOp(op.id)}
                    licenses={licenses}
                    groups={groups}
                  />
                );
              })}

              {/* Add operation button */}
              <div style={{ position: "relative" }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowOpPicker(s => !s)}>
                  <Plus size={14} /> Adicionar operação
                </button>

                {showOpPicker && (
                  <div style={{
                    position: "absolute", bottom: "calc(100% + 6px)", left: 0,
                    background: "#1a1d27", border: "1px solid #2d3748", borderRadius: 10,
                    boxShadow: "0 -8px 24px rgba(0,0,0,0.4)", zIndex: 100, minWidth: 280, padding: 8,
                  }}>
                    {OP_DEFS.map(group => (
                      <div key={group.group}>
                        <div style={{ fontSize: 11, color: "#64748b", padding: "4px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{group.group}</div>
                        {group.ops.map(op => {
                          const Icon = op.icon;
                          return (
                            <button key={op.type} onClick={() => addOp(op.type)}
                              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", background: "none", border: "none", cursor: "pointer", borderRadius: 6, color: "#e2e8f0", fontSize: 13, textAlign: "left" }}
                              onMouseEnter={e => e.currentTarget.style.background = "#1e2433"}
                              onMouseLeave={e => e.currentTarget.style.background = "none"}>
                              <Icon size={14} color={op.color} />
                              <span style={{ flex: 1 }}>{op.label}</span>
                              <span style={{ fontSize: 10, color: RISK_COLOR[op.risk] }}>{RISK_LABEL[op.risk]}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Run button */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", flexShrink: 0 }}>
              {operations.length > 0 && (
                <div style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}>
                  {operations.length} operação(ões) × {selectedUsers.length} usuário(s)<br />
                  = <strong style={{ color: "#e2e8f0" }}>{operations.length * selectedUsers.length}</strong> execuções
                </div>
              )}
              {maxRisk !== "low" && operations.length > 0 && (
                <div style={{ fontSize: 11, color: RISK_COLOR[maxRisk], display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={11} /> Contém operações de risco {RISK_LABEL[maxRisk].toLowerCase()}
                </div>
              )}
              <button
                onClick={handleRun}
                disabled={!canRun() || running}
                style={{
                  background: canRun() ? "#3b82f6" : "#2d3748",
                  color: "#fff", border: "none", borderRadius: 8,
                  padding: "10px 24px", fontWeight: 700, cursor: canRun() ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", gap: 8, fontSize: 14,
                  opacity: canRun() ? 1 : 0.5,
                }}>
                {running ? <><Loader size={16} style={{ animation: "spin 0.6s linear infinite" }} /> Executando...</> : <><Play size={16} /> Executar lote</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showProgress && (
        <ProgressModal
          results={results}
          summary={summary}
          running={running}
          selectedUsers={selectedUsers}
          onClose={() => { setShowProgress(false); if (!running) onClose(); }}
        />
      )}
    </>
  );
}
