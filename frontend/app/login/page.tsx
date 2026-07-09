'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Eye, EyeOff, ArrowLeft, Zap } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import QuickViewModal from '@/components/QuickViewModal';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const { setAuth, token } = useAuthStore();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (token) router.push('/dashboard/overview');
  }, [token, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setAuth(data.access_token, data.user, data.business, false);
      router.push('/dashboard/overview');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: '24px', position: 'relative', overflow: 'hidden'
    }}>
      {/* Background gradient */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(ellipse at top, hsl(var(--hue), 75%, 60%, 0.07) 0%, transparent 60%)',
        pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        {/* Back to home */}
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px', transition: 'color var(--transition)' }}>
          <ArrowLeft size={16} /> Back to Home
        </Link>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
          <div style={{ background: 'var(--primary)', borderRadius: '10px', padding: '8px', display: 'flex' }}>
            <Shield size={22} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.03em' }}>ChurnShield</span>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          <h2 style={{ marginBottom: '6px' }}>Welcome back</h2>
          <p style={{ fontSize: '14px', marginBottom: '28px' }}>Sign in to your business dashboard</p>

          {error && (
            <div style={{
              background: 'var(--danger-bg)', border: '1px solid hsl(4, 86%, 80%)',
              borderRadius: '8px', padding: '12px 14px', marginBottom: '20px',
              fontSize: '14px', color: 'var(--danger)'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="streaming@flixstream.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', padding: '4px'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: '4px', padding: '13px' }}>
              {loading ? 'Signing In...' : 'Sign In to Dashboard'}
            </button>
          </form>

          <div style={{ position: 'relative', margin: '24px 0' }}>
            <hr />
            <span style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              background: 'var(--bg-surface)', padding: '0 12px',
              fontSize: '12px', color: 'var(--text-muted)'
            }}>or</span>
          </div>

          <button onClick={() => setShowModal(true)} className="btn btn-secondary" style={{ width: '100%' }}>
            <Zap size={16} color="var(--primary)" /> Try Quick View Demo
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '20px' }}>
          Demo Credentials: streaming@flixstream.com / password123
        </p>
      </div>

      {showModal && <QuickViewModal onClose={() => setShowModal(false)} />}
    </div>
  );
}