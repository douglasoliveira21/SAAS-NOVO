import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Building2, Users, ClipboardList,
  LogOut, Menu, X
} from 'lucide-react';
import GlobalSearch from './GlobalSearch';

// Hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  // Close sidebar on route change in mobile
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  // On resize: auto open on desktop, close on mobile
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { to: '/tenants', icon: Building2, label: 'Instâncias' },
    ...(isAdmin ? [
      { to: '/users', icon: Users, label: 'Usuários do Sistema' },
      { to: '/audit', icon: ClipboardList, label: 'Auditoria' },
    ] : []),
  ];

  const sidebarWidth = isMobile ? 260 : (sidebarOpen ? 240 : 64);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 40, backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: sidebarWidth,
        background: '#13151f',
        borderRight: '1px solid #2d3748',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s, transform 0.25s',
        flexShrink: 0, overflow: 'hidden',
        // Mobile: fixed drawer
        ...(isMobile ? {
          position: 'fixed', top: 0, left: 0, height: '100vh',
          zIndex: 50,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          width: 260,
        } : {}),
      }}>
        {/* Logo */}
        <div style={{
          padding: '14px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', borderBottom: '1px solid #2d3748', minHeight: 72,
        }}>
          {(sidebarOpen || isMobile) ? (
            <img src="/logo.png" alt="M365 Manager" style={{ height: 52, objectFit: 'contain', maxWidth: 180 }} />
          ) : (
            <img src="/logo.png" alt="M365 Manager" style={{ height: 36, width: 36, objectFit: 'contain' }} />
          )}
          {isMobile && (
            <button onClick={() => setSidebarOpen(false)} className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>
              <X size={18} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink key={to} to={to} end={exact} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
              borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 500,
              color: isActive ? '#3b82f6' : '#94a3b8',
              background: isActive ? '#1e3a5f22' : 'transparent',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            })}>
              <Icon size={18} style={{ flexShrink: 0 }} />
              {(sidebarOpen || isMobile) && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid #2d3748' }}>
          {(sidebarOpen || isMobile) && (
            <div style={{ padding: '8px 12px', marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{user?.role === 'admin' ? 'Administrador' : 'Técnico'}</div>
            </div>
          )}
          <button onClick={handleLogout} className="btn btn-ghost" style={{ width: '100%', justifyContent: (sidebarOpen || isMobile) ? 'flex-start' : 'center' }}>
            <LogOut size={16} />
            {(sidebarOpen || isMobile) && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{
          height: 56, background: '#13151f', borderBottom: '1px solid #2d3748',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0,
        }}>
          <button onClick={() => setSidebarOpen(s => !s)} className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>
            <Menu size={18} />
          </button>
          <GlobalSearch />
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflow: 'auto', padding: isMobile ? 16 : 28 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
