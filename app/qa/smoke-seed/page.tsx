'use client';

import Link from 'next/link';
import { useState } from 'react';

import { QA_SMOKE_CASES, loadQaSmokeDataset } from '@/src/storage/local/qaSmokeSeed';

export default function QaSmokeSeedPage() {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLoadDataset = () => {
    setError(null);

    try {
      const summary = loadQaSmokeDataset();
      setResult(
        [
          'Dataset QA smoke cargado en localStorage.',
          `Items: ${summary.items}`,
          `Recetas: ${summary.recipes}`,
          `Productos: ${summary.products}`,
          `Ventas: ${summary.salesDaily}`,
          `Costos de ítems: ${summary.itemCosts}`,
          `Precios de productos: ${summary.productPrices}`,
          `Costos manuales de productos: ${summary.productCosts}`,
        ].join(' · '),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No fue posible cargar el dataset QA smoke.');
    }
  };

  return (
    <main className="pageStack" style={{ maxWidth: 980 }}>
      <section className="card" style={{ marginBottom: 0, display: 'grid', gap: 10 }}>
        <p className="muted" style={{ margin: 0, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          QA local
        </p>
        <h1 style={{ margin: 0 }}>Cargar dataset QA smoke</h1>
        <p className="muted" style={{ margin: 0 }}>
          Acción manual y explícita para preparar el entorno de pruebas operativas. Esta carga reemplaza el dataset local
          actual del navegador.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={handleLoadDataset}>
            Cargar dataset QA smoke
          </button>
          <Link href="/" className="btnSecondary">Volver a inicio</Link>
          <Link href="/setup" className="btnSecondary">Ir a pendientes</Link>
          <Link href="/products/costing" className="btnSecondary">Ir a costeo</Link>
          <Link href="/dashboard" className="btnSecondary">Ir a dashboard</Link>
        </div>

        {result ? (
          <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{result}</p>
        ) : null}

        {error ? (
          <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>Error: {error}</p>
        ) : null}
      </section>

      <section className="card" style={{ marginBottom: 0 }}>
        <h2 style={{ marginTop: 0 }}>Casos que habilita este seed</h2>
        <ul style={{ marginBottom: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
          {QA_SMOKE_CASES.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
