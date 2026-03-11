'use client';

import Link from 'next/link';

type Section = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

const salesFlowSections: Section[] = [
  {
    title: 'Registrar ventas',
    description: 'Carga y revisa ventas por sucursal en el período operativo.',
    href: '/sales',
    cta: 'Abrir ventas',
  },
  {
    title: 'Importar ventas FU.DO',
    description: 'Importación estándar para dejar el flujo diario al día.',
    href: '/sales/import',
    cta: 'Abrir importador FU.DO',
  },
];

const masterDataSections: Section[] = [
  {
    title: 'Productos',
    description: 'Gestiona el catálogo vendible y el estado activo/inactivo.',
    href: '/products',
    cta: 'Ir a productos',
  },
  {
    title: 'Recetas',
    description: 'Administra recetas productivas y sub-recetas con su costeo.',
    href: '/recipes',
    cta: 'Ir a recetas',
  },
  {
    title: 'Items',
    description: 'Mantén insumos, unidad de compra y rendimiento operacional.',
    href: '/items',
    cta: 'Ir a items',
  },
  {
    title: 'Pendientes de setup',
    description: 'Detecta brechas mensuales de costo, precio, receta e insumos.',
    href: '/setup',
    cta: 'Ir a setup',
  },
  {
    title: 'Importar base',
    description: 'Carga consolidada XLSX para productos, ingredientes y recetas.',
    href: '/import/base',
    cta: 'Abrir importar base',
  },
];

const controlSections: Section[] = [
  {
    title: 'Dashboard de rentabilidad',
    description: 'Analiza rentabilidad teórica con ventas reales por sucursal y período.',
    href: '/dashboard',
    cta: 'Abrir dashboard',
  },
  {
    title: 'Auditoría',
    description: 'Revisa audit log y utilidades de exportación/importación.',
    href: '/audit',
    cta: 'Ir a auditoría',
  },
];

const adminFallbackSections: Section[] = [
  {
    title: 'Ventas Temuco (manual)',
    description: 'Carga y edición manual de ventas por día/producto (fallback).',
    href: '/sales/temuco',
    cta: 'Ir a ventas Temuco',
  },
  {
    title: 'Ventas Santiago (legacy)',
    description: 'Vista histórica de ventas importadas por día/producto.',
    href: '/sales/santiago',
    cta: 'Ir a ventas Santiago',
  },
  {
    title: 'Importar Santiago (legacy)',
    description: 'Carga planilla XLSX y concilia ventas históricas.',
    href: '/sales/santiago/import',
    cta: 'Importar Santiago',
  },
  {
    title: 'Importar Temuco (legacy)',
    description: 'Carga planilla XLSX y concilia ventas de Temuco.',
    href: '/sales/temuco/import',
    cta: 'Importar Temuco',
  },
];

function renderSectionCards(items: Section[]) {
  return items.map((section) => (
    <article key={section.href} className="card">
      <h3 className="cardTitle">{section.title}</h3>
      <p className="muted" style={{ marginBottom: 12 }}>
        {section.description}
      </p>
      <Link className="btnSecondary" href={section.href}>
        {section.cta}
      </Link>
    </article>
  ));
}

export default function HomePage() {
  return (
    <main>
      <header className="card" style={{ marginBottom: 20 }}>
        <span className="badge badge--info" style={{ marginBottom: 10 }}>
          Inicio operativo
        </span>
        <h1 style={{ margin: '0 0 8px 0' }}>Panel de operación Cafetería 678</h1>
        <p className="muted" style={{ marginBottom: 14 }}>
          Prioriza el costeo, revisa rentabilidad y continúa con el flujo de ventas del día.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn" href="/products/costing">
            Ir a Costeo de productos
          </Link>
          <Link className="btnSecondary" href="/dashboard">
            Ver dashboard de rentabilidad
          </Link>
        </div>
      </header>

      <section aria-label="Flujo de ventas" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12 }}>Flujo de ventas</h2>
        <div className="grid">{renderSectionCards(salesFlowSections)}</div>
      </section>

      <section aria-label="Maestros y configuración" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12 }}>Maestros y configuración</h2>
        <div className="grid">{renderSectionCards(masterDataSections)}</div>
      </section>

      <section aria-label="Control y seguimiento" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12 }}>Control y seguimiento</h2>
        <div className="grid">{renderSectionCards(controlSections)}</div>
      </section>

      <section aria-label="Admin y fallback">
        <h2 style={{ marginBottom: 12 }}>Admin y fallback</h2>
        <div className="grid">{renderSectionCards(adminFallbackSections)}</div>
      </section>
    </main>
  );
}
