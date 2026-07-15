'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Zap, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { DEMO_BUSINESSES } from '@/lib/constants';

interface Props {
  onClose: () => void;
}

export default function QuickViewModal({ onClose }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const handleLaunchDemo = async () => {
    if (selected === null) return;
    setLoading(true);
    setError('');
    const biz = DEMO_BUSINESSES[selected];

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: biz.email, password: biz.password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      setAuth(data.access_token, data.user, data.business, true);
      router.push('/dashboard/overview');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to launch demo. Make sure the backend is running.');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ background: 'var(--primary)', borderRadius: '8px', padding: '6px', display: 'flex' }}>
                <Zap size={18} color="#fff" />
              </div>
              <h2 style={{ fontSize: '20px', margin: 0 }}>Quick View Demo</h2>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
              Select a business to explore ChurnShield with real pre-seeded data. No sign-up needed.
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Business Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {DEMO_BUSINESSES.map((biz, i) => (
            <button
              key={biz.name}
              onClick={() => setSelected(i)}
              style={{
                background: selected === i ? 'hsl(var(--hue), 75%, 96%)' : 'var(--bg-elevated)',
                border: selected === i ? '2px solid var(--primary)' : '2px solid var(--border)',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                transition: 'all var(--transition)',
                width: '100%'
              }}
            >
              <span style={{ fontSize: '28px', lineHeight: 1 }}>{biz.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{biz.name}</strong>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '99px',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)'
                  }}>{biz.vertical}</span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{biz.description}</p>
              </div>
              {selected === i && <CheckCircle size={20} color="var(--primary)" style={{ flexShrink: 0 }} />}
            </button>
          ))}
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '12px', background: 'var(--danger-bg)', padding: '10px 14px', borderRadius: '8px' }}>
            {error}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          <button
            onClick={handleLaunchDemo}
            disabled={selected === null || loading}
            className="btn btn-primary"
            style={{ flex: 2 }}
          >
            {loading ? 'Launching...' : '🚀 Launch Demo Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
