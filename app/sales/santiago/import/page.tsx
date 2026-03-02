'use client';

import SalesImportFudo from '@/src/components/SalesImportFudo';

export default function SantiagoImportPage() {
  return (
    <main>
      <h1>Importar Ventas Santiago</h1>
      <SalesImportFudo mode="fixed" fixedBranch="Santiago" />
    </main>
  );
}
