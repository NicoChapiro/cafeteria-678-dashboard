'use client';

import Link from 'next/link';

type Section = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

const primarySections: Section[] = [
  {
    title: 'Ver ventas',
    description: 'Pantalla unificada de ventas por sucursal y rango de fechas.',
    href: '/sales',
    cta: 'Ir a ventas',
  },
  {
    title: 'Importar ventas FU.DO',
    description: 'Importación estándar de ventas con selección de sucursal.',
    href: '/sales/import',
    cta: 'Ir a importador FU.DO',
  },
];

const sections: Section[] = [
  {
    title: 'Items',
    description: 'Catálogo base de insumos con unidad y rendimiento.',
    href: '/items',
    cta: 'Ir a items',
  },
  {
    title: 'Productos',
    description: 'Productos vendibles y su estado activo/inactivo.',
    href: '/products',
    cta: 'Ir a productos',
  },
  {
    title: 'Recetas',
    description: 'Recetas productivas y de sub-receta con costeo.',
    href: '/recipes',
    cta: 'Ir a recetas',
  },
  {
    title: 'Pendientes (Setup)',
    description: 'Centro mensual para detectar brechas de costo, precio, receta e insumos.',
    href: '/setup',
    cta: 'Ir a setup',
  },
  {
    title: 'Importar Base',
    description: 'Carga base consolidada XLSX para productos, ingredientes y recetas.',
    href: '/import/base',
    cta: 'Ir a importar base',
  },
  {
    title: 'Auditoría',
    description: 'Revisión de audit log y utilidades de export/import.',
    href: '/audit',
    cta: 'Ir a auditoría',
  },
  {
    title: 'Dashboard',
    description: 'Rentabilidad teórica basada en ventas reales por rango y sucursal.',
    href: '/dashboard',
    cta: 'Ir a dashboard',
  },
];

const adminFallbackSections: Section[] = [
  {
    title: 'Ventas Temuco (manual)',
    description: 'Carga y edición manual de ventas por día/producto (fallback).',
    href: '/sales/temuco',
    cta: 'Ir a ventas Temuco (manual)',
  },
  {
    title: 'Ventas Santiago (legacy)',
    description: 'Vista read-only histórica de ventas importadas por día/producto.',
    href: '/sales/santiago',
    cta: 'Ir a ventas Santiago',
  },
  {
    title: 'Importar Santiago (legacy)',
    description: 'Carga de planilla XLSX y conciliación de ventas.',
    href: '/sales/santiago/import',
    cta: 'Ir a importador',
  },
  {
    title: 'Importar Temuco (legacy)',
    description: 'Carga de planilla XLSX y conciliación de ventas Temuco.',
    href: '/sales/temuco/import',
    cta: 'Ir a importador Temuco',
  },
];

function renderSectionCards(items: Section[]) {
  return items.map((section) => (
    <article
      key={section.href}
      className="card"
    >
      <h2 className="cardTitle">{section.title}</h2>
      <p className="muted" style={{ marginBottom: 12 }}>{section.description}</p>
      <Link className="btnSecondary" href={section.href}>{section.cta}</Link>
    </article>
  ));
}

export default function HomePage() {
  return (
    <main>
      <header className="card">
        <h1 style={{ marginBottom: 8 }}>Cafetería 678 Dashboard</h1>
        <p className="muted">
          MVP A operativo en LocalStorage. Usa este panel raíz para navegar módulos del sistema.
        </p>
      </header>

      <section aria-label="Flujo principal" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12 }}>Flujo principal de ventas</h2>
        <div className="grid">{renderSectionCards(primarySections)}</div>
      </section>

      <section aria-label="Módulos del sistema" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12 }}>Módulos del sistema</h2>
        <div className="grid">{renderSectionCards(sections)}</div>
      </section>

      <section aria-label="Admin y fallback">
        <h2 style={{ marginBottom: 12 }}>Admin / Fallback</h2>
        <div className="grid">{renderSectionCards(adminFallbackSections)}</div>
      </section>
    </main>
  );
}
