import type { ReactNode } from 'react';

type KpiCardProps = {
  label: string;
  value: ReactNode;
  helpText?: ReactNode;
};

export default function KpiCard({ label, value, helpText }: KpiCardProps) {
  return (
    <article className="card" style={{ marginBottom: 0 }}>
      <p className="muted" style={{ marginBottom: 6 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{value}</p>
      {helpText ? <p className="muted" style={{ marginTop: 8 }}>{helpText}</p> : null}
    </article>
  );
}
