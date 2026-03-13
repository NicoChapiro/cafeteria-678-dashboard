import { useEffect } from 'react';

type ToastProps = {
  message: string;
  onClose: () => void;
  durationMs?: number;
  tone?: 'success' | 'info' | 'warning' | 'error';
};

const toneStyles = {
  success: {
    background: '#14532d',
    color: '#f0fdf4',
    border: '#22c55e',
  },
  info: {
    background: '#1e3a8a',
    color: '#eff6ff',
    border: '#93c5fd',
  },
  warning: {
    background: '#78350f',
    color: '#fffbeb',
    border: '#f59e0b',
  },
  error: {
    background: '#7f1d1d',
    color: '#fef2f2',
    border: '#f87171',
  },
};

export default function Toast({ message, onClose, durationMs = 2600, tone = 'success' }: ToastProps) {
  const palette = toneStyles[tone];

  useEffect(() => {
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 1000,
        background: palette.background,
        color: palette.color,
        border: `1px solid ${palette.border}`,
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.2)',
      }}
    >
      {message}
    </div>
  );
}
