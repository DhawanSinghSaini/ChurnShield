'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Users, DollarSign, AlertTriangle, FileText, ArrowUpRight, ShieldAlert 
} from 'lucide-react';
import { apiFetch, apiFetchBlob } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

interface TopRiskCustomer {
  id: string;
  external_user_id: string;
  churn_risk_probability: number;
  risk_classification_status: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  monthly_contract_value: string;
}

interface OverviewData {
  totalCustomers: number;
  totalRevenue: number;
  revenueAtRisk: number;
  statusCounts: {
    HEALTHY: number;
    AT_RISK: number;
    CRITICAL: number;
  };
  topAtRiskCustomers: TopRiskCustomer[];
  lastComputedAt: string;
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function loadOverview() {
      try {
        const stats = await apiFetch<OverviewData>('/api/overview');
        setData(stats);
      } catch (err: any) {
        setError(err.message || 'Failed to load overview data.');
      } finally {
        setLoading(false);
      }
    }
    loadOverview();
  }, []);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const blob = await apiFetchBlob('/api/overview/pdf-report');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ChurnShield_Executive_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to generate and download PDF report.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="skeleton" style={{ width: '200px', height: '32px' }} />
          <div className="skeleton" style={{ width: '160px', height: '40px' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '12px' }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', marginTop: '12px' }}>
          <div className="skeleton" style={{ height: '350px', borderRadius: '12px' }} />
          <div className="skeleton" style={{ height: '350px', borderRadius: '12px' }} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <AlertTriangle size={48} color="var(--danger)" style={{ marginBottom: '16px' }} />
        <h3 style={{ marginBottom: '8px' }}>Failed to Load Dashboard</h3>
        <p style={{ marginBottom: '24px' }}>{error || 'An unexpected error occurred.'}</p>
        <button onClick={() => window.location.reload()} className="btn btn-primary">Retry</button>
      </div>
    );
  }

  const pieData = [
    { name: 'Healthy', value: data.statusCounts.HEALTHY, color: 'var(--success)' },
    { name: 'At Risk', value: data.statusCounts.AT_RISK, color: 'var(--warning)' },
    { name: 'Critical', value: data.statusCounts.CRITICAL, color: 'var(--danger)' },
  ].filter(item => item.value > 0);

  const kpis = [
    {
      label: 'Total Customers',
      value: data.totalCustomers.toString(),
      icon: <Users size={20} color="var(--primary)" />,
      bg: 'hsl(var(--hue), 75%, 95%)'
    },
    {
      label: 'Portfolio Value (MRR)',
      value: formatCurrency(data.totalRevenue),
      icon: <DollarSign size={20} color="var(--success)" />,
      bg: 'var(--success-bg)'
    },
    {
      label: 'Revenue at Risk',
      value: formatCurrency(data.revenueAtRisk),
      icon: <ShieldAlert size={20} color="var(--danger)" />,
      bg: 'var(--danger-bg)'
    },
    {
      label: 'Critical Risk Accounts',
      value: data.statusCounts.CRITICAL.toString(),
      icon: <AlertTriangle size={20} color="var(--warning)" />,
      bg: 'var(--warning-bg)'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px' }}>Executive Overview</h1>
          <p style={{ fontSize: '14px', marginTop: '4px' }}>
            Risk segmentation and insights computed on: <strong>{new Date(data.lastComputedAt).toLocaleString()}</strong>
          </p>
        </div>
        <button 
          onClick={handleDownloadPDF} 
          disabled={downloading}
          className="btn btn-secondary"
        >
          <FileText size={16} />
          {downloading ? 'Generating Report...' : 'Download PDF Report'}
        </button>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: kpi.bg, display: 'flex',
              alignItems: 'center', justifyContent: 'center'
            }}>
              {kpi.icon}
            </div>
            <div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{kpi.label}</p>
              <h3 style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>{kpi.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Graphs & Detailed Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Pie Chart Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '380px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Risk Segmentation</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Subscribers sorted by threat class
          </p>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={6}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: 'var(--bg-surface)', 
                      borderColor: 'var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)'
                    }} 
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No customers scored yet.</p>
            )}
          </div>
        </div>

        {/* Top 5 Threat Accounts */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>Top Churn Threats</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Highest risk users currently active
              </p>
            </div>
            <Link href="/dashboard/customers" className="btn btn-ghost btn-sm" style={{ gap: '4px' }}>
              <span>View All</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div style={{ overflowX: 'auto', flex: 1 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {data.topAtRiskCustomers.map((cust) => {
                  const riskPercent = Math.round(cust.churn_risk_probability * 100);
                  const isCritical = cust.risk_classification_status === 'CRITICAL';
                  
                  return (
                    <tr key={cust.id}>
                      <td style={{ fontWeight: 600 }}>
                        <Link href={`/dashboard/customers/${cust.id}`} style={{ color: 'var(--primary)' }}>
                          {cust.external_user_id}
                        </Link>
                      </td>
                      <td>{formatCurrency(cust.monthly_contract_value)}</td>
                      <td>
                        <span className={`badge ${isCritical ? 'badge-danger' : 'badge-warning'}`}>
                          {cust.risk_classification_status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: isCritical ? 'var(--danger)' : 'var(--warning)' }}>
                        {riskPercent}%
                      </td>
                    </tr>
                  );
                })}
                {data.topAtRiskCustomers.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                      No churn threats flagged.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
