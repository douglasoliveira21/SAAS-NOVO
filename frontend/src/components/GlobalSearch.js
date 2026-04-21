import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, UsersRound, Package, Building2, X, CheckCircle, XCircle, Loader } from 'lucide-react';
import api from '../api/client';

const LICENSE_NAMES = {
  ENTERPRISEPACK: 'M365 E3', ENTERPRISEPREMIUM: 'M365 E5',
  SPB: 'M365 Business Premium', O365_BUSINESS_ESSENTIALS: 'M365 Business Basic',
  EXCHANGESTANDARD: 'Exchange Online P1',
};
const friendlyLicense = s => LICENSE_NAMES[s] || s;

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const isMobile = window.innerWidth < 768;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef(null);
  const dropRef = useRef(null);
  const debouncedQuery = useDebounce(query, 350);

  // Flatten results for keyboard nav
  const flatItems = results.flatMap(r => [
    ...r.users.map(u => ({ type: 'user', tenantId: r.tenant.id, tenantName: r.tenant.name, ...u })),
    ...r.groups.map(g => ({ type: 'group', tenantId: r.tenant.id, tenantName: r.tenant.name, ...g })),
    ...r.licenses.map(l => ({ type: 'license', tenantId: r.tenant.id, tenantName: r.tenant.name, ...l })),
  ]);

  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    api.get(`/tenants/search/global?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => { setResults(r.data); setOpen(true); setActiveIdx(-1); })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!dropRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flatItems.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter' && activeIdx >= 0) { handleSelect(flatItems[activeIdx]); }
  };

  const handleSelect = (item) => {
    setOpen(false);
    setQuery('');
    navigate(`/tenants/${item.tenantId}`, { state: { highlight: item } });
  };

  const clear = () => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus(); };

  const totalCount = flatItems.length;

  return (
    <div style={{ position: 'relative', flex: 1, maxWidth: isMobile ? '100%' : 480 }}>
      {/* Input */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {loading
          ? <Loader size={15} color="#64748b" style={{ position: 'absolute', left: 12, animation: 'spin 0.6s linear infinite' }} />
          : <Search size={15} color="#64748b" style={{ position: 'absolute', left: 12 }} />}
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Busca global... (Ctrl+K)"
          style={{
            width: '100%', background: '#0f1117', border: '1px solid #2d3748',
            borderRadius: 8, padding: '8px 36px 8px 36px', fontSize: 14,
            color: '#e2e8f0', outline: 'none', transition: 'border-color 0.15s',
            borderColor: open ? '#3b82f6' : '#2d3748',
          }}
        />
        {query && (
          <button onClick={clear} style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div ref={dropRef} style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: '#1a1d27', border: '1px solid #2d3748', borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', zIndex: 9999,
          maxHeight: 520, overflowY: 'auto',
        }}>
          {results.length === 0 && !loading ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              Nenhum resultado para "{query}"
            </div>
          ) : (
            <>
              {/* Summary bar */}
              {totalCount > 0 && (
                <div style={{ padding: '8px 14px', borderBottom: '1px solid #1e2433', fontSize: 12, color: '#64748b', display: 'flex', gap: 12 }}>
                  <span>{totalCount} resultado(s)</span>
                  <span>em {results.length} tenant(s)</span>
                </div>
              )}

              {results.map((r, ri) => (
                <div key={r.tenant.id}>
                  {/* Tenant header */}
                  <div style={{ padding: '8px 14px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building2 size={12} color="#3b82f6" />
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {r.tenant.name}
                    </span>
                  </div>

                  {/* Users */}
                  {r.users.length > 0 && (
                    <div>
                      <div style={{ padding: '4px 14px', fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={11} /> Usuários
                      </div>
                      {r.users.map((u, ui) => {
                        const globalIdx = flatItems.findIndex(f => f.type === 'user' && f.id === u.id && f.tenantId === r.tenant.id);
                        return (
                          <div key={u.id}
                            onClick={() => handleSelect({ type: 'user', tenantId: r.tenant.id, tenantName: r.tenant.name, ...u })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                              cursor: 'pointer', background: activeIdx === globalIdx ? '#1e3a5f33' : 'transparent',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={() => setActiveIdx(globalIdx)}>
                            {/* Avatar */}
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: u.accountEnabled ? '#1e3a5f' : '#2d1515', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: u.accountEnabled ? '#60a5fa' : '#f87171' }}>
                                {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {u.displayName}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {u.userPrincipalName}
                                {u.jobTitle && ` · ${u.jobTitle}`}
                                {u.department && ` · ${u.department}`}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                              {u.accountEnabled
                                ? <span className="badge badge-green" style={{ fontSize: 10 }}><CheckCircle size={9} /> Ativo</span>
                                : <span className="badge badge-red" style={{ fontSize: 10 }}><XCircle size={9} /> Bloqueado</span>}
                              {u.assignedLicenses > 0
                                ? <span className="badge badge-blue" style={{ fontSize: 10 }}>{u.assignedLicenses} lic.</span>
                                : <span className="badge badge-yellow" style={{ fontSize: 10 }}>Sem licença</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Groups */}
                  {r.groups.length > 0 && (
                    <div>
                      <div style={{ padding: '4px 14px', fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <UsersRound size={11} /> Grupos
                      </div>
                      {r.groups.map((g) => {
                        const globalIdx = flatItems.findIndex(f => f.type === 'group' && f.id === g.id && f.tenantId === r.tenant.id);
                        return (
                          <div key={g.id}
                            onClick={() => handleSelect({ type: 'group', tenantId: r.tenant.id, tenantName: r.tenant.name, ...g })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                              cursor: 'pointer', background: activeIdx === globalIdx ? '#1e3a5f33' : 'transparent',
                            }}
                            onMouseEnter={() => setActiveIdx(globalIdx)}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#1e2433', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <UsersRound size={14} color="#94a3b8" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{g.displayName}</div>
                              {g.description && <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.description}</div>}
                            </div>
                            <span className={`badge ${g.isM365 ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: 10 }}>
                              {g.isM365 ? 'M365' : 'Segurança'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Licenses */}
                  {r.licenses.length > 0 && (
                    <div>
                      <div style={{ padding: '4px 14px', fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Package size={11} /> Licenças
                      </div>
                      {r.licenses.map((l) => {
                        const globalIdx = flatItems.findIndex(f => f.type === 'license' && f.skuId === l.skuId && f.tenantId === r.tenant.id);
                        const pct = l.total > 0 ? Math.round((l.used / l.total) * 100) : 0;
                        return (
                          <div key={l.skuId}
                            onClick={() => handleSelect({ type: 'license', tenantId: r.tenant.id, tenantName: r.tenant.name, ...l })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                              cursor: 'pointer', background: activeIdx === globalIdx ? '#1e3a5f33' : 'transparent',
                            }}
                            onMouseEnter={() => setActiveIdx(globalIdx)}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#1e2433', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Package size={14} color="#94a3b8" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{friendlyLicense(l.skuPartNumber)}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{l.used}/{l.total} usadas · {l.available} disponíveis</div>
                            </div>
                            {/* Usage bar */}
                            <div style={{ width: 60, flexShrink: 0 }}>
                              <div style={{ height: 4, background: '#1e2433', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981', borderRadius: 2 }} />
                              </div>
                              <div style={{ fontSize: 10, color: '#64748b', textAlign: 'right', marginTop: 2 }}>{pct}%</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {ri < results.length - 1 && <div style={{ height: 1, background: '#1e2433', margin: '4px 0' }} />}
                </div>
              ))}

              {/* Footer hint */}
              <div style={{ padding: '8px 14px', borderTop: '1px solid #1e2433', display: 'flex', gap: 12, fontSize: 11, color: '#475569' }}>
                <span>↑↓ navegar</span>
                <span>Enter selecionar</span>
                <span>Esc fechar</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
