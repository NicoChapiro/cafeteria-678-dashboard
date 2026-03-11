import { ReactNode } from 'react';

type InlineAlertTone = 'error' | 'success' | 'warning' | 'info';

type InlineAlertProps = {
  tone?: InlineAlertTone;
  children: ReactNode;
};

const toneStyles: Record<InlineAlertTone, { color: string; background: string; border: string }> = {
  error: {
    color: '#7f1d1d',
    background: '#fef2f2',
    border: '#fecaca',
  },
  success: {
    color: '#14532d',
    background: '#f0fdf4',
    border: '#bbf7d0',
  },
  warning: {
    color: '#78350f',
    background: '#fffbeb',
    border: '#fde68a',
  },
  info: {
    color: '#1e3a8a',
    background: '#eff6ff',
    border: '#bfdbfe',
  },
};

export default function InlineAlert({ tone = 'info', children }: InlineAlertProps) {
  const style = toneStyles[tone];

  return (
    <p
      style={{
        margin: 0,
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${style.border}`,
        background: style.background,
        color: style.color,
      }}
    >
      {children}
    </p>
  );
}
