'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUpRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useCustomerStore, Customer } from '@/store/useCustomerStore';
import { formatCurrency, formatDate, getRiskBadgeClass } from '@/lib/utils';
import { SEGMENTS } from '@/lib/constants';

type SortOption = 'risk_desc' | 'risk_asc' | 'value_desc' | 'value_asc';

export default function CustomersPage() {
  const {
    customers, totalCount, page, limit,
    statusFilter, sortBy, segment, searchQuery,
    setCustomers, setPage, setStatusFilter, setSortBy, setSegment, setSearchQuery, setLoading, isLoading
  } = useCustomerStore();

  const [inputVal, setInputVal] = useState(searchQuery);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (sortBy) params.set('sort', sortBy);
      if (segment) params.set('segment', segment);
      if (searchQuery) params.set('search', searchQuery);

      const data = await apiFetch<{ customers: Customer[]; totalCount: number }>(`/api/customers?${params}`);
      setCustomers(data.customers, data.totalCount);
    } catch (err) {
      console.error('Failed to fetch customers', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, sortBy, segment, searchQuery, setCustomers, setLoading]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(inputVal), 400);
    return () => clearTimeout(timer);
  }, [inputVal, setSearchQuery]);

  const totalPages = Math.ceil(totalCount / limit);
  const statusTabs = ['ALL', 'HEALTHY', 'AT_RISK', 'CRITICAL'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px' }}>Customer Portfolio</h1>
        <p style={{ fontSize: '14px', marginTop: '4px' }}>
          <strong>{totalCount}</strong> customers tracked across all risk levels.
        </p>
      </div>

      {/* Segment Tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {SEGMENTS.map((seg) => (
          <button
            key={seg.value}
            onClick={() => setSegment(seg.value as any)}
            className="btn btn-sm"
            style={{
              background: segment === seg.value ? 'var(--primary)' : 'var(--bg-elevated)',
              color: segment === seg.value ? '#fff' : 'var(--text-secondary)',
              border: segment === seg.value ? 'none' : '1px solid var(--border)',
              boxShadow: segment === seg.value ? '0 2px 8px var(--primary-glow)' : 'none'
            }}
          >
            {seg.label}
          </button>
        ))}
      </div>

      {/* Controls Row */}
      <div className="card" style={{ padding: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            placeholder="Search by Customer ID..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {statusTabs.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="btn btn-sm"
              style={{
                background: statusFilter === s ? 'var(--bg-elevated)' : 'transparent',
                color: statusFilter === s ? 'var(--text-primary)' : 'var(--text-muted)',
                border: statusFilter === s ? '1px solid var(--border-strong)' : '1px solid transparent',
                fontWeight: statusFilter === s ? 600 : 400
              }}
            >
              {s === 'AT_RISK' ? 'At Risk' : s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
          <ArrowUpDown size={14} />
          <select
            className="input"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            style={{ width: 'auto', padding: '6px 10px', fontSize: '13px' }}
          >
            <option value="risk_desc">Risk: High → Low</option>
            <option value="risk_asc">Risk: Low → High</option>
            <option value="value_desc">Value: High → Low</option>
            <option value="value_asc">Value: Low → High</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>MRR Value</th>
                <th>Risk Status</th>
                <th>Risk Score</th>
                <th>Last Scored</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j}><div className="skeleton" style={{ height: '16px', width: '80%', borderRadius: '4px' }} /></td>
                    ))}
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    No customers found matching your filters.
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const riskPercent = Math.round(c.churn_risk_probability * 100);
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono, monospace)', fontSize: '13px' }}>
                        {c.external_user_id}
                      </td>
                      <td>{formatCurrency(c.monthly_contract_value)}</td>
                      <td>
                        <span className={`badge ${getRiskBadgeClass(c.risk_classification_status)}`}>
                          {c.risk_classification_status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            flex: 1, height: '6px', background: 'var(--bg-elevated)',
                            borderRadius: '99px', overflow: 'hidden', maxWidth: '80px'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${riskPercent}%`,
                              background: riskPercent >= 75 ? 'var(--danger)' : riskPercent >= 40 ? 'var(--warning)' : 'var(--success)',
                              borderRadius: '99px',
                              transition: 'width 0.5s ease'
                            }} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '13px', minWidth: '36px' }}>{riskPercent}%</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        {formatDate(c.last_computed_at)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          href={`/dashboard/customers/${c.id}`}
                          className="btn btn-ghost btn-sm"
                          style={{ gap: '4px', color: 'var(--primary)' }}
                        >
                          View <ArrowUpRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 20px', borderTop: '1px solid var(--border)'
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, totalCount)} of <strong>{totalCount}</strong>
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="btn btn-secondary btn-sm"
              >
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="btn btn-sm"
                    style={{
                      background: page === p ? 'var(--primary)' : 'var(--bg-elevated)',
                      color: page === p ? '#fff' : 'var(--text-secondary)',
                      border: page === p ? 'none' : '1px solid var(--border)',
                      minWidth: '36px'
                    }}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="btn btn-secondary btn-sm"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
