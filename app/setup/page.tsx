'use client';

import dynamic from 'next/dynamic';

const SetupPendingClient = dynamic(() => import('./SetupPendingClient'), {
  ssr: false,
  loading: () => (
    <main className="pageStack" style={{ gap: 14 }}>
      <section className="card" style={{ display: 'grid', gap: 8, marginBottom: 0, maxWidth: 1120 }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.75 }}>
          Control operativo
        </p>
        <h1 style={{ margin: 0 }}>Panel de pendientes de setup</h1>
        <p style={{ margin: 0, opacity: 0.85 }}>Cargando panel…</p>
      </section>
    </main>
  ),
});

export default function SetupPendingPage() {
  return <SetupPendingClient />;
}
