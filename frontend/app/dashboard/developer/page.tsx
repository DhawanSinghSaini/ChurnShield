'use client';
import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import {
  Key, RefreshCw, Trash2, Copy, CheckCheck, Send,
  Wifi, WifiOff, AlertTriangle, BarChart2, Save, Database
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from 'recharts';

interface MetricDay {
  date: string;
  success: number;
  rate_limited: number;
  total: number;
}

interface WebhookResult {
  url: string;
  success: boolean;
  responseTimeMs: number;
  status: number | null;
  errorMessage: string | null;
  headers: Record<string, string>;
  body: string;
}

export default function DeveloperPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  // API Key state
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyError, setKeyError] = useState('');

  // Ingestion metrics state
  const [metrics, setMetrics] = useState<MetricDay[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Webhook settings state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [saveWebhookLoading, setSaveWebhookLoading] = useState(false);
  const [saveWebhookSuccess, setSaveWebhookSuccess] = useState(false);

  // Webhook sandbox test state
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookResult, setWebhookResult] = useState<WebhookResult | null>(null);
  const [showHeaders, setShowHeaders] = useState(false);

  // Seed events state
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  const loadApiKey = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await apiFetch<{ api_key: string | null }>('/api/keys');
      setApiKey(data.api_key);
    } catch (err) {
      console.error('Failed to load API key:', err);
    }
  }, [isAdmin]);

  const loadWebhookConfig = useCallback(async () => {
    try {
      const data = await apiFetch<{ webhook_url: string | null; webhook_secret: string | null }>('/api/developer/webhook-config');
      setWebhookUrl(data.webhook_url || '');
      setWebhookSecret(data.webhook_secret || '');
    } catch (err) {
      console.error('Failed to load webhook configuration:', err);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const data = await apiFetch<MetricDay[]>('/api/developer/metrics');
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load ingestion metrics:', err);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
    loadApiKey();
    loadWebhookConfig();
  }, [loadMetrics, loadApiKey, loadWebhookConfig]);

  const handleGenerateKey = async () => {
    setKeyLoading(true);
    setKeyError('');
    try {
      const data = await apiFetch<{ api_key: string }>('/api/keys', { method: 'POST' });
      setApiKey(data.api_key);
    } catch (err: any) {
      setKeyError(err.message || 'Failed to generate API key.');
    } finally {
      setKeyLoading(false);
    }
  };

  const handleRevokeKey = async () => {
    if (!confirm('Are you sure? This will immediately invalidate your current API key.')) return;
    setKeyLoading(true);
    setKeyError('');
    try {
      await apiFetch('/api/keys', { method: 'DELETE' });
      setApiKey(null);
    } catch (err: any) {
      setKeyError(err.message || 'Failed to revoke API key.');
    } finally {
      setKeyLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2500);
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveWebhookLoading(true);
    setSaveWebhookSuccess(false);
    try {
      await apiFetch('/api/developer/webhook-config', {
        method: 'PUT',
        body: JSON.stringify({ webhook_url: webhookUrl, webhook_secret: webhookSecret })
      });
      setSaveWebhookSuccess(true);
      setTimeout(() => setSaveWebhookSuccess(false), 3000);
    } catch (err: any) {
      alert('Failed to save webhook config: ' + err.message);
    } finally {
      setSaveWebhookLoading(false);
    }
  };

  const handleWebhookTest = async () => {
    setWebhookLoading(true);
    setWebhookResult(null);
    try {
      const result = await apiFetch<WebhookResult>('/api/webhooks/test', { method: 'POST' });
      setWebhookResult(result);
    } catch (err: any) {
      setWebhookResult({
        url: webhookUrl,
        success: false,
        responseTimeMs: 0,
        status: null,
        errorMessage: err.message || 'Request failed.',
        headers: {},
        body: ''
      });
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleSeedEvents = async () => {
    if (!apiKey) {
      alert('Please generate an API Key first.');
      return;
    }
    setSeedLoading(true);
    setSeedSuccess(false);
    try {
      const mockEvents = [
        { user_id: 'user_1', action_label: 'dashboard_view', event_type: 'ENGAGEMENT_SUCCESS' },
        { user_id: 'user_2', action_label: 'profile_edit', event_type: 'ENGAGEMENT_SUCCESS' },
        { user_id: 'user_3', action_label: 'billing_failed', event_type: 'ENGAGEMENT_DROP' },
        { user_id: 'user_4', action_label: 'page_nav', event_type: 'ENGAGEMENT_SUCCESS' },
      ];

      for (const ev of mockEvents) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/v1/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          },
          body: JSON.stringify(ev)
        });
      }
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 3000);
      await loadMetrics(); // Reload the graph metrics
    } catch (err: any) {
      alert('Failed to seed events: ' + err.message);
    } finally {
      setSeedLoading(false);
    }
  };

  const totalToday = metrics.length > 0 ? metrics[metrics.length - 1].total : 0;
  const successToday = metrics.length > 0 ? metrics[metrics.length - 1].success : 0;
  const limitedToday = metrics.length > 0 ? metrics[metrics.length - 1].rate_limited : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px' }}>Developer Console</h1>
        <p style={{ fontSize: '14px', marginTop: '4px' }}>
          Manage API keys, configure webhook endpoints, and monitor real-time event flow.
        </p>
      </div>

      {/* ─── API Key Management ─── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Key size={18} color="var(--primary)" />
          <h3 style={{ fontSize: '16px' }}>API Key Management</h3>
        </div>
        <p style={{ fontSize: '13px', marginBottom: '20px' }}>
          Your API key is used to authenticate event ingestion requests to <code>POST /v1/track</code>.
          {!isAdmin && <strong style={{ color: 'var(--warning)', marginLeft: '6px' }}>Admin role required to manage keys.</strong>}
        </p>

        {apiKey ? (
          <div style={{
            background: 'var(--bg-elevated)', borderRadius: '10px', padding: '14px 16px',
            border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
            gap: '12px', marginBottom: '16px', fontFamily: 'monospace', fontSize: '13px',
            color: 'var(--text-primary)', flexWrap: 'wrap'
          }}>
            <span style={{ flex: 1, wordBreak: 'break-all' }}>{apiKey}</span>
            <button onClick={handleCopyKey} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
              {keyCopied ? <><CheckCheck size={14} color="var(--success)" /> Copied!</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            No API Key active. Click below to generate one.
          </p>
        )}

        {keyError && (
          <p style={{ color: 'var(--danger)', fontSize: '13px', background: 'var(--danger-bg)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px' }}>
            {keyError}
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {isAdmin && (
            <button onClick={handleGenerateKey} disabled={keyLoading} className="btn btn-primary btn-sm">
              <RefreshCw size={14} /> {apiKey ? 'Regenerate Key' : 'Generate New Key'}
            </button>
          )}
          {isAdmin && apiKey && (
            <button onClick={handleRevokeKey} disabled={keyLoading} className="btn btn-danger btn-sm">
              <Trash2 size={14} /> Revoke Key
            </button>
          )}
          {apiKey && (
            <button onClick={handleSeedEvents} disabled={seedLoading} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
              <Database size={14} /> {seedLoading ? 'Seeding...' : 'Seed Test Ingestions'}
            </button>
          )}
        </div>
        {seedSuccess && <p style={{ color: 'var(--success)', fontSize: '12px', marginTop: '8px' }}>✓ Test events ingested. Graph updated.</p>}

        {/* Integration snippet */}
        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: 600 }}>
            Integration Code Snippet:
          </p>
          <pre style={{
            background: 'var(--bg-base)', borderRadius: '8px', padding: '14px',
            fontSize: '12px', overflow: 'auto', border: '1px solid var(--border)',
            color: 'var(--text-primary)', lineHeight: 1.7
          }}>{`curl -X POST ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/v1/track \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey || 'cs_live_YOUR_KEY_HERE'}" \\
  -d '{
    "user_id": "user_123",
    "action_label": "page_view",
    "event_type": "ENGAGEMENT_SUCCESS"
  }'`}</pre>
        </div>
      </div>

      {/* ─── Redis Ingestion Metrics Chart ─── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '16px' }}>7-Day Ingestion Analytics</h3>
          </div>
          <button onClick={loadMetrics} disabled={metricsLoading} className="btn btn-ghost btn-sm">
            <RefreshCw size={13} style={{ animation: metricsLoading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
        <p style={{ fontSize: '13px', marginBottom: '6px' }}>
          Real-time event ingestion counts tracked in Redis for the past 7 days.
        </p>

        {/* Today's summary pills */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[
            { label: 'Total Today', value: totalToday, bg: 'hsl(var(--hue),75%,95%)', color: 'var(--primary)' },
            { label: 'Processed', value: successToday, bg: 'var(--success-bg)', color: 'var(--success)' },
            { label: 'Rate Limited', value: limitedToday, bg: 'var(--warning-bg)', color: 'var(--warning)' },
          ].map(item => (
            <div key={item.label} style={{
              background: item.bg, borderRadius: '8px', padding: '10px 16px',
              display: 'flex', flexDirection: 'column', gap: '2px'
            }}>
              <span style={{ fontSize: '11px', color: item.color, fontWeight: 600 }}>{item.label}</span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>

        {metricsLoading ? (
          <div className="skeleton" style={{ height: '200px', borderRadius: '8px' }} />
        ) : metrics.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            No ingestion data yet. Start sending events via <code>POST /v1/track</code>.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={metrics} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickFormatter={(v) => new Date(v + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                labelFormatter={(v) => `Date: ${v}`}
              />
              <Legend iconType="circle" />
              <Line type="monotone" dataKey="success" name="Processed" stroke="var(--success)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="total" name="Total Received" stroke="var(--primary)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="rate_limited" name="Rate Limited" stroke="var(--warning)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── Webhook Configuration ─── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Wifi size={18} color="var(--primary)" />
          <h3 style={{ fontSize: '16px' }}>Webhook Endpoint Settings</h3>
        </div>
        <p style={{ fontSize: '13px', marginBottom: '20px' }}>
          Configure where ChurnShield will send POST requests when a customer's risk goes above 75%.
        </p>

        <form onSubmit={handleSaveWebhook} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px' }}>
          <div>
            <label htmlFor="webhookUrl">Webhook URL</label>
            <input
              id="webhookUrl"
              type="url"
              className="input"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://yourdomain.com/webhooks/churn"
              disabled={!isAdmin || saveWebhookLoading}
              required
            />
          </div>

          <div>
            <label htmlFor="webhookSecret">Webhook Signature Secret (HMAC-SHA256)</label>
            <input
              id="webhookSecret"
              type="text"
              className="input"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="E.g. super_secret_signing_key"
              disabled={!isAdmin || saveWebhookLoading}
            />
          </div>

          {isAdmin && (
            <button type="submit" disabled={saveWebhookLoading} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start', gap: '6px' }}>
              <Save size={14} /> {saveWebhookLoading ? 'Saving...' : 'Save Configuration'}
            </button>
          )}
        </form>
        {saveWebhookSuccess && <p style={{ color: 'var(--success)', fontSize: '12px', marginTop: '8px' }}>✓ Webhook configuration saved.</p>}
      </div>

      {/* ─── Webhook Sandbox Tester ─── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Send size={18} color="var(--primary)" />
          <h3 style={{ fontSize: '16px' }}>Webhook Deliverability Sandbox</h3>
        </div>
        <p style={{ fontSize: '13px', marginBottom: '20px' }}>
          Fires an HMAC-signed test payload to your configured webhook URL and reports the full response.
          {!isAdmin && <strong style={{ color: 'var(--warning)', marginLeft: '6px' }}>Admin only.</strong>}
        </p>

        {isAdmin && (
          <button
            onClick={handleWebhookTest}
            disabled={webhookLoading || !webhookUrl}
            className="btn btn-primary"
          >
            {webhookLoading
              ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Firing test payload...</>
              : <><Send size={15} /> Fire Test Webhook</>}
          </button>
        )}

        {!webhookUrl && (
          <p style={{ color: 'var(--warning)', fontSize: '13px', marginTop: '12px' }}>
            Please configure and save a Webhook URL above to test.
          </p>
        )}

        {/* Sandbox result panel */}
        {webhookResult && (
          <div style={{ marginTop: '20px' }}>
            {/* Status row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
              background: webhookResult.success ? 'var(--success-bg)' : 'var(--danger-bg)',
              border: `1px solid ${webhookResult.success ? 'hsl(160,60%,80%)' : 'hsl(4,86%,80%)'}`,
              borderRadius: '10px', padding: '14px 18px', marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {webhookResult.success
                  ? <Wifi size={18} color="var(--success)" />
                  : <WifiOff size={18} color="var(--danger)" />}
                <strong style={{ color: webhookResult.success ? 'var(--success)' : 'var(--danger)', fontSize: '15px' }}>
                  {webhookResult.success ? 'Delivery Successful' : 'Delivery Failed'}
                </strong>
              </div>
              {webhookResult.status !== null && (
                <span className={`badge ${webhookResult.success ? 'badge-success' : 'badge-danger'}`}>
                  HTTP {webhookResult.status}
                </span>
              )}
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Response time: <strong>{webhookResult.responseTimeMs}ms</strong>
              </span>
              {webhookResult.url && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  → {webhookResult.url}
                </span>
              )}
            </div>

            {/* Error */}
            {webhookResult.errorMessage && (
              <div style={{
                background: 'var(--danger-bg)', borderRadius: '8px', padding: '12px 14px',
                fontSize: '13px', color: 'var(--danger)', marginBottom: '12px',
                display: 'flex', gap: '8px', alignItems: 'flex-start'
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                {webhookResult.errorMessage}
              </div>
            )}

            {/* Response body */}
            {webhookResult.body && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>RESPONSE BODY:</p>
                <pre style={{
                  background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px',
                  padding: '12px', fontSize: '12px', overflow: 'auto', color: 'var(--text-primary)', lineHeight: 1.6
                }}>
                  {webhookResult.body}
                </pre>
              </div>
            )}

            {/* Response headers toggle */}
            {Object.keys(webhookResult.headers).length > 0 && (
              <div>
                <button
                  onClick={() => setShowHeaders(p => !p)}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '12px', marginBottom: '8px' }}
                >
                  {showHeaders ? '▲ Hide' : '▼ Show'} Response Headers ({Object.keys(webhookResult.headers).length})
                </button>
                {showHeaders && (
                  <pre style={{
                    background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px',
                    padding: '12px', fontSize: '12px', overflow: 'auto', color: 'var(--text-primary)', lineHeight: 1.6
                  }}>
                    {Object.entries(webhookResult.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}