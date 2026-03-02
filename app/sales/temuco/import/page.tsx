'use client';

import SalesImportFudo from '@/src/components/SalesImportFudo';

export default function TemucoSalesImportPage() {
  return (
    <main>
      <header className="card">
        <h1 style={{ marginBottom: 8 }}>Importar Ventas Temuco (XLSX)</h1>
        <p className="muted">
          Este import usa la misma pantalla y parser estándar FU.DO, con sucursal fija en Temuco.
        </p>
      </header>

      <SalesImportFudo mode="fixed" fixedBranch="Temuco" defaultKeepSales />
    </main>
  );
}
