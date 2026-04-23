import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, CheckCircle, XCircle, AlertCircle,
  ShieldOff, Package, AlertTriangle, RefreshCw, ChevronDown, ChevronRight,
  Activity, Lock
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { friendlyLicense } from '../utils/licenseNames';

// ─── helpers ────────────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function ScoreRing({ score, size = 64 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e2433" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px`, fill: color, fontSize: size * 0.22, fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>
        {score}
      </text>
    </svg>
  );
}

// ─── Alert row ───────────────────────────────────────────────────────────────
function AlertRow({ icon: Icon, color, label, count, items, renderItem, tenantId, navigate }) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  return (
    <div style={{ borderBottom: '1px solid #1e2433' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={14} color={color} />
        </div>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}22`, padding: '2px 8px', borderRadius: 10 }}>{count}</span>
        {open ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
      </div>
      {open && items && items.length > 0 && (
        <div style={{ padding: '0 14px 10px 52px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.slice(0, 8).map((item, i) => (
            <div key={i} style={{ fontSize: 12, color: '#94a3b8', padding: '3px 0' }}>
              {renderItem(item)}
            </div>
          ))}
          {items.length > 8 && (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', fontSize: 11 }}
              onClick={() => navigate(`/tenants/${tenantId}`)}>
              +{items.length - 8} mais → Ver instância
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tenant Health Card ───────────────────────────────────────────────────────
function TenantHealthCard({ tenant, navigate }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadHealth = useCallback(async () => {
    if (tenant.status !== 'connected') return;
    setLoading(true);
    try {
      const res = await api.get(`/tenants/${tenant.id}/health`);
      setHealth(res.data);
    } catch {
      setHealth({ error: true });
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  const s = health?.summary;
  const d = health?.details;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', cursor: 'pointer', borderBottom: expanded ? '1px solid #1e2433' : 'none' }}
        onClick={() => setExpanded(o => !o)}>

        {/* Score ring */}
        <div style={{ flexShrink: 0 }}>
          {loading ? <div className="spinner" /> :
            health?.error ? <AlertCircle size={40} color="#ef4444" /> :
              !health ? <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#1e2433' }} /> :
                <ScoreRing score={s.healthScore} />}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{tenant.name}</span>
            <StatusBadge status={tenant.status} />
          </div>
          {s && (
            <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}><Users size={11} style={{ display: 'inline', marginRight: 3 }} />{s.activeUsers} ativos</span>
              {s.blockedUsers > 0 && <span style={{ fontSize: 12, color: '#ef4444' }}><Lock size={11} style={{ display: 'inline', marginRight: 3 }} />{s.blockedUsers} bloqueados</span>}
              {s.noLicenseUsers > 0 && <span style={{ fontSize: 12, color: '#f59e0b' }}><Package size={11} style={{ display: 'inline', marginRight: 3 }} />{s.noLicenseUsers} sem licença</span>}
              {s.mfaDisabledUsers > 0 && <span style={{ fontSize: 12, color: '#ef4444' }}><ShieldOff size={11} style={{ display: 'inline', marginRight: 3 }} />{s.mfaDisabledUsers} sem MFA</span>}
              {s.licensesLow > 0 && <span style={{ fontSize: 12, color: '#f59e0b' }}><AlertTriangle size={11} style={{ display: 'inline', marginRight: 3 }} />{s.licensesLow} licença(s) acabando</span>}
            </div>
          )}
          {tenant.status !== 'connected' && (
            <span style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'block' }}>Conecte o tenant para ver a saúde</span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); loadHealth(); }} title="Atualizar">
            <RefreshCw size={13} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); navigate(`/tenants/${tenant.id}`); }}>
            Gerenciar
          </button>
          {expanded ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
        </div>
      </div>

      {/* Expanded alerts */}
      {expanded && health && !health.error && d && (
        <div>
          {s.noLicenseUsers === 0 && s.blockedUsers === 0 && s.mfaDisabledUsers === 0 && s.licensesLow === 0 && s.licensesExhausted === 0 ? (
            <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontSize: 13 }}>
              <CheckCircle size={16} /> Nenhum problema encontrado
            </div>
          ) : (
            <>
              <AlertRow icon={ShieldOff} color="#ef4444" label="Sem MFA configurado"
                count={s.mfaDisabledUsers} items={d.mfaDisabled}
                renderItem={u => `${u.displayName} — ${u.userPrincipalName}`}
                tenantId={tenant.id} navigate={navigate} />
              <AlertRow icon={Package} color="#f59e0b" label="Usuários sem licença"
                count={s.noLicenseUsers} items={d.noLicense}
                renderItem={u => `${u.displayName} — ${u.userPrincipalName}`}
                tenantId={tenant.id} navigate={navigate} />
              <AlertRow icon={Lock} color="#ef4444" label="Contas bloqueadas"
                count={s.blockedUsers} items={d.blocked}
                renderItem={u => `${u.displayName} — ${u.userPrincipalName}`}
                tenantId={tenant.id} navigate={navigate} />
              <AlertRow icon={AlertTriangle} color="#f59e0b" label="Licenças acabando (< 10% disponível)"
                count={s.licensesLow} items={d.licensesLow}
                renderItem={l => `${friendlyLicense(l.skuPartNumber)} — ${l.available} de ${l.total} disponíveis`}
                tenantId={tenant.id} navigate={navigate} />
              <AlertRow icon={XCircle} color="#ef4444" label="Licenças esgotadas"
                count={s.licensesExhausted} items={d.licensesExhausted}
                renderItem={l => `${friendlyLicense(l.skuPartNumber)} — ${l.used}/${l.total} usadas`}
                tenantId={tenant.id} navigate={navigate} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tenants').then(r => setTenants(r.data)).finally(() => setLoading(false));
  }, []);

  const connected = tenants.filter(t => t.status === 'connected').length;
  const disconnected = tenants.filter(t => t.status !== 'connected').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Bem-vindo, {user?.name}</p>
        </div>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total de Instâncias', value: tenants.length, icon: Building2, color: '#3b82f6' },
          { label: 'Conectadas', value: connected, icon: CheckCircle, color: '#10b981' },
          { label: 'Desconectadas', value: disconnected, icon: XCircle, color: '#ef4444' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, background: `${color}22`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>{loading ? '—' : value}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Health cards */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Activity size={16} color="#3b82f6" />
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Saúde dos Tenants</h2>
        <span style={{ fontSize: 12, color: '#64748b' }}>— Score de 0 a 100, alertas expandíveis</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : tenants.length === 0 ? (
        <div className="empty-state card"><Building2 size={40} /><p style={{ marginTop: 8 }}>Nenhuma instância cadastrada</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tenants.map(t => (
            <TenantHealthCard key={t.id} tenant={t} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }) {
  if (status === 'connected') return <span className="badge badge-green"><CheckCircle size={11} /> Conectado</span>;
  if (status === 'error') return <span className="badge badge-red"><AlertCircle size={11} /> Erro</span>;
  return <span className="badge badge-gray"><XCircle size={11} /> Desconectado</span>;
}
