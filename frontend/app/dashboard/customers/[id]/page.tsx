'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, DollarSign, Calendar, MessageSquarePlus, Loader2,
  Activity, Bell, FileText, Send, ChevronDown, ChevronUp
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatCurrency, formatDateTime, getRiskBadgeClass, getRiskColor } from '@/lib/utils';
import RiskGauge from '@/components/RiskGauge';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid, ReferenceLine
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Customer {
  id: string;
  external_user_id: string;
  churn_risk_probability: number;
  risk_classification_status: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  monthly_contract_value: string;
  last_computed_at: string;
  shap_top_features?: { feature: string; shap_value: number }[];
}

interface EventBucket { week_start: string; event_count: number; }
interface ActivityItem {
  id: string;
  type: 'note' | 'intervention' | 'event';
  actor: string;
  content: string;
  created_at: string;
}
interface RiskHistoryItem { churn_risk_probability: number; computed_at: string; }

// ─── Simulation defaults ──────────────────────────────────────────────────────
const SIM_DEFAULTS = {
  engagement_delta_7d: 0.0,
  negative_event_ratio: 0.3,
  days_since_last_interaction: 7,
  contract_weight_index: 1.0
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params?.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [eventHistory, setEventHistory] = useState<EventBucket[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [riskHistory, setRiskHistory] = useState<RiskHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Simulation state
  const [simValues, setSimValues] = useState(SIM_DEFAULTS);
  const [simResult, setSimResult] = useState<number | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simRunOnce, setSimRunOnce] = useState(false);

  // Notes state
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);

  // Collapsible sections
  const [openSection, setOpenSection] = useState<string>('details');

  useEffect(() => {
    if (!customerId) return;
    async function load() {
      try {
        const [detailData, feedData, historyData] = await Promise.all([
          apiFetch<{ customer: Customer; eventHistory: EventBucket[] }>(`/api/customers/${customerId}`),
          apiFetch<ActivityItem[]>(`/api/customers/${customerId}/activity-feed`),
          apiFetch<RiskHistoryItem[]>(`/api/customers/${customerId}/history`)
        ]);
        setCustomer(detailData.customer);
        setEventHistory(detailData.eventHistory);
        setActivityFeed(feedData);
        setRiskHistory(historyData);
      } catch (err: any) {
        setError(err.message || 'Failed to load customer data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [customerId]);

  const runSimulation = async () => {
    setSimLoading(true);
    setSimRunOnce(true);
    try {
      const res = await apiFetch<{ simulated_churn_risk_probability: number }>(
        `/api/customers/${customerId}/simulate`,
        {
          method: 'POST',
          body: JSON.stringify(simValues)
        }
      );
      setSimResult(res.simulated_churn_risk_probability);
    } catch (err: any) {
      alert('Simulation failed: ' + err.message);
    } finally {
      setSimLoading(false);
    }
  };

  const submitNote = async () => {
    if (!noteText.trim()) return;
    setNoteLoading(true);
    try {
      const newNote = await apiFetch<ActivityItem>(
        `/api/customers/${customerId}/notes`,
        { method: 'POST', body: JSON.stringify({ note_text: noteText }) }
      );
      setActivityFeed(prev => [{ ...newNote, type: 'note', actor: 'You' }, ...prev]);
      setNoteText('');
      setNoteSuccess(true);
      setTimeout(() => setNoteSuccess(false), 3000);
    } catch (err: any) {
      alert('Failed to save note: ' + err.message);
    } finally {
      setNoteLoading(false);
    }
  };

  const toggleSection = (s: string) => setOpenSection(prev => prev === s ? '' : s);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="skeleton" style={{ width: '200px', height: '28px', borderRadius: '6px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          <div className="skeleton" style={{ height: '340px', borderRadius: '12px' }} />
          <div className="skeleton" style={{ height: '340px', borderRadius: '12px' }} />
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
        <h3>{error || 'Customer not found'}</h3>
        <Link href="/dashboard/customers" className="btn btn-primary" style={{ marginTop: '16px' }}>
          ← Back to Customers
        </Link>
      </div>
    );
  }

  const riskPercent = Math.round(customer.churn_risk_probability * 100);
  const displayScore = simResult !== null ? simResult : customer.churn_risk_probability;

  // SHAP feature names map for readable labels
  const shapLabels: Record<string, string> = {
    engagement_delta_7d: 'Engagement Trend (7d)',
    negative_event_ratio: 'Negative Event Ratio',
    days_since_last_interaction: 'Days Since Last Activity',
    contract_weight_index: 'Contract Value Weight'
  };

  const shapFeatures = customer.shap_top_features || [
    { feature: 'engagement_delta_7d', shap_value: -0.18 },
    { feature: 'days_since_last_interaction', shap_value: 0.25 },
    { feature: 'negative_event_ratio', shap_value: 0.12 }
  ];

  // Section header helper
  const SectionHeader = ({ id, title, icon }: { id: string; title: string; icon: React.ReactNode }) => (
    <button
      onClick={() => toggleSection(id)}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        padding: '20px 24px', borderBottom: openSection === id ? '1px solid var(--border)' : 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
        <span style={{ color: 'var(--primary)' }}>{icon}</span>
        <strong style={{ fontSize: '15px' }}>{title}</strong>
      </div>
      {openSection === id ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ─── Breadcrumb ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link href="/dashboard/customers" className="btn btn-ghost btn-sm">
          <ArrowLeft size={15} /> Back to Customers
        </Link>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {customer.external_user_id}
        </span>
      </div>

      {/* ─── Top Row: Gauge + KPIs ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Gauge Card */}
        <div className="card" style={{ textAlign: 'center', padding: '28px 32px', minWidth: '200px' }}>
          <RiskGauge score={displayScore} size={150} />
          {simResult !== null && (
            <div style={{
              marginTop: '10px', fontSize: '11px', fontWeight: 600,
              color: 'var(--warning)', background: 'var(--warning-bg)',
              padding: '4px 10px', borderRadius: '99px', display: 'inline-block'
            }}>
              SIMULATED SCORE
            </div>
          )}
        </div>

        {/* KPI strips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontFamily: 'monospace' }}>{customer.external_user_id}</h2>
            <span className={`badge ${getRiskBadgeClass(customer.risk_classification_status)}`} style={{ marginTop: '6px' }}>
              {customer.risk_classification_status}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Live Risk Score', value: `${riskPercent}%`, icon: <Activity size={16} /> },
              { label: 'Monthly Contract', value: formatCurrency(customer.monthly_contract_value), icon: <DollarSign size={16} /> },
              { label: 'Last ML Scoring', value: formatDateTime(customer.last_computed_at), icon: <Calendar size={16} /> },
            ].map(kpi => (
              <div key={kpi.label} style={{
                background: 'var(--bg-elevated)', borderRadius: '10px',
                padding: '14px', border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '12px', marginBottom: '6px' }}>
                  {kpi.icon} {kpi.label}
                </div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{kpi.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SHAP Explainability ─── */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <SectionHeader id="shap" title="Top Risk Reasons (SHAP Explainability)" icon={<FileText size={17} />} />
        {openSection === 'shap' && (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px' }}>These are the top 3 model features driving this customer's churn score:</p>
            {shapFeatures.map((f, i) => {
              const isRisk = f.shap_value > 0;
              const barWidth = Math.min(Math.abs(f.shap_value) * 300, 100);
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600 }}>{shapLabels[f.feature] || f.feature}</span>
                    <span style={{ color: isRisk ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                      {isRisk ? '+' : ''}{f.shap_value.toFixed(3)} {isRisk ? '↑ risk' : '↓ risk'}
                    </span>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', borderRadius: '99px', height: '8px' }}>
                    <div style={{
                      width: `${barWidth}%`, height: '100%',
                      background: isRisk ? 'var(--danger)' : 'var(--success)',
                      borderRadius: '99px', transition: 'width 0.6s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Event History Bar Chart ─── */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <SectionHeader id="events" title="8-Week Platform Usage History" icon={<Activity size={17} />} />
        {openSection === 'events' && (
          <div style={{ padding: '20px 24px' }}>
            {eventHistory.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
                No usage events found in the past 8 weeks.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={eventHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="week_start"
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    labelFormatter={(v) => `Week of ${v}`}
                  />
                  <Bar dataKey="event_count" name="Events" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {/* ─── Risk Score History ─── */}
      {riskHistory.length > 0 && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <SectionHeader id="history" title="Risk Score Trend History" icon={<Activity size={17} />} />
          {openSection === 'history' && (
            <div style={{ padding: '20px 24px' }}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={riskHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="computed_at"
                    tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    formatter={(v: number) => [`${Math.round(v * 100)}%`, 'Risk Score']}
                    labelFormatter={(v) => new Date(v).toLocaleDateString()}
                  />
                  <ReferenceLine y={0.75} stroke="var(--danger)" strokeDasharray="4 4" />
                  <ReferenceLine y={0.40} stroke="var(--warning)" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="churn_risk_probability" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ─── What-If Simulation Sandbox ─── */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <SectionHeader id="simulation" title="What-If Simulation Sandbox" icon={<Bell size={17} />} />
        {openSection === 'simulation' && (
          <div style={{ padding: '20px 24px' }}>
            <p style={{ fontSize: '13px', marginBottom: '20px' }}>
              Adjust the sliders below and re-run the ML model to see how behaviour changes affect the churn risk score in real-time.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              {[
                { key: 'engagement_delta_7d', label: 'Engagement Delta (7d)', min: -1, max: 1, step: 0.01, desc: 'Change in engagement events vs prior week. Negative = decline.' },
                { key: 'negative_event_ratio', label: 'Negative Event Ratio', min: 0, max: 1, step: 0.01, desc: 'Proportion of engagement events that are drops/failures (0–1).' },
                { key: 'days_since_last_interaction', label: 'Days Since Last Activity', min: 0, max: 90, step: 1, desc: 'Days elapsed since last platform interaction.' },
                { key: 'contract_weight_index', label: 'Contract Value Weight', min: 0, max: 3, step: 0.01, desc: 'Normalised contract value multiplier (1.0 = average).' },
              ].map(({ key, label, min, max, step, desc }) => {
                const val = simValues[key as keyof typeof simValues];
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '13px', marginBottom: 0 }}>{label}</label>
                      <strong style={{ fontSize: '13px', color: 'var(--primary)' }}>{Number(val).toFixed(2)}</strong>
                    </div>
                    <input
                      type="range"
                      min={min} max={max} step={step}
                      value={val}
                      onChange={(e) => setSimValues(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                      style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{desc}</p>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button onClick={runSimulation} disabled={simLoading} className="btn btn-primary">
                {simLoading ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Simulating...</> : '▶ Run Simulation'}
              </button>
              {simRunOnce && (
                <button
                  onClick={() => { setSimResult(null); setSimValues(SIM_DEFAULTS); setSimRunOnce(false); }}
                  className="btn btn-ghost btn-sm"
                >
                  Reset to Live Score
                </button>
              )}
              {simResult !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Simulated Risk Score:
                  </span>
                  <strong style={{ fontSize: '18px', color: getRiskColor(simResult >= 0.75 ? 'CRITICAL' : simResult >= 0.4 ? 'AT_RISK' : 'HEALTHY') }}>
                    {Math.round(simResult * 100)}%
                  </strong>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>(Live: {riskPercent}%)</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Activity Feed + CRM Notes ─── */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <SectionHeader id="feed" title="Unified Activity Feed & CRM Notes" icon={<MessageSquarePlus size={17} />} />
        {openSection === 'feed' && (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Note Input */}
            <div style={{
              background: 'var(--bg-elevated)', borderRadius: '10px',
              padding: '16px', border: '1px solid var(--border)'
            }}>
              <label>Add a CRM Note</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="E.g. Called the customer, they mentioned pricing concerns..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  style={{ resize: 'none', flex: 1 }}
                />
                <button onClick={submitNote} disabled={noteLoading || !noteText.trim()} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end' }}>
                  {noteLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                </button>
              </div>
              {noteSuccess && <p style={{ color: 'var(--success)', fontSize: '12px', marginTop: '6px' }}>✓ Note saved and added to the feed.</p>}
            </div>

            {/* Feed Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activityFeed.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No activity recorded yet.</p>
              ) : (
                activityFeed.map((item) => {
                  const typeStyles = {
                    note: { bg: 'hsl(var(--hue), 75%, 95%)', border: 'hsl(var(--hue), 75%, 85%)', icon: <MessageSquarePlus size={13} color="var(--primary)" /> },
                    intervention: { bg: 'var(--warning-bg)', border: 'hsl(38,92%,85%)', icon: <Bell size={13} color="var(--warning)" /> },
                    event: { bg: 'var(--bg-elevated)', border: 'var(--border)', icon: <Activity size={13} color="var(--text-muted)" /> }
                  };
                  const style = typeStyles[item.type] || typeStyles.event;
                  return (
                    <div key={item.id} style={{
                      background: style.bg, border: `1px solid ${style.border}`,
                      borderRadius: '10px', padding: '12px 14px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ marginTop: '2px', flexShrink: 0 }}>{style.icon}</span>
                          <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{item.content}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              by <strong>{item.actor}</strong>
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {formatDateTime(item.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
