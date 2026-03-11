import Link from 'next/link';

export type DrawerAction = { label: string; href: string; tone: 'warn' | 'info'; description?: string; ctaLabel?: string };

export function DrawerActions({ actions }: { actions: DrawerAction[] }) {
  return <section className="card" style={{ marginBottom: 8 }}><h3 style={{ marginTop: 0 }}>Acciones</h3><div style={{ display: 'grid', gap: 8 }}>
    {actions.map((action) => (
      <article key={`${action.href}-${action.label}`} className={action.tone === 'warn' ? 'calloutWarning' : 'calloutInfo'}>
        <strong>{action.label}</strong>
        {action.description ? <p className="muted" style={{ marginTop: 4 }}>{action.description}</p> : null}
        <div style={{ marginTop: 6 }}><Link href={action.href}>{action.ctaLabel ?? 'Abrir'}</Link></div>
      </article>
    ))}
  </div></section>;
}
