export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ;

export const DEMO_BUSINESSES = [
  {
    name: 'FlixStream',
    vertical: 'Streaming',
    email: 'streaming@flixstream.com',
    password: 'password123',
    emoji: '🎬',
    description: 'A video streaming platform with 200 monitored subscribers.'
  },
  {
    name: 'LearnFlow',
    vertical: 'EdTech',
    email: 'edtech@learnflow.com',
    password: 'password123',
    emoji: '📚',
    description: 'An e-learning platform with 200 active learners tracked.'
  },
  {
    name: 'ShopSaaS',
    vertical: 'SaaS',
    email: 'saas@shopsaas.com',
    password: 'password123',
    emoji: '🛒',
    description: 'A SaaS e-commerce tool managing 200 B2B customer accounts.'
  }
] as const;

export const RISK_THRESHOLDS = {
  CRITICAL: 0.75,
  AT_RISK: 0.40,
  HEALTHY: 0
} as const;

export const RISK_COLORS = {
  CRITICAL: 'var(--danger)',
  AT_RISK: 'var(--warning)',
  HEALTHY: 'var(--success)'
} as const;

export const SEGMENTS = [
  { value: '', label: 'All Customers' },
  { value: 'vips', label: '💎 VIP At-Risk' },
  { value: 'slipped', label: '🌑 Slipped Away' },
  { value: 'negative_spike', label: '⚡ Negative Spike' },
] as const;
