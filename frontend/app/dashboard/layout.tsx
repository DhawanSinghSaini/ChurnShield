'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Shield, LayoutDashboard, Users, Terminal, HeartPulse, 
  LogOut, Sun, Moon, AlertTriangle, GitBranch
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useTheme } from '@/components/ThemeProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, user, business, isDemoMode, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [token, router]);

  if (!token) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading session...</p>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const navItems = [
    { label: 'Overview', path: '/dashboard/overview', icon: <LayoutDashboard size={18} /> },
    { label: 'Customers', path: '/dashboard/customers', icon: <Users size={18} /> },
    { label: 'Developer Console', path: '/dashboard/developer', icon: <Terminal size={18} /> },
    { label: 'Model Health', path: '/dashboard/model-health', icon: <HeartPulse size={18} /> },
    { label: 'System Workflow', path: '/dashboard/workflow', icon: <GitBranch size={18} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* ─── Persistent Demo Mode Banner ─── */}
      {isDemoMode && (
        <div className="demo-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <AlertTriangle size={14} />
          <span><strong>Demo Sandbox Mode</strong>: You are viewing simulated metrics for <strong>{business?.name}</strong>. Access will persist until logout.</span>
        </div>
      )}

      {/* ─── Dashboard Shell ─── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ─── Sidebar ─── */}
        <aside style={{
          width: '260px',
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px',
          flexShrink: 0
        }}>
          <div>
            {/* Logo */}
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
              <div style={{ background: 'var(--primary)', borderRadius: '8px', padding: '6px', display: 'flex' }}>
                <Shield size={18} color="#fff" />
              </div>
              <span style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.02em' }}>
                Churn<span className="gradient-text">Shield</span>
              </span>
            </Link>

            {/* Navigation links */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {navItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <Link 
                    key={item.path} 
                    href={item.path}
                    className="btn"
                    style={{
                      justifyContent: 'flex-start',
                      background: isActive ? 'var(--primary)' : 'transparent',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                      boxShadow: isActive ? '0 2px 10px var(--primary-glow)' : 'none',
                      fontWeight: isActive ? '600' : '500',
                      padding: '10px 14px'
                    }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '18px' }}>
            {/* User identity card */}
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{user?.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{user?.email}</span>
                <span className="badge badge-primary" style={{ fontSize: '9px', padding: '2px 6px' }}>{user?.role}</span>
              </div>
            </div>

            {/* Theme & Logout */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={toggleTheme} 
                className="btn btn-secondary btn-sm" 
                style={{ flex: 1, padding: '8px' }}
                title="Toggle Dark Mode"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button 
                onClick={handleLogout} 
                className="btn btn-danger btn-sm" 
                style={{ flex: 2, gap: '6px', padding: '8px' }}
              >
                <LogOut size={14} />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ─── Main Content Canvas ─── */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
          <div className="container-wide animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
