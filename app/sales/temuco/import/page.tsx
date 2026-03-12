'use client';

import BackNav from '@/src/components/BackNav';
import PageHeader from '@/src/components/PageHeader';
import PageShell from '@/src/components/PageShell';
import SalesImportFudo from '@/src/components/SalesImportFudo';

const fixedContextNotes = [
  'Esta pantalla opera con sucursal fija en Temuco; no requiere selección manual de sucursal.',
  'Puedes cargar el archivo Reporte-Productos (.xlsx), revisar la previsualización y confirmar la importación.',
  'Se mantiene la configuración de conservar ventas existentes por defecto para este flujo operativo.',
] as const;

export default function TemucoSalesImportPage() {
  return (
    <PageShell>
      <PageHeader
        title="Importador de ventas FU.DO · Temuco"
        description="Flujo operativo para importar ventas FU.DO con contexto fijo de sucursal Temuco, manteniendo controles de revisión y validación previas."
        backNav={<BackNav backTo={{ href: '/sales', label: 'Ventas' }} />}
      />

      <section
        className="card"
        style={{ display: 'grid', gap: 10, marginBottom: 12, borderLeft: '4px solid #0ea5e9' }}
      >
        <h2 style={{ margin: 0 }}>Contexto operativo fijo: Temuco</h2>
        <p className="muted" style={{ margin: 0 }}>
          Este flujo está preparado exclusivamente para la sucursal Temuco, usando la misma experiencia de
          previsualización e importación del importador estándar.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
          {fixedContextNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>

      <section className="card" style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Carga, revisión e importación</h2>
        <p className="muted" style={{ margin: 0 }}>
          Área operativa para cargar archivo, revisar resultados y ejecutar previsualización/importación con
          sucursal fija en Temuco.
        </p>
        <SalesImportFudo mode="fixed" fixedBranch="Temuco" defaultKeepSales />
      </section>
    </PageShell>
  );
}
