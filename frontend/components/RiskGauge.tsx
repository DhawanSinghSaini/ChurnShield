'use client';

interface Props {
  score: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
}

export default function RiskGauge({ score, size = 140, strokeWidth = 12 }: Props) {
  const r = (size / 2) - strokeWidth;
  const circ = 2 * Math.PI * r;
  // Gauge is a 270° arc (from 135° to 45°)
  const arcLength = circ * 0.75;
  const fillLength = arcLength * Math.min(1, Math.max(0, score));

  const color = score >= 0.75 ? 'var(--danger)' : score >= 0.40 ? 'var(--warning)' : 'var(--success)';
  const label = score >= 0.75 ? 'CRITICAL' : score >= 0.40 ? 'AT RISK' : 'HEALTHY';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(135deg)' }}>
        {/* Background track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="var(--bg-elevated)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circ}`}
        />
        {/* Filled arc */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${fillLength} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease' }}
        />
      </svg>
      {/* Score label in the centre */}
      <div style={{ marginTop: `-${size * 0.55}px`, textAlign: 'center', lineHeight: 1.1 }}>
        <div style={{ fontSize: size * 0.2, fontWeight: 800, color }}>{Math.round(score * 100)}%</div>
        <div style={{ fontSize: size * 0.09, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em' }}>{label}</div>
      </div>
    </div>
  );
}
