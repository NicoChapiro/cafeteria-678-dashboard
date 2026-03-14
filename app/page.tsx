'use client';

import Link from 'next/link';

type Section = {
  title: string;
  description: string;
  href: string;
  cta: string;
};

const primaryFlowSections: Section[] = [
  {
    title: '1) Importar ventas',
    description: 'Carga ventas FU.DO para iniciar el ciclo operativo del período actual.',
    href: '/sales/import',
    cta: 'Importar ventas',
  },
  {
    title: '2) Resolver pendientes críticos',
    description: 'Corrige brechas de setup que afectan costo, precio y consistencia operacional.',
    href: '/setup',
    cta: 'Resolver pendientes',
  },
  {
    title: '3) Costear productos',
    description: 'Actualiza costos teóricos de productos para reflejar el estado real del negocio.',
    href: '/products/costing',
    cta: 'Ir a costeo',
  },
  {
    title: '4) Ver rentabilidad',
    description: 'Revisa resultados por período y sucursal para tomar decisiones con contexto.',
    href: '/dashboard',
    cta: 'Abrir dashboard',
  },
];

const masterToolsSections: Section[] = [
  {
    title: 'Productos',
    description: 'Gestiona catálogo, estado activo e información base vendible.',
    href: '/products',
    cta: 'Ir a productos',
  },
  {
    title: 'Recetas',
    description: 'Administra recetas productivas y sub-recetas para costeo.',
    href: '/recipes',
    cta: 'Ir a recetas',
  },
  {
    title: 'Ítems',
    description: 'Mantén insumos, formatos de compra y rendimientos operacionales.',
    href: '/items',
    cta: 'Ir a ítems',
  },
];

const advancedToolsSections: Section[] = [
  {
    title: 'Ventas (resumen manual)',
    description: 'Acceso a carga y revisión manual de ventas.',
    href: '/sales',
    cta: 'Ir a ventas',
  },
  {
    title: 'Importar base',
    description: 'Carga consolidada XLSX para productos, ingredientes y recetas.',
    href: '/import/base',
    cta: 'Importar base',
  },
  {
    title: 'Auditoría',
    description: 'Revisa eventos y utilidades de exportación/importación.',
    href: '/audit',
    cta: 'Ir a auditoría',
  },
  {
    title: 'Ventas Temuco (legacy)',
    description: 'Vista legacy/manual para soporte operativo puntual.',
    href: '/sales/temuco',
    cta: 'Abrir Temuco',
  },
  {
    title: 'Ventas Santiago (legacy)',
    description: 'Vista histórica de ventas importadas por día/producto.',
    href: '/sales/santiago',
    cta: 'Abrir Santiago',
  },
  {
    title: 'Importar Santiago (legacy)',
    description: 'Carga planilla XLSX para conciliación histórica de Santiago.',
    href: '/sales/santiago/import',
    cta: 'Importar Santiago',
  },
  {
    title: 'Importar Temuco (legacy)',
    description: 'Carga planilla XLSX para conciliación histórica de Temuco.',
    href: '/sales/temuco/import',
    cta: 'Importar Temuco',
  },
];

function renderSectionCards(items: Section[]) {
  return items.map((section) => (
    <article key={section.href} className="card" style={{ padding: 14, marginBottom: 0 }}>
      <h3 className="cardTitle" style={{ marginBottom: 5, fontSize: 17, lineHeight: 1.25 }}>
        {section.title}
      </h3>
      <p className="muted" style={{ marginBottom: 8, maxWidth: 52 * 8, lineHeight: 1.35 }}>
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
    <main className="pageStack" style={{ gap: 16 }}>
      <header className="card" style={{ marginBottom: 0, padding: 16, maxWidth: 1120 }}>
        <span className="badge badge--info" style={{ marginBottom: 8 }}>
          Centro operativo
        </span>
        <h1 style={{ margin: '0 0 6px 0', fontSize: 26, lineHeight: 1.2 }}>Flujo recomendado Cafetería 678</h1>
        <p className="muted" style={{ marginBottom: 10, maxWidth: 74 * 8, lineHeight: 1.35 }}>
          Sigue este orden para operar el sistema con foco: importar ventas, resolver pendientes críticos,
          costear productos y cerrar con revisión de rentabilidad.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn" href="/sales/import">
            Importar ventas
          </Link>
          <Link className="btnSecondary" href="/setup">
            Resolver pendientes
          </Link>
        </div>
      </header>

      <section aria-label="Flujo principal" className="sectionStack">
        <h2 style={{ margin: '0 0 8px 0', fontSize: 20, lineHeight: 1.2 }}>Flujo principal</h2>
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 10, maxWidth: 1120 }}
        >
          {renderSectionCards(primaryFlowSections)}
        </div>
      </section>

      <section aria-label="Herramientas maestras" className="sectionStack">
        <h2 style={{ margin: '0 0 8px 0', fontSize: 20, lineHeight: 1.2 }}>Herramientas maestras</h2>
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 10, maxWidth: 1120 }}
        >
          {renderSectionCards(masterToolsSections)}
        </div>
      </section>

      <section aria-label="Herramientas avanzadas" className="sectionStack" style={{ maxWidth: 1120 }}>
        <details>
          <summary className="muted" style={{ cursor: 'pointer', fontSize: 15, marginBottom: 6 }}>
            Herramientas avanzadas (legacy y soporte)
          </summary>
          <p className="muted" style={{ marginBottom: 8, maxWidth: 74 * 8, lineHeight: 1.35, fontSize: 14 }}>
            Accesos secundarios para casos puntuales cuando el flujo principal no cubra la operación.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {advancedToolsSections.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="btnSecondary"
                style={{ padding: '6px 10px', fontSize: 13, lineHeight: 1.2 }}
              >
                {section.title}
              </Link>
            ))}
          </div>
        </details>
      </section>
    </main>
  );
}
