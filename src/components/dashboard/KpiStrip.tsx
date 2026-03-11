import { KpiCard } from './KpiCard';

export function KpiStrip({ total, visible, issues, summary }: { total: number; visible: number; issues: number; summary: string }) {
  const healthy = Math.max(visible - issues, 0);

  return (
    <section className="costingKpiStrip">
      <KpiCard label="Productos visibles" value={`${visible} / ${total}`} />
      <KpiCard label="Con issues" value={`${issues}`} tone={issues > 0 ? 'warn' : 'info'} />
      <KpiCard label="Saludables" value={`${healthy}`} tone={healthy > 0 ? 'info' : 'warn'} />
      <KpiCard label="Resumen" value={summary} />
    </section>
  );
}
