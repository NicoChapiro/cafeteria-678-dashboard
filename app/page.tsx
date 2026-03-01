'use client';

import Link from 'next/link';

const sections = [
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
    title: 'Ventas Temuco',
    description: 'Carga y edición manual de ventas por día/producto.',
    href: '/sales/temuco',
    cta: 'Ir a ventas Temuco',
  },
  {
    title: 'Ventas Santiago',
    description: 'Vista read-only de ventas importadas por día/producto',
    href: '/sales/santiago',
    cta: 'Ir a ventas Santiago',
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
    title: 'Importar Santiago',
    description: 'Carga de planilla XLSX y conciliación de ventas.',
    href: '/sales/santiago/import',
    cta: 'Ir a importador',
  },
  {
    title: 'Importar Temuco',
    description: 'Carga de planilla XLSX y conciliación de ventas.',
    href: '/sales/temuco/import',
    cta: 'Ir a importador',
  },
  {
    title: 'Auditoría',
    description: 'Revisión de márgenes y costos por rango de fechas.',
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

export default function HomePage() {
  return (
    <main>
      <header className="card">
        <h1 style={{ marginBottom: 8 }}>Cafetería 678 Dashboard</h1>
        <p className="muted">
          MVP A operativo en LocalStorage. Usa este panel raíz para navegar módulos del sistema.
        </p>
      </header>

      <section aria-label="Módulos del sistema" className="grid">
        {sections.map((section) => (
          <article
            key={section.href}
            className="card"
          >
            <h2 className="cardTitle">{section.title}</h2>
            <p className="muted" style={{ marginBottom: 12 }}>{section.description}</p>
            <Link className="btnSecondary" href={section.href}>{section.cta}</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
