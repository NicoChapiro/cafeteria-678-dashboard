import { useEffect } from 'react';

type ToastProps = {
  message: string;
  onClose: () => void;
  durationMs?: number;
};

export default function Toast({ message, onClose, durationMs = 2600 }: ToastProps) {
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
        background: '#14532d',
        color: '#f0fdf4',
        border: '1px solid #22c55e',
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.2)',
      }}
    >
      {message}
    </div>
  );
}
