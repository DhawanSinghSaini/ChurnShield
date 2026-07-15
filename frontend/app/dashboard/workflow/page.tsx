'use client';
import { useState, useEffect } from 'react';
import { 
  Terminal, Layers, Cpu, Database, Brain, Eye, Bell, Send, CheckCircle2, ShieldAlert
} from 'lucide-react';

interface Node {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: string;
  latency: string;
  throughput: string;
  details: string;
}

const nodes: Node[] = [
  { id: 'ingestion', label: 'Event Ingestion', sublabel: 'REST Endpoint', icon: <Terminal size={22} />, color: '#3b82f6', latency: '12ms', throughput: '10K/hr', details: 'Fires via client requests to POST /v1/track. Web API keys are verified instantly against cached values in Redis.' },
  { id: 'queue', label: 'Redis Queue', sublabel: 'Stream buffer', icon: <Layers size={22} />, color: '#8b5cf6', latency: '1ms', throughput: '4.8K/sec', details: 'Decouples ingestion from database writes. Raw event payloads are pushed onto the events_queue list.' },
  { id: 'batch', label: 'Batch Writer', sublabel: 'cron worker', icon: <Cpu size={22} />, color: '#06b6d4', latency: '~0ms', throughput: 'Triggered 10s', details: 'Node.js cron drains Redis streams and runs bulk copy/insert transaction operations into PostgreSQL.' },
  { id: 'postgres', label: 'PostgreSQL', sublabel: 'Feature store', icon: <Database size={22} />, color: '#10b981', latency: '8ms', throughput: 'Write-ahead', details: 'Relational data store containing business users, customer attributes, notes, and activity timeline metrics.' },
  { id: 'ml', label: 'ML Pipeline', sublabel: 'scikit-learn', icon: <Brain size={22} />, color: '#f59e0b', latency: '38ms', throughput: 'Per batch', details: 'Executes python scoring pipeline. Aggregates behavioral features and computes probability scores.' },
  { id: 'shap', label: 'SHAP Explainer', sublabel: 'TreeExplainer', icon: <Eye size={22} />, color: '#f97316', latency: '14ms', throughput: 'Per customer', details: 'Extracts local feature attributions showing the top 3 negative or positive behaviors driving each customer risk score.' },
  { id: 'alerts', label: 'Alert Engine', sublabel: 'Threshold checks', icon: <Bell size={22} />, color: '#ef4444', latency: '3ms', throughput: 'Real-time', details: 'Monitors risk transitions. If risk probability crosses 75%, it automatically prepares outreach pipelines.' },
  { id: 'delivery', label: 'Delivery Layer', sublabel: 'Webhook / Email', icon: <Send size={22} />, color: '#64748b', latency: '<5ms', throughput: 'On-demand', details: 'Dispatches HTML email digests to business admins and fires secure HMAC-signed webhooks to external integrations.' },
];

const benchmarks = [
  { label: 'E2E Ingestion Latency (p50)', value: '13ms', target: '< 50ms', ok: true },
  { label: 'E2E Ingestion Latency (p99)', value: '45ms', target: '< 200ms', ok: true },
  { label: 'ML Inference Time', value: '38ms', target: '< 100ms', ok: true },
  { label: 'Alert Delivery Time', value: '< 5ms', target: '< 10ms', ok: true },
  { label: 'Batch Write Interval', value: '10 sec', target: '< 30 sec', ok: true },
  { label: 'Data Freshness SLA', value: '< 12 sec', target: '< 5 min', ok: true },
];

export default function WorkflowPage() {
  const [activeEdge, setActiveEdge] = useState(0);
  const [activeNode, setActiveNode] = useState<Node | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setActiveEdge((e) => (e + 1) % (nodes.length - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px' }}>Pipeline Workflow</h1>
        <p style={{ fontSize: '14px', marginTop: '4px' }}>
          Interactive visualization of the end-to-end data pipeline, model scoring, and alert propagation.
        </p>
      </div>

      {/* Flow Diagram Card */}
      <div className="card" style={{ padding: '32px', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', minWidth: '950px', paddingBottom: '16px' }}>
          {nodes.map((node, i) => (
            <div key={node.id} style={{ display: 'flex', alignItems: 'center', flex: i < nodes.length - 1 ? '1' : 'none' }}>
              {/* Node Card */}
              <div
                onClick={() => setActiveNode(activeNode?.id === node.id ? null : node)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  width: '90px'
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: `${node.color}15`,
                    border: `2px dashed ${activeNode?.id === node.id ? node.color : node.color + '45'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: node.color,
                    transition: 'all var(--transition)',
                    boxShadow: activeNode?.id === node.id ? `0 0 16px ${node.color}35` : 'none',
                    transform: activeNode?.id === node.id ? 'scale(1.05)' : 'none'
                  }}
                >
                  {node.icon}
                </div>
                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {node.label}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {node.sublabel}
                  </div>
                  <div style={{ fontSize: '9px', fontFamily: 'monospace', color: node.color, fontWeight: 700, marginTop: '4px' }}>
                    {node.latency}
                  </div>
                </div>
              </div>

              {/* Edge line with animated flow dot */}
              {i < nodes.length - 1 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 4px', marginBottom: '32px' }}>
                  <div style={{ flex: 1, height: '2px', background: 'var(--border)', position: 'relative', overflow: 'visible' }}>
                    {activeEdge === i && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '-3px',
                          left: '0',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: nodes[i].color,
                          boxShadow: `0 0 8px ${nodes[i].color}`,
                          animation: 'flow-dot 1s linear forwards',
                        }}
                      />
                    )}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '2px', lineHeight: 1 }}>
                    ▸
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Selected Node Details Box */}
        {activeNode && (
          <div
            className="animate-fade-in"
            style={{
              marginTop: '24px',
              padding: '20px',
              background: 'var(--bg-elevated)',
              border: `1px solid ${activeNode.color}40`,
              borderRadius: '12px',
              display: 'grid',
              gridTemplateColumns: 'auto 2fr 1fr 1fr',
              gap: '24px',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '10px',
                background: `${activeNode.color}15`,
                color: activeNode.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {activeNode.icon}
            </div>
            <div>
              <h4 style={{ color: 'var(--text-primary)', margin: 0 }}>{activeNode.label}</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{activeNode.details}</p>
            </div>
            <div>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Latency</span>
              <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace', color: activeNode.color, marginTop: '2px' }}>
                {activeNode.latency}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Throughput</span>
              <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace', color: activeNode.color, marginTop: '2px' }}>
                {activeNode.throughput}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Benchmarks Section */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '16px' }}>Latency & SLA Benchmarks</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            System telemetry indicators vs threshold performance SLAs.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0' }}>
          {benchmarks.map((b, i) => (
            <div
              key={b.label}
              style={{
                padding: '20px 24px',
                borderBottom: i < 3 ? '1px solid var(--border)' : 'none',
                borderRight: (i + 1) % 3 !== 0 ? '1px solid var(--border)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--success-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--success)'
                }}
              >
                <CheckCircle2 size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{b.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--success)' }}>
                    {b.value}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    SLA target {b.target}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
