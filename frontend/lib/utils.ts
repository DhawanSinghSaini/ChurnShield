export function formatRisk(prob: number): string {
  return `${Math.round(prob * 100)}%`;
}

export function formatCurrency(val: number | string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(val));
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function getRiskColor(status: string): string {
  if (status === 'CRITICAL') return 'var(--danger)';
  if (status === 'AT_RISK') return 'var(--warning)';
  return 'var(--success)';
}

export function getRiskBadgeClass(status: string): string {
  if (status === 'CRITICAL') return 'badge-danger';
  if (status === 'AT_RISK') return 'badge-warning';
  return 'badge-success';
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}