'use client';
import { useState } from 'react';
import Link from 'next/link';
import { 
  Shield, Brain, Bell, Zap, BarChart3, Users, Code2, 
  ArrowRight, CheckCircle, Moon, Sun, ChevronRight,
  TrendingDown, Activity, Lock
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import QuickViewModal from '@/components/QuickViewModal';

const FEATURES = [
  {
    icon: <Brain size={24} />,
    title: 'ML-Powered Risk Scoring',
    description: 'RandomForest/XGBoost model scores every customer 0–100% nightly. SHAP TreeExplainer reveals the exact top 3 reasons why each score was given.'
  },
  {
    icon: <Activity size={24} />,
    title: 'What-If Simulation Sandbox',
    description: 'Drag sliders to hypothetically change a customer\'s behaviour metrics and instantly see how the ML model re-scores their churn risk in real-time.'
  },
  {
    icon: <Bell size={24} />,
    title: 'Automated Alert Interventions',
    description: 'When risk crosses 75%, ChurnShield auto-fires HMAC-signed webhooks and sends HTML email alerts to your success team — with zero manual effort.'
  },
  {
    icon: <BarChart3 size={24} />,
    title: 'MLOps Drift Monitoring',
    description: 'Real-time data drift detection compares feature distributions (last 7 days vs 30 days) and flags anomalies before model accuracy degrades.'
  },
  {
    icon: <Users size={24} />,
    title: 'Smart Customer Segments',
    description: 'Dynamic segments surface your highest-priority lists: VIP At-Risk accounts, customers who have gone silent, and negative feedback spikes.'
  },
  {
    icon: <Code2 size={24} />,
    title: 'Developer-First API',
    description: 'Integrate in 3 lines of code. HMAC-signed webhooks, a sandbox deliverability tester, and 7-day Redis ingestion analytics keep your pipeline observable.'
  }
];

const TECH_STACK = [
  { name: 'Next.js 16', role: 'Frontend Framework' },
  { name: 'Express.js', role: 'REST API Server' },
  { name: 'PostgreSQL', role: 'Primary Database' },
  { name: 'Redis', role: 'Queue & Cache' },
  { name: 'Python / scikit-learn', role: 'ML Pipeline' },
  { name: 'XGBoost + SHAP', role: 'Model & Explainability' },
  { name: 'Nodemailer', role: 'Email Alerts' },
  { name: 'node-cron', role: 'Nightly Scheduler' },
];

export default function LandingPage() {
  const [showModal, setShowModal] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* ─── Navbar ─── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'var(--primary)', borderRadius: '10px', padding: '6px 8px', display: 'flex' }}>
              <Shield size={20} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.03em' }}>
              Churn<span className="gradient-text">Shield</span>
            </span>
          </div>

          {/* Nav Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={toggleTheme} className="btn btn-ghost btn-sm" title="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link href="/login" className="btn btn-secondary btn-sm">Sign In</Link>
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
              <Zap size={15} /> Quick View
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section style={{ padding: '100px 0 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Background gradient orbs */}
        <div style={{
          position: 'absolute', top: '-100px', left: '50%', transform: 'translateX(-50%)',
          width: '800px', height: '500px',
          background: 'radial-gradient(ellipse, hsl(var(--hue), 75%, 60%, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div className="container">
          <div className="animate-fade-up" style={{ marginBottom: '20px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'hsl(var(--hue), 75%, 95%)', color: 'var(--primary)',
              border: '1px solid hsl(var(--hue), 75%, 85%)',
              padding: '6px 14px', borderRadius: '99px', fontSize: '13px', fontWeight: 600
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />
              AI-Powered Churn Intelligence Platform
            </span>
          </div>

          <h1 className="animate-fade-up delay-100" style={{ maxWidth: '800px', margin: '0 auto 24px' }}>
            Predict Customer Churn{' '}
            <span className="gradient-text">Before It Happens</span>
          </h1>

          <p className="animate-fade-up delay-200" style={{ maxWidth: '560px', margin: '0 auto 40px', fontSize: '18px', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
            ChurnShield monitors user behaviour in real-time, scores every customer using XGBoost ML, explains why with SHAP, and fires automated alerts — saving your MRR on autopilot.
          </p>

          <div className="animate-fade-up delay-300" style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-lg animate-pulse-glow">
              <Zap size={20} /> Try Live Demo — No Sign Up
            </button>
            <Link href="/login" className="btn btn-secondary btn-lg">
              Sign In to Dashboard <ArrowRight size={18} />
            </Link>
          </div>

          {/* Social proof pills */}
          <div className="animate-fade-up delay-400" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '40px', flexWrap: 'wrap' }}>
            {['3 Industry Verticals', '600 Seeded Customers', '11 Backend APIs', 'SHAP Explainability'].map(text => (
              <span key={text} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                <CheckCircle size={14} color="var(--success)" /> {text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Feature Cards ─── */}
      <section style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2>Everything You Need to Fight Churn</h2>
            <p style={{ maxWidth: '520px', margin: '12px auto 0', fontSize: '17px' }}>
              A full-stack ML platform built to production-grade standards — not a toy dashboard.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: 'hsl(var(--hue), 75%, 94%)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: 'var(--primary)'
                }}>
                  {f.icon}
                </div>
                <div>
                  <h4 style={{ marginBottom: '6px' }}>{f.title}</h4>
                  <p style={{ fontSize: '14px', lineHeight: '1.65' }}>{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it Works ─── */}
      <section style={{ padding: '80px 0', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2>How ChurnShield Works</h2>
            <p style={{ maxWidth: '480px', margin: '12px auto 0', fontSize: '17px' }}>
              From a user click to a dashboard insight in under 50ms.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0' }}>
            {[
              { step: '01', icon: <Zap size={20} />, title: 'Event Ingested', desc: 'Client app fires POST /v1/track. API key validated via Redis in <1ms. Event queued.' },
              { step: '02', icon: <Activity size={20} />, title: 'Batch Written', desc: 'Node.js worker drains Redis queue every 10s, bulk-inserting into PostgreSQL.' },
              { step: '03', icon: <Brain size={20} />, title: 'ML Pipeline Runs', desc: 'Python computes 4 features per user, applies XGBoost model, calculates SHAP scores.' },
              { step: '04', icon: <Bell size={20} />, title: 'Alerts Fired', desc: 'HMAC-signed webhooks and email alerts dispatched for customers above 75% risk.' },
            ].map((s, i) => (
              <div key={s.step} style={{ position: 'relative', padding: '32px 28px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '12px' }}>STEP {s.step}</div>
                <div style={{ color: 'var(--primary)', marginBottom: '12px' }}>{s.icon}</div>
                <h4 style={{ marginBottom: '8px' }}>{s.title}</h4>
                <p style={{ fontSize: '14px', lineHeight: '1.65' }}>{s.desc}</p>
                {i < 3 && <ChevronRight size={16} style={{ position: 'absolute', right: '-9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--border-strong)', zIndex: 1 }} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Tech Stack Section ─── */}
      <section style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2>Built with Production-Grade Tools</h2>
            <p style={{ maxWidth: '480px', margin: '12px auto 0' }}>Entirely free-tier. Fully real. No mock data.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', maxWidth: '800px', margin: '0 auto' }}>
            {TECH_STACK.map(t => (
              <div key={t.name} className="card" style={{ padding: '18px', textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>{t.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section style={{ padding: '80px 0', borderTop: '1px solid var(--border)' }}>
        <div className="container">
          <div style={{
            background: 'linear-gradient(135deg, hsl(var(--hue), 75%, 55%), hsl(280, 75%, 60%))',
            borderRadius: 'var(--radius-xl)', padding: '60px 40px', textAlign: 'center',
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ color: 'rgba(255,255,255,0.85)', marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
                <TrendingDown size={36} />
              </div>
              <h2 style={{ color: '#fff', marginBottom: '16px' }}>Stop Watching Customers Leave</h2>
              <p style={{ color: 'rgba(255,255,255,0.8)', maxWidth: '480px', margin: '0 auto 32px', fontSize: '17px' }}>
                ChurnShield tells you who is about to churn, why they are churning, and how to save them — automatically.
              </p>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setShowModal(true)} className="btn btn-lg" style={{ background: '#fff', color: 'var(--primary)', fontWeight: 700 }}>
                  <Zap size={18} /> Try Live Demo
                </button>
                <Link href="/login" className="btn btn-lg" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)', backdropFilter: 'blur(8px)' }}>
                  <Lock size={18} /> Admin Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '40px 0', background: 'var(--bg-surface)' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: '15px' }}>ChurnShield</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>— Capstone ML Portfolio Project</span>
          </div>
          <div style={{ display: 'flex', gap: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <Link href="/login" style={{ color: 'inherit' }}>Dashboard</Link>
          </div>
        </div>
      </footer>

      {/* Modal */}
      {showModal && <QuickViewModal onClose={() => setShowModal(false)} />}
    </div>
  );
};