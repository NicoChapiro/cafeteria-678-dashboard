import { KpiCard } from './KpiCard';

export function KpiStrip({ total, visible, issues, summary }: { total: number; visible: number; issues: number; summary: string }) {
  return (
    <section style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', marginBottom: 12 }}>
      <KpiCard label="Productos" value={`${visible} / ${total}`} />
      <KpiCard label="Issues" value={`${issues}`} tone={issues > 0 ? 'warn' : 'info'} />
      <KpiCard label="Resumen" value={summary} />
    </section>
  );
}
