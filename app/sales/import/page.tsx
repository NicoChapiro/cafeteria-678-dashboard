'use client';

import BackNav from '@/src/components/BackNav';
import PageHeader from '@/src/components/PageHeader';
import PageShell from '@/src/components/PageShell';
import SalesImportFudo from '@/src/components/SalesImportFudo';

export default function SalesImportPage() {
  return (
    <PageShell>
      <PageHeader
        title="Importar Ventas FU.DO"
        description="Usa esta pantalla estándar para importar el reporte de productos (hoja Detalle) para cualquier sucursal."
        backNav={<BackNav backTo={{ href: '/sales', label: 'Ventas' }} />}
      />

      <section style={{ marginBottom: 0 }}>
        <h2 style={{ marginTop: 0 }}>Detalle</h2>
        <SalesImportFudo mode="select" />
      </section>
    </PageShell>
  );
}
