'use client';

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

import {
  importSalesTemuco,
  type TemucoSalesImportRow,
} from '@/src/storage/local/store';
import { parseFudoProductsXlsx } from '@/src/services/fudoReport';

type PreviewState = {
  rowsRead: number;
  validRows: TemucoSalesImportRow[];
  errors: string[];
  dateMin: string | null;
  dateMax: string | null;
  totalGross: number;
  totalQty: number;
};

export default function TemucoSalesImportPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [busy, setBusy] = useState(false);
  const [keepSales, setKeepSales] = useState(true);
  const [importResult, setImportResult] = useState<{
    imported: number;
    updated?: number;
    skipped?: number;
    errors?: string[];
  } | null>(null);

  const computed = useMemo(() => {
    if (!workbook || !selectedSheet) return null;

    const selectedWorksheet = workbook.Sheets[selectedSheet];
    if (!selectedWorksheet) return null;

    const selectedWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(selectedWorkbook, selectedWorksheet, 'Detalle');

    const buffer = XLSX.write(selectedWorkbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const parsed = parseFudoProductsXlsx(buffer);

    const validRows: TemucoSalesImportRow[] = parsed.rows.map((row) => ({
      date: row.date,
      product: row.productName,
      qty: row.qty,
      gross: row.grossSalesClp,
    }));

    return {
      validRows,
      dateMin: parsed.dateMin,
      dateMax: parsed.dateMax,
      totalGross: parsed.totalGross,
      totalQty: parsed.totalQty,
      errors: parsed.errors,
      rowsRead: parsed.rowsRead,
    };
  }, [workbook, selectedSheet]);

  async function onPickFile(file: File): Promise<void> {
    setImportResult(null);
    setPreview(null);
    setFileName(file.name);

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    setWorkbook(wb);
    setSheetNames(wb.SheetNames);
    const preferred =
      wb.SheetNames.find((name) => name === 'Detalle') ??
      wb.SheetNames.find((name) => name.toLocaleLowerCase('es-CL').includes('detalle')) ??
      wb.SheetNames[0] ?? '';
    setSelectedSheet(preferred);
  }

  function onPreview(): void {
    if (!computed) return;
    setPreview({
      rowsRead: computed.rowsRead,
      validRows: computed.validRows,
      errors: computed.errors,
      dateMin: computed.dateMin,
      dateMax: computed.dateMax,
      totalGross: computed.totalGross,
      totalQty: computed.totalQty,
    });
  }

  async function onImport(): Promise<void> {
    if (!preview) return;
    setBusy(true);
    try {
      const res = importSalesTemuco(preview.validRows, { keepSales });
      setImportResult(res);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header className="card">
        <h1 style={{ marginBottom: 8 }}>Importar Ventas Temuco (XLSX)</h1>
        <p className="muted">
          Este import es igual al de Santiago: mismo reporte, misma validación y mismo flujo.
        </p>
      </header>

      <section className="card" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <label>Archivo XLSX</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickFile(f);
            }}
          />
          {fileName ? <div className="muted">{fileName}</div> : null}
        </div>

        {sheetNames.length ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <label>Hoja</label>
            <select
              className="select"
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
            >
              {sheetNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id="keepSales"
            type="checkbox"
            checked={keepSales}
            onChange={(e) => setKeepSales(e.target.checked)}
          />
          <span>Mantener ventas existentes fuera del rango importado</span>
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btnSecondary"
            disabled={!computed}
            type="button"
            onClick={onPreview}
          >
            Previsualizar
          </button>

          <button
            className="btn"
            disabled={!preview || busy}
            type="button"
            onClick={() => void onImport()}
          >
            {busy ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </section>

      {preview ? (
        <section className="card" style={{ display: 'grid', gap: 8 }}>
          <div>
            <strong>Filas leídas:</strong> {preview.rowsRead}
          </div>
          <div>
            <strong>Filas válidas:</strong> {preview.validRows.length}
          </div>
          <div>
            <strong>Rango fechas:</strong> {preview.dateMin ?? '-'} → {preview.dateMax ?? '-'}
          </div>
          <div>
            <strong>Total Qty:</strong> {preview.totalQty}
          </div>
          <div>
            <strong>Total Gross:</strong> {Math.round(preview.totalGross)}
          </div>

          {preview.errors.length ? (
            <div style={{ marginTop: 8 }}>
              <div><strong>Warnings</strong></div>
              <ul className="muted" style={{ marginTop: 6 }}>
                {preview.errors.slice(0, 20).map((e, i) => (
                  <li key={`${e}-${i}`}>{e}</li>
                ))}
              </ul>
              {preview.errors.length > 20 ? (
                <div className="muted" style={{ marginTop: 4 }}>
                  Mostrando 20 de {preview.errors.length}.
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {importResult ? (
        <section className="card" style={{ display: 'grid', gap: 8 }}>
          <div>
            <strong>Importadas:</strong> {importResult.imported}
          </div>
          {'updated' in importResult ? (
            <div>
              <strong>Actualizadas:</strong> {importResult.updated ?? 0}
            </div>
          ) : null}
          {'skipped' in importResult ? (
            <div>
              <strong>Omitidas:</strong> {importResult.skipped ?? 0}
            </div>
          ) : null}
          {importResult.errors?.length ? (
            <div style={{ color: '#b00020' }}>
              Errores: {importResult.errors.join(' | ')}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
