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
    title: 'Importar Santiago',
    description: 'Carga de planilla XLSX y conciliación de ventas.',
    href: '/sales/santiago/import',
    cta: 'Ir a importador',
  },
  {
    title: 'Auditoría',
    description: 'Revisión de márgenes y costos por rango de fechas.',
    href: '/audit',
    cta: 'Ir a auditoría',
  },
];

export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1080, margin: '0 auto' }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 8 }}>Cafetería 678 Dashboard</h1>
        <p style={{ color: '#444', margin: 0 }}>
          MVP A operativo en LocalStorage. Usa este panel raíz para navegar módulos del sistema.
        </p>
      </header>

      <section
        aria-label="Módulos del sistema"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        {sections.map((section) => (
          <article
            key={section.href}
            style={{ border: '1px solid #ddd', borderRadius: 8, padding: 14, background: '#fff' }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 18 }}>{section.title}</h2>
            <p style={{ marginTop: 0, marginBottom: 12, color: '#444' }}>{section.description}</p>
            <Link href={section.href}>{section.cta}</Link>
          </article>
        ))}
      </section>
    </main>
  );
}
