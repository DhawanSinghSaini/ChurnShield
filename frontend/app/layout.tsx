import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'ChurnShield — AI-Powered Customer Churn Prediction',
  description: 'Monitor, predict, and prevent customer churn with real-time ML scoring, SHAP explainability, and automated alerts.',
  keywords: ['churn prediction', 'customer success', 'SaaS analytics', 'machine learning'],
  openGraph: {
    title: 'ChurnShield — Predict Churn Before It Happens',
    description: 'AI-powered churn prevention platform for subscription businesses.',
    type: 'website'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}