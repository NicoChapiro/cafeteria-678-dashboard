'use client';

import BackNav from '@/src/components/BackNav';
import PageHeader from '@/src/components/PageHeader';
import PageShell from '@/src/components/PageShell';
import SalesImportFudo from '@/src/components/SalesImportFudo';

const importSteps = [
  {
    title: '1) Configura el contexto',
    detail:
      'Selecciona sucursal, carga el archivo Reporte-Productos (.xlsx) y define si mantienes ventas existentes / modo estricto.',
  },
  {
    title: '2) Revisa la previsualización',
    detail:
      'Verifica rango de fechas, filas válidas, totales y productos no mapeados antes de confirmar la importación.',
  },
  {
    title: '3) Importa y valida resultado',
    detail:
      'Ejecuta la importación y revisa el estado final (éxito/error). Si necesitas corregir, cambia configuración o archivo y vuelve a previsualizar.',
  },
] as const;

export default function SalesImportPage() {
  return (
    <PageShell>
      <PageHeader
        title="Importador de ventas FU.DO"
        description="Flujo operativo para previsualizar e importar el reporte de productos (hoja Detalle) por sucursal, con controles y validaciones previas."
        backNav={<BackNav backTo={{ href: '/sales', label: 'Ventas' }} />}
      />

      <section
        className="card"
        style={{ display: 'grid', gap: 10, marginBottom: 12, borderLeft: '4px solid #0ea5e9' }}
      >
        <h2 style={{ margin: 0 }}>Antes de importar</h2>
        <p className="muted" style={{ margin: 0 }}>
          Este proceso no reemplaza tu revisión operativa: úsalo para confirmar contexto de sucursal/fecha,
          validar advertencias y luego ejecutar la importación final.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
          {importSteps.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>: {step.detail}
            </li>
          ))}
        </ul>
      </section>

      <section className="card" style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Carga, revisión e importación</h2>
        <p className="muted" style={{ margin: 0 }}>
          Área operativa: aquí puedes cargar el archivo, revisar previsualización/resultados y ejecutar acciones
          de previsualizar/importar con claridad de estado.
        </p>
        <SalesImportFudo mode="select" />
      </section>
    </PageShell>
  );
}
