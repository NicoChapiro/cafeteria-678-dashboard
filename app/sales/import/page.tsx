'use client';

import SalesImportFudo from '@/src/components/SalesImportFudo';
import BackNav from '@/src/components/BackNav';

export default function SalesImportPage() {
  return (
    <main>
      <header className="card">
        <BackNav backTo={{ href: '/sales', label: 'Ventas' }} />
        <h1 style={{ marginBottom: 8 }}>Importar Ventas FU.DO</h1>
        <p className="muted">
          Usa esta pantalla estándar para importar el reporte de productos (hoja Detalle) para
          cualquier sucursal.
        </p>
      </header>

      <SalesImportFudo mode="select" />
    </main>
  );
}
