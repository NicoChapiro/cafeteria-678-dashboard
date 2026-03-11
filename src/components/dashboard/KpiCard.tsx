export function KpiCard({ label, value, tone = 'info' }: { label: string; value: string; tone?: 'info' | 'warn' }) {
  return (
    <article className="card" style={{ marginBottom: 0, padding: 12, background: tone === 'warn' ? 'rgba(255,205,80,0.2)' : undefined }}>
      <p className="muted" style={{ fontSize: 12 }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{value}</p>
    </article>
  );
}
