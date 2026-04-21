import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Loader, Clock, Eye, EyeOff, ShieldCheck, Users, Globe, BarChart3 } from 'lucide-react';

const FEATURES = [
  { icon: ShieldCheck, text: 'Gerenciamento seguro de múltiplos tenants' },
  { icon: Users,       text: 'Controle de usuários, grupos e licenças' },
  { icon: Globe,       text: 'Integração nativa com Microsoft 365' },
  { icon: BarChart3,   text: 'Dashboard de saúde e auditoria completa' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const expired = searchParams.get('expired');
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: '#0a0c14', fontFamily: 'Inter, sans-serif',
    }}>
      {/* ── Left panel ── */}
      <div className="login-left" style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 80px', background: 'linear-gradient(135deg, #0f1117 0%, #0d1526 100%)',
        borderRight: '1px solid #1e2433', position: 'relative', overflow: 'hidden',
      }}>
        {/* Background decoration */}
        <div style={{
          position: 'absolute', top: -120, right: -120,
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, #3b82f622 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -80,
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, #6366f111 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 56 }}>
          <img src="/logo.png" alt="M365 Manager" style={{ height: 100, objectFit: 'contain' }} />
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 38, fontWeight: 800, lineHeight: 1.15,
          color: '#f1f5f9', marginBottom: 16, letterSpacing: '-0.5px',
        }}>
          Gerencie todos os seus<br />
          <span style={{ background: 'linear-gradient(90deg, #3b82f6, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            tenants Microsoft 365
          </span><br />
          em um só lugar.
        </h1>
        <p style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.7, marginBottom: 48, maxWidth: 420 }}>
          Plataforma centralizada para administração de múltiplos clientes M365 —
          sem múltiplos logins, sem múltiplos navegadores.
        </p>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: '#1e2433', border: '1px solid #2d3748',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={16} color="#3b82f6" />
              </div>
              <span style={{ fontSize: 14, color: '#cbd5e1' }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Bottom badge */}
        <div style={{ marginTop: 56, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Sistema operacional · Todos os serviços ativos</span>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="login-right" style={{
        width: 480, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 56px',
        background: '#0f1117',
      }}>
        <div style={{ marginBottom: 40 }}>
          {/* Logo mobile only */}
          <div className="login-logo-mobile" style={{ display: 'none', marginBottom: 24 }}>
            <img src="/logo.png" alt="M365 Manager" style={{ height: 64, objectFit: 'contain' }} />
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
            Bem-vindo de volta
          </h2>
          <p style={{ fontSize: 14, color: '#94a3b8' }}>
            Faça login para acessar o painel de administração.
          </p>
        </div>

        {/* Expired session warning */}
        {expired && (
          <div style={{
            background: '#451a0322', border: '1px solid #f59e0b44',
            borderRadius: 10, padding: '12px 16px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Clock size={15} color="#f59e0b" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#fbbf24' }}>
              Sua sessão expirou após 1 hora. Faça login novamente.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94a3b8', marginBottom: 8 }}>
              Email
            </label>
            <input
              type="email"
              required
              autoFocus
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="seu@email.com"
              style={{
                width: '100%', background: '#13151f',
                border: '1px solid #2d3748', borderRadius: 10,
                padding: '12px 16px', fontSize: 14, color: '#f1f5f9',
                outline: 'none', transition: 'border-color 0.15s',
                fontFamily: 'Inter, sans-serif',
              }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = '#2d3748'}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94a3b8', marginBottom: 8 }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                style={{
                  width: '100%', background: '#13151f',
                  border: '1px solid #2d3748', borderRadius: 10,
                  padding: '12px 44px 12px 16px', fontSize: 14, color: '#f1f5f9',
                  outline: 'none', transition: 'border-color 0.15s',
                  fontFamily: 'Inter, sans-serif',
                }}
                onFocus={e => e.target.style.borderColor = '#3b82f6'}
                onBlur={e => e.target.style.borderColor = '#2d3748'}
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
                  display: 'flex', padding: 0,
                }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px 24px',
              background: loading ? '#1e2433' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
              border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 15, fontWeight: 600, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'opacity 0.15s', opacity: loading ? 0.7 : 1,
              boxShadow: loading ? 'none' : '0 4px 20px #3b82f640',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {loading ? (
              <><Loader size={16} style={{ animation: 'spin 0.6s linear infinite' }} /> Entrando...</>
            ) : (
              'Entrar na plataforma'
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #1e2433' }}>
          <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 1.6 }}>
            Acesso restrito a usuários autorizados.<br />
            Todas as ações são registradas em log de auditoria.
          </p>
        </div>
      </div>
    </div>
  );
}
