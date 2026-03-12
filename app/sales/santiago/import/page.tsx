'use client';

import BackNav from '@/src/components/BackNav';
import PageHeader from '@/src/components/PageHeader';
import PageShell from '@/src/components/PageShell';
import SalesImportFudo from '@/src/components/SalesImportFudo';

const importSteps = [
  {
    title: '1) Verifica el contexto fijo',
    detail:
      'Este flujo está bloqueado para Santiago. Confirma archivo Reporte-Productos (.xlsx), rango y flags operativos antes de previsualizar.',
  },
  {
    title: '2) Revisa la previsualización',
    detail:
      'Controla fechas, filas válidas, totales y productos no mapeados para validar el resultado esperado antes de importar.',
  },
  {
    title: '3) Importa y valida el estado final',
    detail:
      'Ejecuta la importación y revisa el resultado final (éxito/error). Si hay ajustes, corrige archivo/configuración y vuelve a previsualizar.',
  },
] as const;

export default function SantiagoImportPage() {
  return (
    <PageShell>
      <PageHeader
        title="Importador de ventas FU.DO · Santiago"
        description="Flujo operativo para previsualizar e importar el reporte de productos (hoja Detalle) con contexto fijo en la sucursal Santiago."
        backNav={<BackNav backTo={{ href: '/sales', label: 'Ventas' }} />}
      />

      <section
        className="card"
        style={{ display: 'grid', gap: 10, marginBottom: 12, borderLeft: '4px solid #0ea5e9' }}
      >
        <h2 style={{ margin: 0 }}>Antes de importar</h2>
        <p className="muted" style={{ margin: 0 }}>
          Este flujo está configurado exclusivamente para <strong>Santiago</strong>. Usa esta guía para validar
          contexto operativo, revisar advertencias y ejecutar la importación final.
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
        <h2 style={{ margin: 0 }}>Carga, revisión e importación (Sucursal fija: Santiago)</h2>
        <p className="muted" style={{ margin: 0 }}>
          Área operativa con sucursal fija: carga el archivo, revisa previsualización/resultados y ejecuta
          previsualizar/importar manteniendo el contexto de Santiago.
        </p>
        <SalesImportFudo mode="fixed" fixedBranch="Santiago" />
      </section>
    </PageShell>
  );
}
