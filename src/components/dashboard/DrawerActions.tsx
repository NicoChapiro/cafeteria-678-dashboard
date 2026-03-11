import Link from 'next/link';

export type DrawerAction = { label: string; href: string; tone: 'warn' | 'info'; description?: string; ctaLabel?: string };

export function DrawerActions({ actions }: { actions: DrawerAction[] }) {
  return (
    <section className="card" style={{ marginBottom: 8 }}>
      <h3 style={{ marginTop: 0 }}>Acciones</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {actions.map((action) => {
          const isPrimary = action.tone === 'warn';
          return (
            <article key={`${action.href}-${action.label}`} className={isPrimary ? 'calloutWarning costingDrawerAction costingDrawerAction--primary' : 'calloutInfo costingDrawerAction'}>
              <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 8 }}>
                <strong>{action.label}</strong>
                <span className={`badge ${isPrimary ? 'badge--warn' : 'badge--info'}`}>{isPrimary ? 'Prioritaria' : 'Secundaria'}</span>
              </div>
              {action.description ? <p className="muted" style={{ marginTop: 4 }}>{action.description}</p> : null}
              <div style={{ marginTop: 8 }}>
                <Link className={isPrimary ? 'btn' : 'btnSecondary'} href={action.href}>{action.ctaLabel ?? 'Abrir'}</Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
